
-- Add new roles for department-specific access
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'accountant';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'lab_tech';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'records_officer';
