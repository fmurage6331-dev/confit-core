-- ============================================================
-- SHA-1: Benefit Packages Table + Seed
-- 22 packages across PHF (3), SHIF (15), ECCIF (4)
-- Source: SHA Kenya benefit package framework
-- ============================================================

CREATE TABLE IF NOT EXISTS public.sha_benefit_packages (
  id                  uuid DEFAULT gen_random_uuid() NOT NULL,
  code                text NOT NULL UNIQUE,
  name                text NOT NULL,
  fund_type           text NOT NULL,
  facility_levels     smallint[] NOT NULL DEFAULT '{2,3,4,5,6}',
  requires_preauth    boolean NOT NULL DEFAULT false,
  can_combine_with    text[] DEFAULT '{}',
  daily_limit         numeric,
  annual_limit        numeric,
  per_visit_limit     numeric,
  is_active           boolean NOT NULL DEFAULT true,
  notes               text,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now(),
  CONSTRAINT sha_benefit_packages_pkey PRIMARY KEY (id),
  CONSTRAINT sha_benefit_packages_fund_type_check
    CHECK (fund_type IN ('PHF', 'SHIF', 'ECCIF'))
);

ALTER TABLE public.sha_benefit_packages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sha_benefit_packages_authenticated_read" ON public.sha_benefit_packages;
DROP POLICY IF EXISTS "sha_benefit_packages_admin_write" ON public.sha_benefit_packages;

CREATE POLICY "sha_benefit_packages_authenticated_read"
  ON public.sha_benefit_packages
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "sha_benefit_packages_admin_write"
  ON public.sha_benefit_packages
  FOR ALL
  TO authenticated
  USING (public.is_approved(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_sha_benefit_packages_fund
  ON public.sha_benefit_packages(fund_type);
CREATE INDEX IF NOT EXISTS idx_sha_benefit_packages_active
  ON public.sha_benefit_packages(is_active);

-- ── PHF ───────────────────────────────────────────────────────────────────────
INSERT INTO public.sha_benefit_packages
  (code, name, fund_type, facility_levels, requires_preauth, can_combine_with, per_visit_limit, notes)
VALUES
  ('SHA-01', 'Primary Healthcare — Outpatient',
   'PHF', '{2,3,4}', false, '{}', 900,
   'Flat KES 900 per person per year. Covers basic OPD at Level 2-4.'),
  ('SHA-02', 'Primary Healthcare — Preventive & Promotive',
   'PHF', '{2,3,4}', false, '{SHA-01}', NULL,
   'Immunisation, antenatal care, family planning at primary level.'),
  ('SHA-03', 'Primary Healthcare — Community Health',
   'PHF', '{1,2,3}', false, '{SHA-01,SHA-02}', NULL,
   'CHV-delivered services, home-based care.')
ON CONFLICT (code) DO NOTHING;

-- ── SHIF ──────────────────────────────────────────────────────────────────────
INSERT INTO public.sha_benefit_packages
  (code, name, fund_type, facility_levels, requires_preauth, can_combine_with, per_visit_limit, notes)
VALUES
  ('SHA-04', 'Inpatient — General Ward',
   'SHIF', '{4,5,6}', false, '{SHA-05,SHA-07,SHA-19}', NULL,
   'General inpatient admissions. Covers bed, nursing, basic investigations.'),
  ('SHA-05', 'Inpatient — Maternity',
   'SHIF', '{3,4,5,6}', false, '{SHA-04,SHA-02}', NULL,
   'Normal delivery, CS, postnatal. Level 3 and above.'),
  ('SHA-06', 'Inpatient — Paediatric',
   'SHIF', '{4,5,6}', false, '{SHA-04}', NULL,
   'Paediatric ward admissions under 18 years.'),
  ('SHA-07', 'Outpatient Specialist',
   'SHIF', '{4,5,6}', false, '{SHA-04,SHA-08}', NULL,
   'Specialist outpatient consultations at Level 4 and above.'),
  ('SHA-08', 'Diagnostic Imaging',
   'SHIF', '{3,4,5,6}', false, '{SHA-04,SHA-07,SHA-19}', NULL,
   'X-ray, ultrasound, CT, MRI.'),
  ('SHA-09', 'Laboratory — Outpatient',
   'SHIF', '{2,3,4,5,6}', false, '{SHA-01,SHA-04,SHA-07}', NULL,
   'Essential diagnostic laboratory services.'),
  ('SHA-10', 'Pharmacy — Outpatient',
   'SHIF', '{2,3,4,5,6}', false, '{SHA-01,SHA-07}', NULL,
   'Essential medicines from KEML.'),
  ('SHA-11', 'Mental Health',
   'SHIF', '{3,4,5,6}', false, '{SHA-04,SHA-07}', NULL,
   'Inpatient and outpatient mental health services.'),
  ('SHA-12', 'Rehabilitation Services',
   'SHIF', '{3,4,5,6}', false, '{SHA-04}', NULL,
   'Physiotherapy, occupational therapy, speech therapy.'),
  ('SHA-13', 'Palliative Care',
   'SHIF', '{3,4,5,6}', false, '{SHA-04}', NULL,
   'Pain management and end-of-life care.'),
  ('SHA-14', 'Dental Services',
   'SHIF', '{3,4,5,6}', false, '{}', NULL,
   'Basic dental: extraction, filling, scaling.'),
  ('SHA-15', 'Optical Services',
   'SHIF', '{3,4,5,6}', false, '{}', NULL,
   'Eye examination and basic optical services.'),
  ('SHA-16', 'Renal Care — Dialysis',
   'SHIF', '{4,5,6}', true, '{}', 10650,
   'Haemodialysis KES 10,650 per session. Preauth mandatory.'),
  ('SHA-17', 'Radiology — Advanced',
   'SHIF', '{5,6}', true, '{SHA-04}', NULL,
   'CT scan, MRI, nuclear medicine. Preauth required.'),
  ('SHA-18', 'Essential Diagnostics — NCDs',
   'SHIF', '{3,4,5,6}', false, '{SHA-07,SHA-09}', NULL,
   'HbA1c, lipid panel, cardiac markers and other NCD monitoring tests.')
ON CONFLICT (code) DO NOTHING;

-- ── ECCIF ─────────────────────────────────────────────────────────────────────
INSERT INTO public.sha_benefit_packages
  (code, name, fund_type, facility_levels, requires_preauth, can_combine_with, per_visit_limit, notes)
VALUES
  ('SHA-19', 'Surgical Services',
   'ECCIF', '{4,5,6}', true, '{SHA-04,SHA-08,SHA-17}', NULL,
   'Elective and emergency surgery. Preauth required for elective cases.'),
  ('SHA-20', 'Oncology — Cancer Treatment',
   'ECCIF', '{5,6}', true, '{}', NULL,
   'Chemotherapy, radiotherapy, targeted therapy. Preauth mandatory.'),
  ('SHA-21', 'ICU / Critical Care',
   'ECCIF', '{5,6}', true, '{SHA-04,SHA-19}', NULL,
   'ICU/HDU admission. Preauth required.'),
  ('SHA-22', 'Emergency Ambulance',
   'ECCIF', '{1,2,3,4,5,6}', false, '{}', NULL,
   'Pre-hospital emergency transport.')
ON CONFLICT (code) DO NOTHING;
