-- ═══════════════════════════════════════════════════════════════
-- Sprint 5.2 + 6 Foundation Migration
-- Date: 2026-08-05
-- Description:
--   - sha_fund_type on encounters (phf/shif/eccif)
--   - facility_level on app_settings
--   - sha_tariffs table + 18 seeded tariffs (Legal Notice 146/147)
--   - set_sha_fund_type() trigger on encounters
--   - patient_registrations view updated (includes sha_fund_type)
--   - generate_fhir_encounter() PL/pgSQL FHIR R4 RPC
--   - consent_otps table (SHA-256 hashed, 10-min expiry)
--   - audit_log RLS hardening (append-only)
-- ═══════════════════════════════════════════════════════════════

-- 1. sha_fund_type on encounters
ALTER TABLE encounters
  ADD COLUMN IF NOT EXISTS sha_fund_type TEXT
    DEFAULT 'phf'
    CHECK (sha_fund_type IN ('phf', 'shif', 'eccif'));

-- 2. facility_level on app_settings
ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS facility_level SMALLINT DEFAULT 3;

-- 3. sha_tariffs table
CREATE TABLE IF NOT EXISTS sha_tariffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_code VARCHAR(100) NOT NULL,
  service_description TEXT,
  fund_type VARCHAR(20)
    CHECK (fund_type IN ('phf', 'shif', 'eccif')),
  tariff_amount NUMERIC(12, 2) NOT NULL,
  effective_date_start DATE NOT NULL,
  effective_date_end DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sha_tariffs_service_code
  ON sha_tariffs (service_code);
CREATE INDEX IF NOT EXISTS idx_sha_tariffs_fund_type
  ON sha_tariffs (fund_type);
CREATE INDEX IF NOT EXISTS idx_sha_tariffs_effective
  ON sha_tariffs (effective_date_start, effective_date_end);

ALTER TABLE sha_tariffs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "approved users can read tariffs"
  ON sha_tariffs FOR SELECT
  USING (public.is_approved(auth.uid()));

-- 4. Seed SHA tariffs (Legal Notice No. 146 & 147)
INSERT INTO sha_tariffs (
  service_code, service_description,
  fund_type, tariff_amount,
  effective_date_start
) VALUES
  ('SHA-PHF-OP-01',    'Standard Outpatient Consultation',       'phf',   0.00,     '2024-10-01'),
  ('SHA-PHF-ANC-02',   'ANC Visit (Antenatal Care)',              'phf',   0.00,     '2024-10-01'),
  ('SHA-PHF-LAB-01',   'Full Blood Count (FBC)',                  'phf',   0.00,     '2024-10-01'),
  ('SHA-PHF-LAB-02',   'Malaria RDT / Urinalysis',               'phf',   0.00,     '2024-10-01'),
  ('SHA-PHF-LAB-03',   'Blood Glucose',                          'phf',   0.00,     '2024-10-01'),
  ('SHA-PHF-LAB-04',   'HIV Screening',                          'phf',   0.00,     '2024-10-01'),
  ('SHA-PHF-LAB-05',   'TB Screening (GeneXpert)',               'phf',   0.00,     '2024-10-01'),
  ('SHA-SHIF-MAT-01',  'Normal Delivery (Level 3)',              'shif',  10000.00, '2024-10-01'),
  ('SHA-SHIF-RAD-01',  'Chest X-Ray',                           'shif',   1200.00, '2024-10-01'),
  ('SHA-SHIF-RAD-02',  'Abdominal Ultrasound',                  'shif',   2000.00, '2024-10-01'),
  ('SHA-SHIF-LAB-01',  'Kidney Function Test',                  'shif',   1500.00, '2024-10-01'),
  ('SHA-SHIF-LAB-02',  'Liver Function Test',                   'shif',   1500.00, '2024-10-01'),
  ('SHA-SHIF-LAB-03',  'CD4 Count',                             'shif',   1800.00, '2024-10-01'),
  ('SHA-SHIF-LAB-04',  'Lipid Profile',                         'shif',   1200.00, '2024-10-01'),
  ('SHA-SHIF-ADM-01',  'Inpatient Admission (per day Level 3)', 'shif',   3000.00, '2024-10-01'),
  ('SHA-ECCIF-EMG-01', 'Emergency Stabilization / Critical Care','eccif', 20000.00, '2024-10-01'),
  ('SHA-ECCIF-ICU-01', 'ICU / HDU Daily Rate',                  'eccif', 15000.00, '2024-10-01'),
  ('SHA-ECCIF-SURG-01','Emergency Surgical Procedure',          'eccif', 50000.00, '2024-10-01')
ON CONFLICT DO NOTHING;

