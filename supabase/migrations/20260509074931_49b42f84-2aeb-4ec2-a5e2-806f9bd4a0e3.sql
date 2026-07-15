
CREATE TABLE public.lab_tests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_name TEXT NOT NULL,
  age INTEGER NOT NULL,
  registration_number TEXT NOT NULL,
  lab_number TEXT NOT NULL UNIQUE,
  test_name TEXT NOT NULL,
  result TEXT,
  notes TEXT,
  test_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lab_tests_lab_number ON public.lab_tests(lab_number);
CREATE INDEX idx_lab_tests_patient_name ON public.lab_tests(patient_name);
CREATE INDEX idx_lab_tests_test_date ON public.lab_tests(test_date DESC);

ALTER TABLE public.lab_tests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all lab tests"
  ON public.lab_tests FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert lab tests"
  ON public.lab_tests FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated users can update lab tests"
  ON public.lab_tests FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete lab tests"
  ON public.lab_tests FOR DELETE TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER lab_tests_updated_at
  BEFORE UPDATE ON public.lab_tests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
