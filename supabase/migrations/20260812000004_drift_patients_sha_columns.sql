-- Drift fix: SHA and identity columns on patients
-- that exist in live DB but were never added by any migration.

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS national_id                   text,
  ADD COLUMN IF NOT EXISTS national_id_type              text,
  ADD COLUMN IF NOT EXISTS sha_member_number             text,
  ADD COLUMN IF NOT EXISTS sha_relationship_to_principal text,
  ADD COLUMN IF NOT EXISTS sha_membership_status         text,
  ADD COLUMN IF NOT EXISTS sha_membership_verified_at    timestamptz,
  ADD COLUMN IF NOT EXISTS identity_verified             boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS identity_verified_at          timestamptz,
  ADD COLUMN IF NOT EXISTS identity_verified_by          uuid,
  ADD COLUMN IF NOT EXISTS photo_url                     text;

COMMENT ON COLUMN public.patients.national_id IS
  'National ID / Passport / Birth Certificate number';
COMMENT ON COLUMN public.patients.national_id_type IS
  'national_id | passport | birth_certificate | alien_id';
COMMENT ON COLUMN public.patients.sha_member_number IS
  'SHA member number (SHIF/PHC card number)';
COMMENT ON COLUMN public.patients.sha_relationship_to_principal IS
  'self | spouse | child | dependent';
COMMENT ON COLUMN public.patients.sha_membership_status IS
  'active | inactive | suspended | unknown';
COMMENT ON COLUMN public.patients.identity_verified IS
  'Whether patient identity has been verified via IPRS/biometric';
