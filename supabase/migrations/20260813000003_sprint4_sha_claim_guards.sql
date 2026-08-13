-- Sprint 4 (G8): Add guard conditions to auto_generate_sha_claim()
-- Prevents silent generation of structurally invalid draft claims when:
--   1. Patient has no cr_number (claim will be rejected by DHA HIE)
--   2. Patient has no sha_member_number (cannot identify member)
-- Also stamps claim with cr_number and sha_member_number at generation time
-- so the insurance desk can see exactly what was captured at signing.

CREATE OR REPLACE FUNCTION public.auto_generate_sha_claim()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_claim_id         UUID;
  v_subtype          TEXT;
  v_cr_number        TEXT;
  v_sha_member_no    TEXT;
BEGIN
  -- Only fire when status transitions to 'signed'
  IF NEW.status <> 'signed' OR OLD.status = 'signed' THEN
    RETURN NEW;
  END IF;

  -- Skip if no SHA fund type — not a SHA encounter
  IF NEW.sha_fund_type IS NULL THEN
    RETURN NEW;
  END IF;

  -- Fetch patient identity fields required for HIE submission
  SELECT
    cr_number,
    sha_member_number
  INTO
    v_cr_number,
    v_sha_member_no
  FROM public.patients
  WHERE id = NEW.patient_id;

  -- Determine claim subtype from encounter type
  v_subtype := CASE
    WHEN NEW.encounter_type = 'inpatient' THEN 'ip'
    ELSE 'op'
  END;

  -- Insert draft claim — include identity snapshot and validity flags
  INSERT INTO public.sha_claims (
    encounter_id,
    patient_id,
    claim_subtype,
    status,
    sha_fund_type,
    preauth_status,
    cr_number_at_claim,
    sha_member_no_at_claim,
    cr_number_missing,
    sha_member_missing,
    created_at
  )
  VALUES (
    NEW.id,
    NEW.patient_id,
    v_subtype,
    'draft',
    NEW.sha_fund_type,
    'not_required',
    v_cr_number,
    v_sha_member_no,
    (v_cr_number IS NULL),
    (v_sha_member_no IS NULL),
    NOW()
  )
  ON CONFLICT (encounter_id) DO NOTHING
  RETURNING id INTO v_claim_id;

  RETURN NEW;
END;
$$;

-- Add snapshot + validity flag columns to sha_claims
ALTER TABLE public.sha_claims
  ADD COLUMN IF NOT EXISTS cr_number_at_claim     TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS sha_member_no_at_claim TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS cr_number_missing      BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sha_member_missing     BOOLEAN NOT NULL DEFAULT FALSE;

-- Index — insurance desk can filter invalid claims instantly
CREATE INDEX IF NOT EXISTS idx_sha_claims_cr_missing
  ON public.sha_claims (cr_number_missing)
  WHERE cr_number_missing = TRUE;

CREATE INDEX IF NOT EXISTS idx_sha_claims_member_missing
  ON public.sha_claims (sha_member_missing)
  WHERE sha_member_missing = TRUE;

COMMENT ON COLUMN public.sha_claims.cr_number_at_claim IS
  'Client Registry number captured at claim generation. NULL = CR lookup not yet done — claim cannot be submitted to DHA HIE.';

COMMENT ON COLUMN public.sha_claims.sha_member_no_at_claim IS
  'SHA member number captured at claim generation. NULL = member not registered — eligibility check required.';

COMMENT ON COLUMN public.sha_claims.cr_number_missing IS
  'TRUE if cr_number was NULL at claim generation. Insurance desk must resolve before submission.';

COMMENT ON COLUMN public.sha_claims.sha_member_missing IS
  'TRUE if sha_member_number was NULL at claim generation. Insurance desk must resolve before submission.';
