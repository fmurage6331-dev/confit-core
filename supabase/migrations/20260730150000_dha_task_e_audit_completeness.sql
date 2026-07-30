-- ============================================================
-- Migration: Task E — Audit log completeness
-- Date: 2026-07-30
-- Author: Francis Muhoro
--
-- Attaches the existing audit_trigger_fn() to 12 tables
-- that were missing audit coverage for DHA certification.
--
-- Priority 1: Clinical data (lab, radiology, notes, diagnoses)
-- Priority 2: Security/access (roles, permissions, settings)
-- Priority 3: Pharmacy/stock
-- ============================================================


-- ── Priority 1: Clinical data ─────────────────────────────────

DROP TRIGGER IF EXISTS audit_lab_orders ON public.lab_orders;
CREATE TRIGGER audit_lab_orders
  AFTER INSERT OR UPDATE OR DELETE ON public.lab_orders
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

DROP TRIGGER IF EXISTS audit_lab_results ON public.lab_results;
CREATE TRIGGER audit_lab_results
  AFTER INSERT OR UPDATE OR DELETE ON public.lab_results
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

DROP TRIGGER IF EXISTS audit_radiology_orders ON public.radiology_orders;
CREATE TRIGGER audit_radiology_orders
  AFTER INSERT OR UPDATE OR DELETE ON public.radiology_orders
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

DROP TRIGGER IF EXISTS audit_radiology_results ON public.radiology_results;
CREATE TRIGGER audit_radiology_results
  AFTER INSERT OR UPDATE OR DELETE ON public.radiology_results
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

DROP TRIGGER IF EXISTS audit_clinical_notes ON public.clinical_notes;
CREATE TRIGGER audit_clinical_notes
  AFTER INSERT OR UPDATE OR DELETE ON public.clinical_notes
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

DROP TRIGGER IF EXISTS audit_encounter_diagnoses ON public.encounter_diagnoses;
CREATE TRIGGER audit_encounter_diagnoses
  AFTER INSERT OR UPDATE OR DELETE ON public.encounter_diagnoses
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();


-- ── Priority 2: Security / access changes ────────────────────

DROP TRIGGER IF EXISTS audit_user_roles ON public.user_roles;
CREATE TRIGGER audit_user_roles
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

DROP TRIGGER IF EXISTS audit_role_permissions ON public.role_permissions;
CREATE TRIGGER audit_role_permissions
  AFTER INSERT OR UPDATE OR DELETE ON public.role_permissions
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

DROP TRIGGER IF EXISTS audit_user_room_access ON public.user_room_access;
CREATE TRIGGER audit_user_room_access
  AFTER INSERT OR UPDATE OR DELETE ON public.user_room_access
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

DROP TRIGGER IF EXISTS audit_app_settings ON public.app_settings;
CREATE TRIGGER audit_app_settings
  AFTER INSERT OR UPDATE OR DELETE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();


-- ── Priority 3: Pharmacy / stock ──────────────────────────────

DROP TRIGGER IF EXISTS audit_stock_movements ON public.stock_movements;
CREATE TRIGGER audit_stock_movements
  AFTER INSERT OR UPDATE OR DELETE ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

DROP TRIGGER IF EXISTS audit_stock_items ON public.stock_items;
CREATE TRIGGER audit_stock_items
  AFTER INSERT OR UPDATE OR DELETE ON public.stock_items
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();


-- ── Verify ────────────────────────────────────────────────────
SELECT
  trigger_name,
  event_object_table AS on_table,
  event_manipulation AS fires_on
FROM information_schema.triggers
WHERE trigger_name ILIKE 'audit_%'
ORDER BY event_object_table, trigger_name;