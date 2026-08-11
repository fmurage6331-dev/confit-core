-- Security Hardening Migration
-- Fixes all Lovable security scan findings

-- ============================================================
-- 1. AUDIT LOG — Fix permissive policies
-- ============================================================
-- Drop permissive public INSERT policies
DROP POLICY IF EXISTS "System insert audit_log" ON public.audit_log;
DROP POLICY IF EXISTS "audit_log_insert_policy" ON public.audit_log;
-- Drop permissive public SELECT policy
DROP POLICY IF EXISTS "audit_log_select_policy" ON public.audit_log;

-- Restrict INSERT to authenticated only (triggers use SECURITY DEFINER — bypass RLS)
CREATE POLICY "audit_log_insert_authenticated"
  ON public.audit_log FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Admin-only SELECT already exists — keep it
-- "Admin view audit_log" policy retained

-- ============================================================
-- 2. PROFILES — Restrict SELECT to authenticated
-- ============================================================
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;

CREATE POLICY "profiles_select_authenticated"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================
-- 3. MOH 705 DISEASE MAPPINGS — Restrict to authenticated
-- ============================================================
DROP POLICY IF EXISTS "Allow public read access to MOH 705 disease mappings"
  ON public.moh_705_disease_mappings;

CREATE POLICY "moh_705_disease_mappings_authenticated"
  ON public.moh_705_disease_mappings FOR SELECT
  TO authenticated
  USING (public.is_approved(auth.uid()));

-- ============================================================
-- 4. STOCK STORE USAGE VIEW — Remove auth.users join
-- Rebuild without exposing auth.users to PostgREST
-- ============================================================
DROP VIEW IF EXISTS public.stock_store_usage_view;

CREATE VIEW public.stock_store_usage_view AS
SELECT
  su.id,
  su.location_id,
  sl.name       AS location_name,
  su.item_id,
  si.name       AS item_name,
  si.category,
  si.kind,
  si.unit,
  su.encounter_id,
  su.quantity,
  su.reason,
  su.used_by,
  su.used_at,
  su.notes,
  su.created_at
FROM stock_usage su
JOIN stock_locations sl ON sl.id = su.location_id
JOIN stock_items     si ON si.id = su.item_id;

-- ============================================================
-- 5. REVOKE ANON EXECUTE ON SECURITY DEFINER FUNCTIONS
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.generate_fhir_encounter(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_moh_705_report FROM anon;
REVOKE EXECUTE ON FUNCTION public.validate_and_get_icd11(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.verify_patient_identity FROM anon;
REVOKE EXECUTE ON FUNCTION public.verify_practitioner FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_contracted_price FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_encounter_from_appointment(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.enforce_encounter_lock() FROM anon;

-- ============================================================
-- 6. FIX MUTABLE SEARCH_PATH ON SECURITY DEFINER FUNCTIONS
-- ============================================================
ALTER FUNCTION public.audit_dha_outbound_queue()
  SET search_path = public;

ALTER FUNCTION public.audit_patient_consents()
  SET search_path = public;

ALTER FUNCTION public.audit_trigger_fn()
  SET search_path = public;

ALTER FUNCTION public.clean_and_validate_diagnosis_insert()
  SET search_path = public;

ALTER FUNCTION public.create_encounter_from_appointment(uuid)
  SET search_path = public;

ALTER FUNCTION public.enforce_encounter_lock()
  SET search_path = public;

ALTER FUNCTION public.generate_fhir_encounter(uuid)
  SET search_path = public;

ALTER FUNCTION public.get_contracted_price(uuid, text, uuid)
  SET search_path = public;

ALTER FUNCTION public.get_moh_705_report(date, date)
  SET search_path = public;

ALTER FUNCTION public.validate_and_get_icd11(text)
  SET search_path = public;

ALTER FUNCTION public.verify_patient_identity(text, text)
  SET search_path = public;

ALTER FUNCTION public.verify_practitioner(text)
  SET search_path = public;

-- ============================================================
-- 7. VERIFY
-- ============================================================
DO $$
BEGIN
  -- audit_log should have no INSERT policy for public role with check=true
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'audit_log'
    AND cmd = 'INSERT'
    AND with_check = 'true'
    AND 'public' = ANY(roles)
    AND policyname IN ('System insert audit_log','audit_log_insert_policy')
  ) THEN
    RAISE EXCEPTION 'Security hardening: permissive audit_log INSERT policy still present';
  END IF;
END;
$$;
