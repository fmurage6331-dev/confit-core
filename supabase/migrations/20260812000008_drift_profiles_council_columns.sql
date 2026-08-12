-- Drift fix: council_* columns on profiles
-- Exist in live DB but have no migration.
-- Added by Lovable directly — documenting for transfer safety.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS council_registration_number text,
  ADD COLUMN IF NOT EXISTS council_type                text,
  ADD COLUMN IF NOT EXISTS council_verified            boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS council_verified_at         timestamptz,
  ADD COLUMN IF NOT EXISTS council_full_name           text,
  ADD COLUMN IF NOT EXISTS council_qualification       text,
  ADD COLUMN IF NOT EXISTS council_status              text;

COMMENT ON COLUMN public.profiles.council_registration_number IS
  'Professional council registration number (e.g. KMPDC, NCK, KPSEA)';
COMMENT ON COLUMN public.profiles.council_type IS
  'kmpdc | nck | kpsea | kpa | kda | other';
COMMENT ON COLUMN public.profiles.council_verified IS
  'Whether council registration has been verified';
COMMENT ON COLUMN public.profiles.council_status IS
  'active | suspended | expired | unknown';
