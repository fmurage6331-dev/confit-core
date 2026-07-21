-- prescriptions.created_by / dispensed_by are bare uuids (their FKs to
-- auth.users were dropped in 20260717061653 and never re-added — same
-- gap that broke the patient_registrations FK). There's no profiles
-- table to join against for a display name, so — same pattern already
-- used for Lab/Radiology's "performed_by" — store the human-readable
-- name directly on the row at write time instead of resolving it later.

ALTER TABLE public.prescriptions
  ADD COLUMN IF NOT EXISTS prescribed_by_name text,
  ADD COLUMN IF NOT EXISTS dispensed_by_name text;
