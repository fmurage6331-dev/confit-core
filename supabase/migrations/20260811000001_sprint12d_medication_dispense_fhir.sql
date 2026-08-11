-- Sprint 12D: MedicationDispense FHIR R4 resource on dispense
-- AfyaLink HIE — Digital Health (Data Exchange Component) Regulations 2025
-- Fires AFTER UPDATE on prescriptions when status changes to 'dispensed'
-- Writes FHIR R4 MedicationDispense to dha_outbound_queue (queue_type = fhir_sync)
-- Existing trg_shr_transmission_log_insert then auto-copies to shr_transmission_log

-- ============================================================
-- 1. TRIGGER FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION public.trg_medication_dispense_fhir()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient_id      uuid;
  v_facility_kmhfl  text;
  v_facility_name   text;
  v_payload         jsonb;
BEGIN
  -- Only fire when status changes TO 'dispensed'
  IF OLD.status = NEW.status OR NEW.status <> 'dispensed' THEN
    RETURN NEW;
  END IF;

  -- Resolve patient_id via encounter
  IF NEW.encounter_id IS NOT NULL THEN
    SELECT patient_id
    INTO   v_patient_id
    FROM   public.encounters
    WHERE  id = NEW.encounter_id;
  END IF;

  -- Facility settings
  SELECT COALESCE(facility_kmhfl_code, 'UNKNOWN'),
         COALESCE(facility_name, 'AegisCare')
  INTO   v_facility_kmhfl, v_facility_name
  FROM   public.app_settings
  WHERE  id = 'global';

  -- Build FHIR R4 MedicationDispense resource
  v_payload := jsonb_build_object(
    'resourceType', 'MedicationDispense',
    'id',           NEW.id,
    'status',       'completed',

    'medicationCodeableConcept', jsonb_build_object(
      'text',   NEW.drug_name,
      'coding', CASE
        WHEN NEW.stock_item_id IS NOT NULL THEN
          jsonb_build_array(
            jsonb_build_object(
              'system',  'https://kemsa.go.ke/ns/nlmis-code',
              'display', NEW.drug_name
            )
          )
        ELSE '[]'::jsonb
      END
    ),

    'subject', CASE
      WHEN v_patient_id IS NOT NULL
        THEN jsonb_build_object('reference', CONCAT('Patient/', v_patient_id))
      ELSE '{}'::jsonb
    END,

    'context', CASE
      WHEN NEW.encounter_id IS NOT NULL
        THEN jsonb_build_object('reference', CONCAT('Encounter/', NEW.encounter_id))
      ELSE NULL
    END,

    'performer', jsonb_build_array(
      jsonb_build_object(
        'actor', jsonb_build_object(
          'reference', CONCAT('Practitioner/', COALESCE(NEW.dispensed_by::text, 'unknown')),
          'display',   COALESCE(NEW.dispensed_by_name, 'Unknown')
        )
      )
    ),

    'quantity', jsonb_build_object(
      'value',  NEW.quantity,
      'system', 'http://unitsofmeasure.org',
      'code',   'U'
    ),

    'whenHandedOver', COALESCE(NEW.dispensed_at, NOW()),

    'dosageInstruction', jsonb_build_array(
      jsonb_build_object(
        'text', CONCAT_WS(' | ',
          NULLIF(TRIM(COALESCE(NEW.dosage,    '')), ''),
          NULLIF(TRIM(COALESCE(NEW.frequency, '')), ''),
          NULLIF(TRIM(COALESCE(NEW.duration,  '')), '')
        ),
        'patientInstruction', NEW.notes
      )
    ),

    'extension', jsonb_build_array(
      jsonb_build_object(
        'url',         'http://dha.go.ke/fhir/StructureDefinition/encounter-type',
        'valueString', NEW.encounter_type
      ),
      jsonb_build_object(
        'url',         'https://kmhfl.health.go.ke/facility',
        'valueString', v_facility_kmhfl
      ),
      jsonb_build_object(
        'url',         'http://dha.go.ke/fhir/StructureDefinition/facility-name',
        'valueString', v_facility_name
      )
    )
  );

  -- Queue for AfyaLink HIE transmission
  INSERT INTO public.dha_outbound_queue (
    id,
    encounter_id,
    patient_id,
    queue_type,
    payload,
    status,
    attempts,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    NEW.encounter_id,
    v_patient_id,
    'fhir_sync',
    v_payload,
    'pending',
    0,
    NOW(),
    NOW()
  );

  RETURN NEW;
END;
$$;

-- ============================================================
-- 2. ATTACH TRIGGER TO prescriptions
-- ============================================================
DROP TRIGGER IF EXISTS trg_medication_dispense_fhir ON public.prescriptions;

CREATE TRIGGER trg_medication_dispense_fhir
  AFTER UPDATE ON public.prescriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_medication_dispense_fhir();
