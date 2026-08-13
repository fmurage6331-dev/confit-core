-- Sprint 5 (G2): EpisodeOfCare table + auto-generate trigger
-- DHA SHR requires Encounter → EpisodeOfCare reference in every FHIR bundle.
-- One EpisodeOfCare is auto-generated per encounter on creation.
-- For inpatient: EpisodeOfCare spans the full admission period.
-- For outpatient: EpisodeOfCare represents the single visit episode.

CREATE TABLE IF NOT EXISTS public.episode_of_care (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id      UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  encounter_id    UUID NOT NULL REFERENCES public.encounters(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('planned','waitlist','active',
                                    'onhold','finished','cancelled','entered-in-error')),
  episode_type    TEXT NOT NULL DEFAULT 'hacc'
                  CHECK (episode_type IN ('hacc','pac','diag','cacp','virtual','postclinical')),
  period_start    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  period_end      TIMESTAMPTZ DEFAULT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (encounter_id)
);

-- RLS
ALTER TABLE public.episode_of_care ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read episode_of_care"
  ON public.episode_of_care FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert episode_of_care"
  ON public.episode_of_care FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update episode_of_care"
  ON public.episode_of_care FOR UPDATE
  TO authenticated USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_episode_of_care_patient
  ON public.episode_of_care (patient_id);

CREATE INDEX IF NOT EXISTS idx_episode_of_care_encounter
  ON public.episode_of_care (encounter_id);

-- Auto-generate EpisodeOfCare when encounter is created
CREATE OR REPLACE FUNCTION public.auto_generate_episode_of_care()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.episode_of_care (
    patient_id,
    encounter_id,
    status,
    episode_type,
    period_start
  )
  VALUES (
    NEW.patient_id,
    NEW.id,
    'active',
    CASE
      WHEN NEW.encounter_type = 'inpatient' THEN 'hacc'
      WHEN NEW.encounter_type = 'emergency' THEN 'hacc'
      ELSE 'hacc'
    END,
    NEW.created_at
  )
  ON CONFLICT (encounter_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Attach trigger to encounters
DROP TRIGGER IF EXISTS trg_auto_generate_episode_of_care ON public.encounters;

CREATE TRIGGER trg_auto_generate_episode_of_care
  AFTER INSERT ON public.encounters
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_generate_episode_of_care();

-- Close EpisodeOfCare when encounter is signed/done
CREATE OR REPLACE FUNCTION public.auto_close_episode_of_care()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('signed', 'done') AND OLD.status NOT IN ('signed', 'done') THEN
    UPDATE public.episode_of_care
    SET
      status    = 'finished',
      period_end = NOW(),
      updated_at = NOW()
    WHERE encounter_id = NEW.id
      AND status = 'active';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_close_episode_of_care ON public.encounters;

CREATE TRIGGER trg_auto_close_episode_of_care
  AFTER UPDATE ON public.encounters
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_close_episode_of_care();

-- Back-fill EpisodeOfCare for all existing encounters
INSERT INTO public.episode_of_care (
  patient_id,
  encounter_id,
  status,
  episode_type,
  period_start,
  period_end
)
SELECT
  e.patient_id,
  e.id,
  CASE
    WHEN e.status IN ('signed', 'done') THEN 'finished'
    ELSE 'active'
  END,
  'hacc',
  e.created_at,
  CASE
    WHEN e.status IN ('signed', 'done') THEN e.updated_at
    ELSE NULL
  END
FROM public.encounters e
ON CONFLICT (encounter_id) DO NOTHING;

COMMENT ON TABLE public.episode_of_care IS
  'FHIR R4 EpisodeOfCare — one per encounter. Required by DHA SHR for every Encounter bundle submission.';
