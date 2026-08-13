-- Sprint 3 (G7): Add preauth_id + preauth_status to sha_claims
-- DHA HIE requires claims for preauth-required services to include
-- a related preauth claim ID with relationship code 'prior'.
-- This column must exist before SHA-9 (Preauth API) is built.
-- Schema is ready now — populated by SHA-9 when credentials arrive.

ALTER TABLE public.sha_claims
  ADD COLUMN IF NOT EXISTS preauth_id TEXT DEFAULT NULL;

ALTER TABLE public.sha_claims
  ADD COLUMN IF NOT EXISTS preauth_status TEXT
    CHECK (preauth_status IN (
      'not_required',
      'required_pending',
      'submitted',
      'approved',
      'rejected'
    ))
    NOT NULL DEFAULT 'not_required';

ALTER TABLE public.sha_claims
  ADD COLUMN IF NOT EXISTS preauth_submitted_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE public.sha_claims
  ADD COLUMN IF NOT EXISTS preauth_approved_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE public.sha_claims
  ADD COLUMN IF NOT EXISTS preauth_notes TEXT DEFAULT NULL;

-- Index for fast lookup of claims awaiting preauth
CREATE INDEX IF NOT EXISTS idx_sha_claims_preauth_status
  ON public.sha_claims (preauth_status)
  WHERE preauth_status IN ('required_pending', 'submitted');

COMMENT ON COLUMN public.sha_claims.preauth_id IS
  'DHA preauth claim ID returned by the Preauth API (SHA-9). Required in FHIR Claim.related for preauth-required services.';

COMMENT ON COLUMN public.sha_claims.preauth_status IS
  'Tracks preauth lifecycle: not_required | required_pending | submitted | approved | rejected.';

COMMENT ON COLUMN public.sha_claims.preauth_submitted_at IS
  'Timestamp when preauth request was submitted to DHA HIE.';

COMMENT ON COLUMN public.sha_claims.preauth_approved_at IS
  'Timestamp when DHA HIE approved the preauth request.';

COMMENT ON COLUMN public.sha_claims.preauth_notes IS
  'Any notes or rejection reasons from DHA HIE regarding preauth.';

-- Fix: preauth_status column existed without default/NOT NULL — apply explicitly
ALTER TABLE public.sha_claims
  ALTER COLUMN preauth_status SET DEFAULT 'not_required';

UPDATE public.sha_claims
  SET preauth_status = 'not_required'
  WHERE preauth_status IS NULL;

ALTER TABLE public.sha_claims
  ALTER COLUMN preauth_status SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'sha_claims'
      AND constraint_name = 'sha_claims_preauth_status_check'
  ) THEN
    ALTER TABLE public.sha_claims
      ADD CONSTRAINT sha_claims_preauth_status_check
      CHECK (preauth_status IN (
        'not_required',
        'required_pending',
        'submitted',
        'approved',
        'rejected'
      ));
  END IF;
END;
$$;
