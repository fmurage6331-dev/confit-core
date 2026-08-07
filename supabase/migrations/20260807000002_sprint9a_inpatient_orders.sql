-- Sprint 9A: Add inpatient context columns to lab_orders, radiology_orders, prescriptions
-- encounter_type: 'outpatient' | 'inpatient' — drives INPATIENT badge in queues
-- admission_id: links order to specific admission (ward/bed context)

-- ── lab_orders ───────────────────────────────────────────────────────────────
ALTER TABLE public.lab_orders
  ADD COLUMN IF NOT EXISTS encounter_type text NOT NULL DEFAULT 'outpatient'
    CHECK (encounter_type IN ('outpatient', 'inpatient')),
  ADD COLUMN IF NOT EXISTS admission_id uuid REFERENCES public.admissions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_lab_orders_admission_id
  ON public.lab_orders (admission_id)
  WHERE admission_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lab_orders_encounter_type
  ON public.lab_orders (encounter_type);

-- ── radiology_orders ─────────────────────────────────────────────────────────
ALTER TABLE public.radiology_orders
  ADD COLUMN IF NOT EXISTS encounter_type text NOT NULL DEFAULT 'outpatient'
    CHECK (encounter_type IN ('outpatient', 'inpatient')),
  ADD COLUMN IF NOT EXISTS admission_id uuid REFERENCES public.admissions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_radiology_orders_admission_id
  ON public.radiology_orders (admission_id)
  WHERE admission_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_radiology_orders_encounter_type
  ON public.radiology_orders (encounter_type);

-- ── prescriptions ────────────────────────────────────────────────────────────
-- prescriptions currently links via registration_id (patient_registrations VIEW)
-- Adding encounter_id + admission_id for direct inpatient chart linkage
-- Adding dispensed_from_store_id for Phase 4 hybrid pharmacy model

ALTER TABLE public.prescriptions
  ADD COLUMN IF NOT EXISTS encounter_id uuid REFERENCES public.encounters(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS admission_id uuid REFERENCES public.admissions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS dispensed_from_store_id uuid REFERENCES public.stock_locations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS encounter_type text NOT NULL DEFAULT 'outpatient'
    CHECK (encounter_type IN ('outpatient', 'inpatient'));

CREATE INDEX IF NOT EXISTS idx_prescriptions_encounter_id
  ON public.prescriptions (encounter_id)
  WHERE encounter_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_prescriptions_admission_id
  ON public.prescriptions (admission_id)
  WHERE admission_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_prescriptions_encounter_type
  ON public.prescriptions (encounter_type);
