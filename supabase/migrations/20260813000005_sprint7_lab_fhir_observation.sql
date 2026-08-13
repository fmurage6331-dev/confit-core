-- Sprint 7 (G3): FHIR Observation + DiagnosticReport trigger for lab results
-- Lab results currently never reach the DHA SHR.
-- This trigger fires when a lab_result is inserted or verified,
-- queuing a FHIR Observation payload into dha_outbound_queue.
-- Same pattern as trg_medication_dispense_fhir.

-- Function to build and queue FHIR Observation from lab_result
CREATE OR REPLACE FUNCTION public.queue_lab_result_fhir()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_encounter_id  UUID;
  v_patient_id    UUID;
  v_order_data    RECORD;
  v_fhir_obs      JSONB;
  v_fhir_report   JSONB;
BEGIN
  -- Only queue when result is verified or first inserted with a value
  IF TG_OP = 'UPDATE' AND
     (NEW.verified_at IS NULL OR OLD.verified_at IS NOT NULL) THEN
    RETURN NEW;
  END IF;

  -- Get lab order details
  SELECT
    lo.encounter_id,
    lo.patient_id,
    lo.test_name,
    lo.specimen_type,
    lo.collected_at,
    lo.is_critical
  INTO v_order_data
  FROM public.lab_orders lo
  WHERE lo.id = NEW.lab_order_id;

  v_encounter_id := v_order_data.encounter_id;
  v_patient_id   := v_order_data.patient_id;

  -- Build FHIR R4 Observation resource
  v_fhir_obs := jsonb_build_object(
    'resourceType', 'Observation',
    'id',           NEW.id::TEXT,
    'meta', jsonb_build_object(
      'profile', jsonb_build_array(
        'http://hl7.org/fhir/StructureDefinition/Observation'
      )
    ),
    'status', CASE
      WHEN NEW.verified_at IS NOT NULL THEN 'final'
      ELSE 'preliminary'
    END,
    'category', jsonb_build_array(
      jsonb_build_object(
        'coding', jsonb_build_array(
          jsonb_build_object(
            'system',  'http://terminology.hl7.org/CodeSystem/observation-category',
            'code',    'laboratory',
            'display', 'Laboratory'
          )
        )
      )
    ),
    'code', jsonb_build_object(
      'coding', jsonb_build_array(
        jsonb_build_object(
          'system',  'https://khis.go.ke/lab-tests',
          'code',    NEW.lab_order_id::TEXT,
          'display', v_order_data.test_name
        )
      ),
      'text', v_order_data.test_name
    ),
    'subject', jsonb_build_object(
      'reference', 'Patient/' || v_patient_id::TEXT
    ),
    'encounter', jsonb_build_object(
      'reference', 'Encounter/' || v_encounter_id::TEXT
    ),
    'effectiveDateTime', COALESCE(
      v_order_data.collected_at,
      NEW.created_at
    ),
    'issued', NEW.verified_at,
    'valueString', NEW.result_value,
    'interpretation', CASE
      WHEN v_order_data.is_critical THEN
        jsonb_build_array(
          jsonb_build_object(
            'coding', jsonb_build_array(
              jsonb_build_object(
                'system',  'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation',
                'code',    'CR',
                'display', 'Critical'
              )
            )
          )
        )
      ELSE NULL
    END,
    'note', CASE
      WHEN NEW.notes IS NOT NULL THEN
        jsonb_build_array(jsonb_build_object('text', NEW.notes))
      ELSE NULL
    END,
    'performer', CASE
      WHEN NEW.verified_by IS NOT NULL THEN
        jsonb_build_array(
          jsonb_build_object(
            'reference', 'Practitioner/' || NEW.verified_by::TEXT
          )
        )
      ELSE NULL
    END
  );

  -- Build FHIR R4 DiagnosticReport wrapping the Observation
  v_fhir_report := jsonb_build_object(
    'resourceType', 'DiagnosticReport',
    'id',           gen_random_uuid()::TEXT,
    'meta', jsonb_build_object(
      'profile', jsonb_build_array(
        'http://hl7.org/fhir/StructureDefinition/DiagnosticReport'
      )
    ),
    'status', CASE
      WHEN NEW.verified_at IS NOT NULL THEN 'final'
      ELSE 'preliminary'
    END,
    'category', jsonb_build_array(
      jsonb_build_object(
        'coding', jsonb_build_array(
          jsonb_build_object(
            'system',  'http://terminology.hl7.org/CodeSystem/v2-0074',
            'code',    'LAB',
            'display', 'Laboratory'
          )
        )
      )
    ),
    'code', jsonb_build_object(
      'text', v_order_data.test_name
    ),
    'subject', jsonb_build_object(
      'reference', 'Patient/' || v_patient_id::TEXT
    ),
    'encounter', jsonb_build_object(
      'reference', 'Encounter/' || v_encounter_id::TEXT
    ),
    'effectiveDateTime', COALESCE(
      v_order_data.collected_at,
      NEW.created_at
    ),
    'issued',    NEW.verified_at,
    'result',    jsonb_build_array(
      jsonb_build_object(
        'reference', 'Observation/' || NEW.id::TEXT
      )
    ),
    'conclusion', NEW.result_value,
    'specimen', CASE
      WHEN v_order_data.specimen_type IS NOT NULL THEN
        jsonb_build_array(
          jsonb_build_object(
            'display', v_order_data.specimen_type
          )
        )
      ELSE NULL
    END
  );

  -- Queue both resources into dha_outbound_queue
  INSERT INTO public.dha_outbound_queue (
    encounter_id,
    patient_id,
    queue_type,
    insurer_type,
    payload,
    status,
    attempts
  ) VALUES (
    v_encounter_id,
    v_patient_id,
    'fhir_sync',
    NULL,
    jsonb_build_object(
      'resourceType',     'Bundle',
      'type',             'collection',
      'lab_result_id',    NEW.id,
      'lab_order_id',     NEW.lab_order_id,
      'is_critical',      v_order_data.is_critical,
      'entry', jsonb_build_array(
        jsonb_build_object('resource', v_fhir_obs),
        jsonb_build_object('resource', v_fhir_report)
      )
    ),
    'pending',
    0
  );

  RETURN NEW;
END;
$$;

-- Attach trigger to lab_results
DROP TRIGGER IF EXISTS trg_lab_result_fhir ON public.lab_results;

CREATE TRIGGER trg_lab_result_fhir
  AFTER INSERT OR UPDATE ON public.lab_results
  FOR EACH ROW
  EXECUTE FUNCTION public.queue_lab_result_fhir();

COMMENT ON FUNCTION public.queue_lab_result_fhir() IS
  'Queues FHIR R4 Observation + DiagnosticReport to dha_outbound_queue when a lab result is verified. Same pattern as trg_medication_dispense_fhir.';
