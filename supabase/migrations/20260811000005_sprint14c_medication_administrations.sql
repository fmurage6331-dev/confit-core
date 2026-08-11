-- Sprint 14C: Medication Administration Records (MAR)
-- Tracks nurse-recorded administration of dispensed inpatient prescriptions

CREATE TABLE IF NOT EXISTS public.medication_administrations (
  id              uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  prescription_id uuid        NOT NULL REFERENCES public.prescriptions(id) ON DELETE CASCADE,
  admission_id    uuid        NOT NULL REFERENCES public.admissions(id) ON DELETE CASCADE,
  encounter_id    uuid        REFERENCES public.encounters(id) ON DELETE SET NULL,
  administered_at timestamptz NOT NULL DEFAULT now(),
  dose_given      text,
  route           text,
  administered_by uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  administered_by_name text,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_med_admin_prescription
  ON public.medication_administrations (prescription_id);

CREATE INDEX IF NOT EXISTS idx_med_admin_admission
  ON public.medication_administrations (admission_id);

CREATE INDEX IF NOT EXISTS idx_med_admin_administered_at
  ON public.medication_administrations (administered_at DESC);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.medication_administrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "approved_read_med_admin"
  ON public.medication_administrations FOR SELECT
  TO authenticated
  USING (public.is_approved(auth.uid()));

CREATE POLICY "approved_insert_med_admin"
  ON public.medication_administrations FOR INSERT
  TO authenticated
  WITH CHECK (public.is_approved(auth.uid()));

CREATE POLICY "approved_update_med_admin"
  ON public.medication_administrations FOR UPDATE
  TO authenticated
  USING (public.is_approved(auth.uid()));

-- ── Verify ───────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'medication_administrations'
  ) THEN
    RAISE EXCEPTION 'Sprint 14C: medication_administrations table not created';
  END IF;
END;
$$;
