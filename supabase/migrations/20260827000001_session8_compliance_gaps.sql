-- ============================================================================
-- Session 8 — Compliance gaps implementation
-- Date: 2026-08-27
-- Covers: ICU charges fix, security hardening, GAPs 7/8/13/16/18/19
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Fix accrue_daily_icu_charges (beds.ward_id — no room_id on beds)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.accrue_daily_icu_charges()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  _adm        RECORD;
  _invoice_id uuid;
  _price      numeric;
  _name       text;
  _charge_id  uuid := 'cec4253d-6fbb-4e09-8718-49145931c10d';
  _icu_ward   uuid := 'c7fe0794-a5f4-438d-bcc3-a3e4ff04333e';
BEGIN
  SELECT COALESCE(cash_price, price, 0), COALESCE(name, 'ICU Daily Charge')
  INTO _price, _name
  FROM public.lab_test_catalog
  WHERE id = _charge_id;

  FOR _adm IN
    SELECT a.id AS admission_id, a.encounter_id
    FROM public.admissions a
    JOIN public.beds b ON b.id = a.bed_id
    WHERE a.status  = 'admitted'
      AND b.ward_id = _icu_ward
  LOOP
    SELECT id INTO _invoice_id
    FROM public.invoices
    WHERE encounter_id = _adm.encounter_id
    ORDER BY created_at ASC LIMIT 1;

    IF _invoice_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.invoice_line_items
        WHERE invoice_id = _invoice_id
          AND item_type  = 'icu_day'
          AND source_id  = _adm.admission_id
          AND created_at::date = CURRENT_DATE
      ) THEN
        INSERT INTO public.invoice_line_items (
          invoice_id, encounter_id, item_type,
          source_id, description, quantity, unit_price, amount
        ) VALUES (
          _invoice_id, _adm.encounter_id, 'icu_day',
          _adm.admission_id,
          _name || ' - ICU daily charge (' || to_char(now(), 'YYYY-MM-DD') || ')',
          1, _price, _price
        );
      END IF;
    END IF;
  END LOOP;
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. Security: Enable RLS on facility_features
-- ----------------------------------------------------------------------------
ALTER TABLE public.facility_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facility_features FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth users facility_features"
  ON public.facility_features;

CREATE POLICY "auth users facility_features"
  ON public.facility_features
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- ----------------------------------------------------------------------------
-- 3. Security: Set security_invoker on views
-- ----------------------------------------------------------------------------
ALTER VIEW public.sha_claims_aging        SET (security_invoker = true);
ALTER VIEW public.patient_registrations   SET (security_invoker = true);
ALTER VIEW public.daily_patient_census    SET (security_invoker = true);

-- ----------------------------------------------------------------------------
-- 4. GAP 18: Audit log immutability
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.block_audit_log_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RAISE EXCEPTION
    'audit_log records are immutable and cannot be modified or deleted. Table: %',
    TG_TABLE_NAME;
END;
$$;

DROP TRIGGER IF EXISTS trg_immutable_audit_log
  ON public.audit_log;
CREATE TRIGGER trg_immutable_audit_log
  BEFORE UPDATE OR DELETE ON public.audit_log
  FOR EACH ROW
  EXECUTE FUNCTION public.block_audit_log_modification();

DROP TRIGGER IF EXISTS trg_immutable_audit_archive
  ON public.audit_log_archive;
CREATE TRIGGER trg_immutable_audit_archive
  BEFORE UPDATE OR DELETE ON public.audit_log_archive
  FOR EACH ROW
  EXECUTE FUNCTION public.block_audit_log_modification();

