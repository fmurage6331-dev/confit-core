-- Drift fix: SHA columns on encounters that exist in live DB
-- but were never added by any migration.
-- All were supposed to be created by 20260805000000_sprint52_sha_fhir_foundation.sql

ALTER TABLE public.encounters
  ADD COLUMN IF NOT EXISTS sha_notification_number  text,
  ADD COLUMN IF NOT EXISTS insurer_type             text,
  ADD COLUMN IF NOT EXISTS insurance_policy_number  text,
  ADD COLUMN IF NOT EXISTS claim_number             text,
  ADD COLUMN IF NOT EXISTS claim_status             text,
  ADD COLUMN IF NOT EXISTS claim_submitted_at       timestamptz,
  ADD COLUMN IF NOT EXISTS claim_resolved_at        timestamptz,
  ADD COLUMN IF NOT EXISTS preauth_number           text;

COMMENT ON COLUMN public.encounters.sha_notification_number IS
  'SHA notification number issued at patient registration';
COMMENT ON COLUMN public.encounters.insurer_type IS
  'sha_shif | private | corporate';
COMMENT ON COLUMN public.encounters.claim_number IS
  'Claim reference number assigned by insurer or SHA';
COMMENT ON COLUMN public.encounters.claim_status IS
  'pending | submitted | approved | rejected | appealed | paid';
COMMENT ON COLUMN public.encounters.claim_submitted_at IS
  'Timestamp when claim was submitted to insurer/SHA';
COMMENT ON COLUMN public.encounters.claim_resolved_at IS
  'Timestamp when claim was approved or rejected';
COMMENT ON COLUMN public.encounters.preauth_number IS
  'Pre-authorisation number from insurer/SHA';
