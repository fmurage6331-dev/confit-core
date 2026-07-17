
ALTER TABLE public.access_requests DROP CONSTRAINT IF EXISTS access_requests_reviewed_by_fkey;
ALTER TABLE public.access_requests DROP CONSTRAINT IF EXISTS access_requests_user_id_fkey;
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_provider_id_fkey;
ALTER TABLE public.encounter_amendments DROP CONSTRAINT IF EXISTS encounter_amendments_created_by_fkey;
ALTER TABLE public.encounter_diagnoses DROP CONSTRAINT IF EXISTS encounter_diagnoses_created_by_fkey;
ALTER TABLE public.lab_tests DROP CONSTRAINT IF EXISTS lab_tests_created_by_fkey;
ALTER TABLE public.prescriptions DROP CONSTRAINT IF EXISTS prescriptions_dispensed_by_fkey;
ALTER TABLE public.prescriptions DROP CONSTRAINT IF EXISTS prescriptions_created_by_fkey;
ALTER TABLE public.moh_report_corrections DROP CONSTRAINT IF EXISTS moh_report_corrections_created_by_fkey;
ALTER TABLE public.moh_report_submissions DROP CONSTRAINT IF EXISTS moh_report_submissions_checked_by_fkey;
ALTER TABLE public.moh_report_submissions DROP CONSTRAINT IF EXISTS moh_report_submissions_prepared_by_fkey;
ALTER TABLE public.moh_report_submissions DROP CONSTRAINT IF EXISTS moh_report_submissions_received_by_fkey;
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey;
ALTER TABLE public.user_room_access DROP CONSTRAINT IF EXISTS user_room_access_user_id_fkey;
