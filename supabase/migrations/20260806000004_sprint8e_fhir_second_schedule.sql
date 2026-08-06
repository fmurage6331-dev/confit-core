-- Sprint 8E: Second Schedule FHIR Field Mapping
-- Digital Health (Data Exchange Component) Regulations 2025
-- Adds: UPI, SHIF number, referrals, vitals/clinical findings,
--       doctor name + council number, blood_group, allergies schema

-- ============================================================
-- 1. SCHEMA ADDITIONS — patients table
-- ============================================================
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS blood_group text,
  ADD COLUMN IF NOT EXISTS allergies   jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.patients.blood_group IS
  'DHA Second Schedule — blood group (A+/A-/B+/B-/AB+/AB-/O+/O-)';
COMMENT ON COLUMN public.patients.allergies IS
  'DHA Second Schedule — allergies list [{substance, reaction, severity}]';

-- ============================================================
-- 2. UPDATED generate_fhir_encounter()
-- Adds all Second Schedule fields achievable without lab/procedure joins
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_fhir_encounter(p_encounter_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_encounter  RECORD;
  v_diagnoses  JSONB;
  v_setting    RECORD;
  v_practitioner RECORD;
  v_fhir_json  JSONB;
  v_facility_kmhfl TEXT;
  v_facility_name  TEXT;
  v_sha_notif      TEXT;
BEGIN
  -- ── Core encounter + patient fetch ─────────────────────────
  SELECT
    e.id,
    e.status,
    e.encounter_type,
    e.is_emergency,
    e.created_at,
    e.updated_at,
    e.patient_id,
    e.sha_notification_number,
    e.sha_fund_type,
    e.insurer_type,
    e.claim_number,
    e.created_by,
    e.referral_direction,
    e.referral_out_facility,
    e.referral_out_reason,
    e.vitals,
    e.history,
    p.family_name,
    p.first_name,
    p.phone,
    p.sha_member_number,
    p.national_id,
    p.national_id_type,
    p.blood_group,
    p.allergies
  INTO v_encounter
  FROM encounters e
  JOIN patients   p ON p.id = e.patient_id
  WHERE e.id = p_encounter_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Encounter % not found', p_encounter_id;
  END IF;

  -- ── Facility settings ───────────────────────────────────────
  SELECT facility_kmhfl_code, facility_name, facility_sha_id
  INTO   v_setting
  FROM   app_settings
  WHERE  id = 'global';

  v_facility_kmhfl := COALESCE(v_setting.facility_kmhfl_code, 'UNKNOWN');
  v_facility_name  := COALESCE(v_setting.facility_name, 'AegisCare');
  v_sha_notif      := COALESCE(
    v_encounter.sha_notification_number,
    CONCAT('TEMP-SHA-', EXTRACT(EPOCH FROM NOW())::BIGINT, '-', LEFT(p_encounter_id::TEXT, 8))
  );

  -- ── Practitioner (doctor) details ──────────────────────────
  SELECT
    council_full_name,
    council_registration_number,
    council_type
  INTO v_practitioner
  FROM public.profiles
  WHERE id = v_encounter.created_by;

  -- ── ICD-11 diagnoses ───────────────────────────────────────
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'condition', jsonb_build_object(
          'reference', CONCAT('Condition/', d.id),
          'display',   d.icd11_title
        ),
        'use', jsonb_build_object(
          'coding', jsonb_build_array(
            jsonb_build_object(
              'system',  'http://terminology.hl7.org/CodeSystem/diagnosis-role',
              'code',    CASE WHEN d.diagnosis_type = 'primary' THEN 'billing' ELSE 'secondary' END,
              'display', CASE WHEN d.diagnosis_type = 'primary' THEN 'Billing Diagnosis' ELSE 'Secondary Diagnosis' END
            )
          )
        ),
        'rank',      COALESCE(d.sequence, 1),
        'extension', jsonb_build_array(
          jsonb_build_object(
            'url',      'https://health.go.ke/fhir/StructureDefinition/icd11-uri',
            'valueUri', d.icd11_uri
          )
        )
      )
      ORDER BY d.sequence
    ),
    '[]'::jsonb
  )
  INTO v_diagnoses
  FROM encounter_diagnoses d
  WHERE d.encounter_id = p_encounter_id;

  -- ── Build FHIR R4 Encounter resource ───────────────────────
  v_fhir_json := jsonb_build_object(

    'resourceType', 'Encounter',
    'id',           v_encounter.id,

    -- ── Identifiers (UPI + SHIF + SHA notification) ──
    'identifier', jsonb_build_array(
      jsonb_build_object(
        'use',    'official',
        'system', CONCAT('https://health.go.ke/facility/', v_facility_kmhfl, '/encounter-id'),
        'value',  v_encounter.id
      ),
      jsonb_build_object(
        'use',    'secondary',
        'system', 'https://sha.go.ke/ns/notification-number',
        'value',  v_sha_notif
      ),
      jsonb_build_object(
        'use',    'official',
        'system', 'https://sha.go.ke/ns/shif-member-number',
        'value',  COALESCE(v_encounter.sha_member_number, 'UNVERIFIED')
      ),
      jsonb_build_object(
        'use',    'secondary',
        'type',   jsonb_build_object(
          'coding', jsonb_build_array(
            jsonb_build_object(
              'system',  'http://terminology.hl7.org/CodeSystem/v2-0203',
              'code',    CASE
                           WHEN v_encounter.national_id_type = 'national_id'       THEN 'NI'
                           WHEN v_encounter.national_id_type = 'passport'          THEN 'PPN'
                           WHEN v_encounter.national_id_type = 'birth_certificate' THEN 'BCT'
                           ELSE 'NI'
                         END,
              'display', COALESCE(v_encounter.national_id_type, 'national_id')
            )
          )
        ),
        'system', 'https://iprs.go.ke/ns/national-id',
        'value',  COALESCE(v_encounter.national_id, 'UNVERIFIED')
      )
    ),

    -- ── Status + class ───────────────────────────────
    'status', CASE
      WHEN v_encounter.status = 'done'    THEN 'finished'
      WHEN v_encounter.status = 'waiting' THEN 'arrived'
      ELSE 'in-progress'
    END,

    'class', jsonb_build_object(
      'system',  'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      'code',    CASE
                   WHEN v_encounter.encounter_type = 'inpatient' THEN 'IMP'
                   WHEN v_encounter.is_emergency                 THEN 'EMER'
                   ELSE 'AMB'
                 END,
      'display', CASE
                   WHEN v_encounter.encounter_type = 'inpatient' THEN 'inpatient encounter'
                   WHEN v_encounter.is_emergency                 THEN 'emergency'
                   ELSE 'ambulatory'
                 END
    ),

    -- ── Service type (SHA fund) ───────────────────────
    'serviceType', jsonb_build_object(
      'coding', jsonb_build_array(
        jsonb_build_object(
          'system',  'http://dha.go.ke/fhir/CodeSystem/service-type',
          'code',    UPPER(COALESCE(v_encounter.sha_fund_type, 'phf')),
          'display', CASE
                       WHEN v_encounter.sha_fund_type = 'shif'  THEN 'SHA Social Health Insurance Fund'
                       WHEN v_encounter.sha_fund_type = 'eccif' THEN 'Emergency, Chronic and Critical Illness Fund'
                       ELSE 'Primary Healthcare Fund'
                     END
        )
      )
    ),

    -- ── Subject (patient) ─────────────────────────────
    'subject', jsonb_build_object(
      'reference', CONCAT('Patient/', v_encounter.patient_id),
      'display',   CONCAT(v_encounter.first_name, ' ', v_encounter.family_name)
    ),

    -- ── Participant (doctor + council number) ─────────
    'participant', jsonb_build_array(
      jsonb_build_object(
        'type', jsonb_build_array(
          jsonb_build_object(
            'coding', jsonb_build_array(
              jsonb_build_object(
                'system',  'http://terminology.hl7.org/CodeSystem/v3-ParticipationType',
                'code',    'ATND',
                'display', 'attender'
              )
            )
          )
        ),
        'individual', jsonb_build_object(
          'reference', CONCAT('Practitioner/', v_encounter.created_by),
          'display',   COALESCE(v_practitioner.council_full_name, 'Unknown Practitioner'),
          'identifier', jsonb_build_object(
            'system', 'https://hwr.health.go.ke/ns/council-registration',
            'value',  COALESCE(v_practitioner.council_registration_number, 'UNVERIFIED'),
            'type',   COALESCE(v_practitioner.council_type, 'UNKNOWN')
          )
        )
      )
    ),

    -- ── Period ────────────────────────────────────────
    'period', jsonb_build_object(
      'start', v_encounter.created_at,
      'end',   COALESCE(v_encounter.updated_at, v_encounter.created_at)
    ),

    -- ── ICD-11 diagnoses ──────────────────────────────
    'diagnosis', v_diagnoses,

    -- ── Referrals (hospitalization block) ────────────
    'hospitalization', CASE
      WHEN v_encounter.referral_direction IS NOT NULL
      THEN jsonb_build_object(
        'admitSource', jsonb_build_object(
          'coding', jsonb_build_array(
            jsonb_build_object(
              'system',  'http://dha.go.ke/fhir/CodeSystem/referral-direction',
              'code',    COALESCE(v_encounter.referral_direction, 'none'),
              'display', v_encounter.referral_direction
            )
          ),
          'text', COALESCE(v_encounter.referral_out_facility, '')
        ),
        'dischargeDisposition', jsonb_build_object(
          'coding', jsonb_build_array(
            jsonb_build_object(
              'system',  'http://dha.go.ke/fhir/CodeSystem/referral-reason',
              'display', COALESCE(v_encounter.referral_out_reason, '')
            )
          )
        )
      )
      ELSE '{}'::jsonb
    END,

    -- ── Service provider ──────────────────────────────
    'serviceProvider', jsonb_build_object(
      'identifier', jsonb_build_object(
        'system', 'https://kmhfl.health.go.ke',
        'value',  v_facility_kmhfl
      ),
      'display', v_facility_name
    ),

    -- ── Extensions (SHA + clinical findings + allergies + blood group) ──
    'extension', jsonb_build_array(
      jsonb_build_object(
        'url',         'http://dha.go.ke/fhir/StructureDefinition/sha-notification-number',
        'valueString', v_sha_notif
      ),
      jsonb_build_object(
        'url',         'http://dha.go.ke/fhir/StructureDefinition/sha-fund-type',
        'valueString', COALESCE(v_encounter.sha_fund_type, 'phf')
      ),
      jsonb_build_object(
        'url',         'http://dha.go.ke/fhir/StructureDefinition/clinical-findings',
        'valueString', 'Second Schedule — clinical findings',
        'extension',   jsonb_build_array(
          jsonb_build_object(
            'url',        'vitals',
            'valueString', COALESCE(v_encounter.vitals::text, '{}')
          ),
          jsonb_build_object(
            'url',        'history',
            'valueString', COALESCE(v_encounter.history::text, '{}')
          )
        )
      ),
      jsonb_build_object(
        'url',       'http://dha.go.ke/fhir/StructureDefinition/blood-group',
        'valueString', COALESCE(v_encounter.blood_group, 'unknown')
      ),
      jsonb_build_object(
        'url',      'http://dha.go.ke/fhir/StructureDefinition/allergies',
        'valueString', 'Second Schedule — allergies',
        'extension', COALESCE(v_encounter.allergies, '[]'::jsonb)
      )
    )
  );

  RETURN v_fhir_json;
END;
$$;
