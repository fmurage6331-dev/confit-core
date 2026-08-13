-- Sprint 2 (G9): Add claim_subtype to sha_claims
-- FHIR Claim bundle requires subtype: 'ip' (inpatient) or 'op' (outpatient)
-- Without this field every claim bundle defaults to op — inpatient claims
-- will be incorrectly classified and rejected by DHA HIE adjudication.

ALTER TABLE public.sha_claims
  ADD COLUMN IF NOT EXISTS claim_subtype TEXT
    CHECK (claim_subtype IN ('ip', 'op'))
    NOT NULL DEFAULT 'op';

-- Back-fill existing rows from the linked encounter type
UPDATE public.sha_claims sc
SET claim_subtype = CASE
  WHEN e.encounter_type = 'inpatient' THEN 'ip'
  ELSE 'op'
END
FROM public.encounters e
WHERE e.id = sc.encounter_id;

-- Update auto_generate_sha_claim() to set claim_subtype on insert
CREATE OR REPLACE FUNCTION public.auto_generate_sha_claim()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_claim_id UUID;
  v_subtype  TEXT;
BEGIN
  -- Only fire when status transitions to 'signed'
  IF NEW.status <> 'signed' OR OLD.status = 'signed' THEN
    RETURN NEW;
  END IF;

  -- Skip if no SHA fund type
  IF NEW.sha_fund_type IS NULL THEN
    RETURN NEW;
  END IF;

  -- Determine subtype from encounter type
  v_subtype := CASE
    WHEN NEW.encounter_type = 'inpatient' THEN 'ip'
    ELSE 'op'
  END;

  -- Insert draft claim
  INSERT INTO public.sha_claims (
    encounter_id,
    patient_id,
    claim_subtype,
    status,
    sha_fund_type,
    created_at
  )
  VALUES (
    NEW.id,
    NEW.patient_id,
    v_subtype,
    'draft',
    NEW.sha_fund_type,
    NOW()
  )
  ON CONFLICT (encounter_id) DO NOTHING
  RETURNING id INTO v_claim_id;

  RETURN NEW;
END;
$$;

COMMENT ON COLUMN public.sha_claims.claim_subtype IS
  'FHIR Claim subtype: ip = inpatient, op = outpatient. Required for DHA HIE claim bundle.';
