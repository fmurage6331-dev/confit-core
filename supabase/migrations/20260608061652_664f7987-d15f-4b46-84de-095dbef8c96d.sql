
CREATE TABLE public.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  code text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rooms TO authenticated;
GRANT ALL ON public.rooms TO service_role;

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved view rooms" ON public.rooms FOR SELECT TO authenticated USING (is_approved(auth.uid()));
CREATE POLICY "Admins insert rooms" ON public.rooms FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY "Admins update rooms" ON public.rooms FOR UPDATE TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete rooms" ON public.rooms FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_rooms_updated_at BEFORE UPDATE ON public.rooms FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.rooms (name, code) VALUES
  ('OPD','OPD'),
  ('Casualty / ER','ER'),
  ('Ward 1','W1'),
  ('Ward 2','W2'),
  ('Pediatrics','PED'),
  ('Maternity','MAT'),
  ('Theatre','TH'),
  ('Outreach / Camp','CAMP'),
  ('Walk-in','WI')
ON CONFLICT (name) DO NOTHING;

ALTER TABLE public.lab_tests
  ADD COLUMN IF NOT EXISTS registration_id uuid,
  ADD COLUMN IF NOT EXISTS sent_to_room text,
  ADD COLUMN IF NOT EXISTS sent_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_lab_tests_registration_id ON public.lab_tests(registration_id);
