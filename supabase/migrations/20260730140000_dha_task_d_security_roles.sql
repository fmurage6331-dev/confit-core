-- ============================================================
-- Migration: Task D — Security hardening / role gap fix
-- Date: 2026-07-30
-- Author: Francis Muhoro
--
-- Problem:
--   is_approved() only included 5 roles:
--   admin, staff, accountant, lab_tech, records_officer
--
--   9 clinical roles already in the enum were excluded:
--   doctor, clinical_officer, nurse, radiologist, pharmacist,
--   mortician — causing RLS denials on 68 policies for any
--   user assigned these roles.
--
-- Fix:
--   1. Add 8 new roles to app_role enum
--   2. Rewrite is_approved() to include all 19 valid roles
-- ============================================================


-- ── Step 1: Add new roles to app_role enum ───────────────────
-- ALTER TYPE ... ADD VALUE cannot run inside a transaction.
-- Each statement commits immediately via IF NOT EXISTS guard.

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'receptionist';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'triage_nurse';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'nutritionist';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'physiotherapist';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'dental_officer';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'hts_counsellor';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'insurance_agent';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'system_admin';


-- ── Step 2: Fix is_approved() ─────────────────────────────────
-- Now includes all 19 valid roles.
-- All 68 RLS policies that call is_approved() are fixed
-- by this single function change — no policy changes needed.

CREATE OR REPLACE FUNCTION public.is_approved(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN (
        -- Original roles
        'admin',
        'staff',
        'accountant',
        'lab_tech',
        'records_officer',
        -- Clinical roles (were missing — caused RLS denials on 68 policies)
        'doctor',
        'clinical_officer',
        'nurse',
        'radiologist',
        'pharmacist',
        'mortician',
        -- New roles added Task D
        'receptionist',
        'triage_nurse',
        'nutritionist',
        'physiotherapist',
        'dental_officer',
        'hts_counsellor',
        'insurance_agent',
        'system_admin'
      )
  )
$function$;