-- 5. Auto-detect sha_fund_type trigger
CREATE OR REPLACE FUNCTION set_sha_fund_type()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_emergency = true THEN
    NEW.sha_fund_type := 'eccif';
  ELSIF NEW.encounter_type = 'inpatient' THEN
    NEW.sha_fund_type := 'shif';
  ELSE
    NEW.sha_fund_type := 'phf';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_set_sha_fund_type
  BEFORE INSERT ON encounters
  FOR EACH ROW
  WHEN (NEW.sha_fund_type IS NULL)
  EXECUTE FUNCTION set_sha_fund_type();

-- 6. Update patient_registrations view
DROP VIEW IF EXISTS patient_registrations;

CREATE VIEW patient_registrations AS
SELECT
  e.id,
  p.patient_name,
  p.date_of_birth,
  p.phone,
  p.file_number,
  e.payment_mode,
  e.insurance_provider_id,
  e.insurance_coverage_percentage,
  e.tests,
  e.subtotal,
  e.insurance_covered,
  e.patient_due,
  e.status,
  e.notes,
  e.created_by,
  e.created_at,
  e.updated_at,
  e.payment_status,
  e.amount_paid,
  e.paid_at,
  e.paid_by,
  e.payment_method,
  e.payment_reference,
  e.from_room,
  e.current_room_id,
  p.first_name,
  p.middle_name,
  p.family_name,
  p.sex,
  p.dob_known,
  p.estimated_age,
  p.email,
  p.address_line1,
  p.address_line2,
  p.city,
  p.county,
  p.postal_code,
  p.country,
  p.occupation,
  p.marital_status,
  p.nationality,
  p.religion,
  p.education_level,
  p.is_deceased,
  p.date_of_death,
  p.cause_of_death,
  p.relationships,
  p.next_of_kin,
  e.vitals,
  e.history,
  e.diagnoses,
  e.next_room_id,
  e.acknowledged_by,
  e.acknowledged_at,
  e.patient_id,
  e.is_emergency,
  e.referral_direction,
  e.referral_out_facility,
  e.referral_out_reason,
  e.insurance_policy_number,
  e.sha_notification_number,
  e.insurer_type,
  e.claim_number,
  e.preauth_number,
  e.claim_status,
  e.claim_submitted_at,
  e.claim_resolved_at,
  e.sha_fund_type,
  p.sha_member_number,
  p.sha_relationship_to_principal,
  p.national_id,
  p.national_id_type
FROM encounters e
JOIN patients p ON p.id = e.patient_id;

