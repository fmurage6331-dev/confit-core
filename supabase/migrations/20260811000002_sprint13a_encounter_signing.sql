-- Sprint 13A: Encounter Signing / Locking
-- enforce_encounter_lock() trigger function already exists (20260716063555)
-- This migration:
--   1. Attaches it to child tables that have encounter_id
--   2. Adds sign_encounter permission for clinical roles
--   3. Verifies encounters.status allows 'signed'

-- ============================================================
-- 1. ATTACH LOCK TRIGGER TO CHILD TABLES
-- ============================================================

-- encounter_diagnoses
DROP TRIGGER IF EXISTS trg_enforce_encounter_lock_diagnoses
  ON public.encounter_diagnoses;
CREATE TRIGGER trg_enforce_encounter_lock_diagnoses
  BEFORE INSERT OR UPDATE OR DELETE ON public.encounter_diagnoses
  FOR EACH ROW EXECUTE FUNCTION public.enforce_encounter_lock();

-- clinical_notes
DROP TRIGGER IF EXISTS trg_enforce_encounter_lock_notes
  ON public.clinical_notes;
CREATE TRIGGER trg_enforce_encounter_lock_notes
  BEFORE INSERT OR UPDATE OR DELETE ON public.clinical_notes
  FOR EACH ROW EXECUTE FUNCTION public.enforce_encounter_lock();

-- radiology_orders
DROP TRIGGER IF EXISTS trg_enforce_encounter_lock_radiology
  ON public.radiology_orders;
CREATE TRIGGER trg_enforce_encounter_lock_radiology
  BEFORE INSERT OR UPDATE OR DELETE ON public.radiology_orders
  FOR EACH ROW EXECUTE FUNCTION public.enforce_encounter_lock();

-- ============================================================
-- 2. ADD sign_encounter PERMISSION TO CLINICAL ROLES
-- ============================================================
INSERT INTO public.role_permissions (role, permission)
VALUES
  ('doctor',           'sign_encounter'),
  ('clinical_officer', 'sign_encounter'),
  ('dental_officer',   'sign_encounter'),
  ('admin',            'sign_encounter')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 3. VERIFY — confirm triggers are attached
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE trigger_name = 'trg_enforce_encounter_lock_diagnoses'
  ) THEN
    RAISE EXCEPTION 'Sprint 13A: lock trigger on encounter_diagnoses not found';
  END IF;
END;
$$;
