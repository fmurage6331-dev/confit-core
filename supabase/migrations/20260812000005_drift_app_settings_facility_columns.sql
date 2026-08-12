-- Drift fix: facility columns on app_settings
-- Should have been created by 20260730130000_dha_fhir_facility_settings.sql
-- which was committed as an empty (0-byte) file.

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS facility_name          text,
  ADD COLUMN IF NOT EXISTS facility_kmhfl_code    text,
  ADD COLUMN IF NOT EXISTS facility_sha_id        text,
  ADD COLUMN IF NOT EXISTS facility_sha_provider_no text,
  ADD COLUMN IF NOT EXISTS facility_county        text,
  ADD COLUMN IF NOT EXISTS facility_address       text,
  ADD COLUMN IF NOT EXISTS facility_phone         text,
  ADD COLUMN IF NOT EXISTS facility_email         text,
  ADD COLUMN IF NOT EXISTS facility_level         smallint;

COMMENT ON COLUMN public.app_settings.facility_kmhfl_code IS
  'KMHFL facility code — used as X-Facility-Id in DHA API calls';
COMMENT ON COLUMN public.app_settings.facility_sha_id IS
  'DHA Facility Registry ID — assigned after FR lookup';
COMMENT ON COLUMN public.app_settings.facility_sha_provider_no IS
  'SHA provider number for billing';
COMMENT ON COLUMN public.app_settings.facility_level IS
  'MOH facility level: 1=Community, 2=Dispensary, 3=Health Centre, 4=Hospital, 5=Referral, 6=National';