-- 7. generate_fhir_encounter PL/pgSQL RPC
CREATE OR REPLACE FUNCTION public.generate_fhir_encounter(p_encounter_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_encounter RECORD;
  v_diagnoses JSONB;
  v_setting   RECORD;
  v_fhir_json JSONB;
  v_facility_kmhfl TEXT;
  v_facility_name  TEXT;
  v_sha_notif      TEXT;
BEGIN
  SELECT
    e.id, e.status, e.encounter_type, e.is_emergency,
    e.created_at, e.updated_at, e.patient_id,
    e.sha_notification_number, e.sha_fund_type,
    e.insurer_type, e.claim_number, e.created_by,
    e.referral_direction, e.referral_out_facility,
    p.family_name, p.first_name, p.phone,
    p.sha_member_number
  INTO v_encounter
  FROM encounters e
  JOIN patients p ON p.id = e.patient_id
  WHERE e.id = p_encounter_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Encounter % not found', p_encounter_id;
  END IF;

  SELECT facility_kmhfl_code, facility_name, facility_sha_id
  INTO v_setting
  FROM app_settings
  WHERE id = 'global';

  v_facility_kmhfl := COALESCE(v_setting.facility_kmhfl_code, 'UNKNOWN');
  v_facility_name  := COALESCE(v_setting.facility_name, 'AegisCare');

  v_sha_notif := COALESCE(
    v_encounter.sha_notification_number,
    CONCAT('TEMP-SHA-', EXTRACT(EPOCH FROM NOW())::BIGINT,
           '-', LEFT(p_encounter_id::TEXT, 8))
  );

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'condition', jsonb_build_object(
          'reference', CONCAT('Condition/', d.id),
          'display', d.icd11_title
        ),
        'use', jsonb_build_object(
          'coding', jsonb_build_array(
            jsonb_build_object(
              'system',
              'http://terminology.hl7.org/CodeSystem/diagnosis-role',
              'code',
              CASE WHEN d.diagnosis_type = 'primary'
                   THEN 'billing' ELSE 'secondary' END,
              'display',
              CASE WHEN d.diagnosis_type = 'primary'
                   THEN 'Billing Diagnosis' ELSE 'Secondary Diagnosis' END
            )
          )
        ),
        'rank', COALESCE(d.sequence, 1),
        'extension', jsonb_build_array(
          jsonb_build_object(
            'url',
            'https://health.go.ke/fhir/StructureDefinition/icd11-uri',
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

  v_fhir_json := jsonb_build_object(
    'resourceType', 'Encounter',
    'id', v_encounter.id,
    'identifier', jsonb_build_array(
      jsonb_build_object(
        'use', 'official',
        'system', CONCAT('https://health.go.ke/facility/',
                         v_facility_kmhfl, '/encounter-id'),
        'value', v_encounter.id
      ),
      jsonb_build_object(
        'use', 'secondary',
        'system', 'https://sha.go.ke/ns/notification-number',
        'value', v_sha_notif
      )
    ),
    'status', CASE
      WHEN v_encounter.status = 'done'    THEN 'finished'
      WHEN v_encounter.status = 'waiting' THEN 'arrived'
      ELSE 'in-progress'
    END,
    'class', jsonb_build_object(
      'system',
      'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      'code', CASE
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
    'serviceType', jsonb_build_object(
      'coding', jsonb_build_array(
        jsonb_build_object(
          'system', 'http://dha.go.ke/fhir/CodeSystem/service-type',
          'code', UPPER(COALESCE(v_encounter.sha_fund_type, 'phf')),
          'display', CASE
            WHEN v_encounter.sha_fund_type = 'shif'
              THEN 'SHA Social Health Insurance Fund'
            WHEN v_encounter.sha_fund_type = 'eccif'
              THEN 'Emergency, Chronic and Critical Illness Fund'
            ELSE 'Primary Healthcare Fund'
          END
        )
      )
    ),
    'subject', jsonb_build_object(
      'reference', CONCAT('Patient/', v_encounter.patient_id),
      'display',   CONCAT(v_encounter.first_name, ' ',
                          v_encounter.family_name)
    ),
    'participant', jsonb_build_array(
      jsonb_build_object(
        'type', jsonb_build_array(
          jsonb_build_object(
            'coding', jsonb_build_array(
              jsonb_build_object(
                'system',
                'http://terminology.hl7.org/CodeSystem/v3-ParticipationType',
                'code', 'ATND',
                'display', 'attender'
              )
            )
          )
        ),
        'individual', jsonb_build_object(
          'reference', CONCAT('Practitioner/', v_encounter.created_by)
        )
      )
    ),
    'period', jsonb_build_object(
      'start', v_encounter.created_at,
      'end',   COALESCE(v_encounter.updated_at, v_encounter.created_at)
    ),
    'diagnosis', v_diagnoses,
    'serviceProvider', jsonb_build_object(
      'identifier', jsonb_build_object(
        'system', 'https://kmhfl.health.go.ke',
        'value',  v_facility_kmhfl
      ),
      'display', v_facility_name
    ),
    'extension', jsonb_build_array(
      jsonb_build_object(
        'url',
        'http://dha.go.ke/fhir/StructureDefinition/sha-notification-number',
        'valueString', v_sha_notif
      ),
      jsonb_build_object(
        'url',
        'http://dha.go.ke/fhir/StructureDefinition/sha-fund-type',
        'valueString', COALESCE(v_encounter.sha_fund_type, 'phf')
      )
    )
  );

  RETURN v_fhir_json;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_fhir_encounter(UUID)
  TO authenticated, anon;

-- 8. consent_otps table
CREATE TABLE IF NOT EXISTS consent_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id),
  encounter_id UUID REFERENCES encounters(id),
  phone TEXT NOT NULL,
  otp_hash TEXT NOT NULL,
  consent_type TEXT NOT NULL,
  verified BOOLEAN DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  receptionist_user_id UUID REFERENCES auth.users(id),
  delivery_status TEXT DEFAULT 'pending'
    CHECK (delivery_status IN ('pending','sent','failed','verified')),
  override_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_consent_otps_patient
  ON consent_otps (patient_id);
CREATE INDEX IF NOT EXISTS idx_consent_otps_expires
  ON consent_otps (expires_at);

ALTER TABLE consent_otps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "approved users can read otps"
  ON consent_otps FOR SELECT
  USING (public.is_approved(auth.uid()));
CREATE POLICY "approved users can insert otps"
  ON consent_otps FOR INSERT
  WITH CHECK (public.is_approved(auth.uid()));
CREATE POLICY "approved users can update otps"
  ON consent_otps FOR UPDATE
  USING (public.is_approved(auth.uid()));

-- 9. Audit log hardening (append-only)
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_log_select_policy
  ON audit_log FOR SELECT USING (true);
CREATE POLICY audit_log_insert_policy
  ON audit_log FOR INSERT WITH CHECK (true);
CREATE POLICY audit_log_deny_update
  ON audit_log FOR UPDATE USING (false);
CREATE POLICY audit_log_deny_delete
  ON audit_log FOR DELETE USING (false);