-- ----------------------------------------------------------------------------
-- 5. GAP 7: PHF zero total — hard enforce
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_phf_zero_claim()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.fund_type = 'PHF' THEN
    NEW.total_amount    := 0;
    NEW.approved_amount := 0;
    NEW.notes := COALESCE(NEW.notes, '')
      || CASE
           WHEN POSITION(
                  '[PHF: zero total — SHA covers 100%]'
                  IN COALESCE(NEW.notes, '')
                ) > 0
           THEN ''
           ELSE ' [PHF: zero total — SHA covers 100%]'
         END;
  END IF;
  RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- 6. GAP 8: SHA claim submission validation with HWR check
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_sha_claim_for_submission(
  p_claim_id  uuid,
  p_user_id   uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_errors  jsonb := '[]'::jsonb;
  v_rec     RECORD;
  v_claim   RECORD;
  v_profile RECORD;
BEGIN
  SELECT * INTO v_claim
  FROM public.sha_claims WHERE id = p_claim_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'valid', false,
      'errors', '["Claim not found"]'::jsonb,
      'claim_id', p_claim_id
    );
  END IF;

  -- 1. HWR council verification
  IF p_user_id IS NOT NULL THEN
    SELECT * INTO v_profile
    FROM public.profiles WHERE id = p_user_id;

    IF NOT FOUND THEN
      v_errors := v_errors ||
        '["Submitting user profile not found"]'::jsonb;
    ELSIF COALESCE(v_profile.council_verified, false) = false THEN
      v_errors := v_errors ||
        '["Submitting clinician is not HWR council-verified. Update profile in Account Settings."]'::jsonb;
    ELSIF v_profile.council_registration_number IS NULL
          OR trim(v_profile.council_registration_number) = '' THEN
      v_errors := v_errors ||
        '["Submitting clinician has no council registration number on file."]'::jsonb;
    ELSIF v_profile.council_expiry_date IS NOT NULL
          AND v_profile.council_expiry_date < CURRENT_DATE THEN
      v_errors := v_errors || format(
        '["Clinician council registration expired on %s. Renew before submitting claims."]',
        v_profile.council_expiry_date
      )::jsonb;
    ELSIF COALESCE(v_profile.council_status, '')
          NOT IN ('active', 'Active', 'ACTIVE') THEN
      v_errors := v_errors || format(
        '["Clinician council status is %s — must be Active to submit claims."]',
        COALESCE(v_profile.council_status, 'unknown')
      )::jsonb;
    END IF;
  ELSE
    v_errors := v_errors ||
      '["Warning: no submitting user provided — HWR check skipped"]'::jsonb;
  END IF;

  -- 2. ICD-11 diagnosis
  IF NOT EXISTS (
    SELECT 1 FROM public.encounter_diagnoses
    WHERE encounter_id = v_claim.encounter_id
  ) THEN
    v_errors := v_errors ||
      '["Missing ICD-11 diagnosis on encounter"]'::jsonb;
  END IF;

  -- 3. Intervention codes on all included items
  FOR v_rec IN
    SELECT id, description, intervention_code
    FROM public.sha_claim_items
    WHERE claim_id = p_claim_id AND is_included = true
  LOOP
    IF v_rec.intervention_code IS NULL
       OR trim(v_rec.intervention_code) = '' THEN
      v_errors := v_errors || format(
        '["Missing intervention_code on item: %s"]',
        COALESCE(v_rec.description, v_rec.id::text)
      )::jsonb;
    END IF;
  END LOOP;

  -- 4. CR number
  IF v_claim.cr_number_missing = true
     OR v_claim.cr_number_at_claim IS NULL THEN
    v_errors := v_errors ||
      '["CR number missing — resolve before submission"]'::jsonb;
  END IF;

  -- 5. SHA member number
  IF v_claim.sha_member_missing = true
     OR v_claim.sha_member_no_at_claim IS NULL THEN
    v_errors := v_errors ||
      '["SHA member number missing"]'::jsonb;
  END IF;

  -- 6. PHF zero total
  IF v_claim.fund_type = 'PHF'
     AND COALESCE(v_claim.total_amount, 0) != 0 THEN
    v_errors := v_errors ||
      '["PHC/PHF claim total_amount must be zero before submission"]'::jsonb;
  END IF;

  -- 7. FHIR bundle built
  IF v_claim.fhir_bundle IS NULL THEN
    v_errors := v_errors ||
      '["FHIR bundle not yet built — trigger build_fhir_claim first"]'::jsonb;
  END IF;

  -- 8. OTP consent verified
  IF COALESCE(v_claim.otp_verified, false) = false THEN
    v_errors := v_errors ||
      '["Patient OTP consent not verified"]'::jsonb;
  END IF;

  -- 9. At least one included item
  IF NOT EXISTS (
    SELECT 1 FROM public.sha_claim_items
    WHERE claim_id = p_claim_id AND is_included = true
  ) THEN
    v_errors := v_errors ||
      '["Claim has no included items"]'::jsonb;
  END IF;

  RETURN jsonb_build_object(
    'valid',     jsonb_array_length(v_errors) = 0,
    'errors',    v_errors,
    'claim_id',  p_claim_id,
    'fund_type', v_claim.fund_type,
    'status',    v_claim.status,
    'hwr_note',  CASE
                   WHEN p_user_id IS NULL
                   THEN 'HWR credentials pending — live DHA HWR check will be added once credentials received'
                   ELSE 'HWR check performed against local council registry'
                 END
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 7. GAP 16: Data retention policy
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.data_retention_policy (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name           text NOT NULL UNIQUE,
  retention_years      integer NOT NULL,
  archival_destination text,
  legal_basis          text,
  last_reviewed        date DEFAULT CURRENT_DATE,
  notes                text,
  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now()
);

ALTER TABLE public.data_retention_policy ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth users retention policy"
  ON public.data_retention_policy;
CREATE POLICY "auth users retention policy"
  ON public.data_retention_policy
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

INSERT INTO public.data_retention_policy
  (table_name, retention_years, archival_destination, legal_basis, notes)
VALUES
  ('patients',              20,'audit_log_archive','Digital Health Act 2023 s.31','Full patient record 20 years'),
  ('encounters',            20,'audit_log_archive','Health Information Management Procedures Regs 2025','All encounters 20 years'),
  ('clinical_notes',        20,'audit_log_archive','Health Information Management Procedures Regs 2025','Clinical notes 20 years'),
  ('lab_results',           20,'audit_log_archive','Health Information Management Procedures Regs 2025','Lab results 20 years'),
  ('radiology_results',     20,'audit_log_archive','Health Information Management Procedures Regs 2025','Radiology results 20 years'),
  ('prescriptions',         20,'audit_log_archive','Health Information Management Procedures Regs 2025','Prescriptions 20 years'),
  ('admissions',            20,'audit_log_archive','Health Information Management Procedures Regs 2025','Admissions 20 years'),
  ('audit_log',             20,'audit_log_archive','Digital Health Act 2023; Data Protection Act 2019','Tamper-evident — immutable'),
  ('audit_log_archive',     20,'off_site_backup','Digital Health Act 2023','Off-site backup required'),
  ('sha_claims',            10,'audit_log_archive','Social Health Insurance Act 2023','SHA claims 10 years'),
  ('sha_claim_items',       10,'audit_log_archive','Social Health Insurance Act 2023','Claim items 10 years'),
  ('sha_claim_status_history',10,'audit_log_archive','Social Health Insurance Act 2023','Status history 10 years'),
  ('invoices',              10,'audit_log_archive','Kenya Finance Act; Income Tax Act','Financial records 10 years'),
  ('invoice_line_items',    10,'audit_log_archive','Kenya Finance Act','Line items 10 years'),
  ('invoice_payments',      10,'audit_log_archive','Kenya Finance Act','Payments 10 years'),
  ('mortuary_records',      20,'audit_log_archive','Health Information Management Procedures Regs 2025','Mortuary/death 20 years'),
  ('ward_transfers',        20,'audit_log_archive','Health Information Management Procedures Regs 2025','Ward transfers 20 years'),
  ('patient_consents',       7,'audit_log_archive','Data Protection Act 2019','Consent records 7 years'),
  ('consent_otps',           7,'audit_log_archive','Data Protection Act 2019','OTP records 7 years'),
  ('dsar_requests',          7,'audit_log_archive','Data Protection Act 2019','DSAR records 7 years')
ON CONFLICT (table_name) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 8. GAP 19: DSAR request tracking
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dsar_requests (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id     uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  request_type   text NOT NULL
                   CHECK (request_type IN (
                     'export','delete','rectify','restrict','object'
                   )),
  requested_by   uuid REFERENCES auth.users(id),
  requested_at   timestamptz NOT NULL DEFAULT now(),
  due_date       date,
  completed_at   timestamptz,
  status         text NOT NULL DEFAULT 'pending'
                   CHECK (status IN (
                     'pending','in_progress','completed','refused','extended'
                   )),
  refused_reason text,
  notes          text,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.set_dsar_defaults()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  IF NEW.due_date IS NULL THEN
    NEW.due_date := (NEW.requested_at + INTERVAL '30 days')::date;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dsar_defaults ON public.dsar_requests;
CREATE TRIGGER trg_dsar_defaults
  BEFORE INSERT OR UPDATE ON public.dsar_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_dsar_defaults();

ALTER TABLE public.dsar_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth users dsar" ON public.dsar_requests;
CREATE POLICY "auth users dsar"
  ON public.dsar_requests
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS audit_dsar_requests ON public.dsar_requests;
CREATE TRIGGER audit_dsar_requests
  AFTER INSERT OR UPDATE OR DELETE ON public.dsar_requests
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

CREATE OR REPLACE VIEW public.dsar_overdue
WITH (security_invoker = true)
AS
SELECT
  d.id,
  d.request_type,
  d.status,
  d.requested_at,
  d.due_date,
  CURRENT_DATE - d.due_date AS days_overdue,
  p.patient_name,
  p.file_number,
  p.phone
FROM public.dsar_requests d
LEFT JOIN public.patients p ON p.id = d.patient_id
WHERE d.status NOT IN ('completed','refused')
  AND d.due_date < CURRENT_DATE
ORDER BY d.due_date ASC;