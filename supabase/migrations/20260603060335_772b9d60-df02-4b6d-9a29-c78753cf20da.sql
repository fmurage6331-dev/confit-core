
-- Insurance providers
CREATE TABLE public.insurance_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  coverage_percentage numeric NOT NULL DEFAULT 0 CHECK (coverage_percentage >= 0 AND coverage_percentage <= 100),
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.insurance_providers TO authenticated;
GRANT ALL ON public.insurance_providers TO service_role;
ALTER TABLE public.insurance_providers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved view insurers" ON public.insurance_providers FOR SELECT TO authenticated USING (is_approved(auth.uid()));
CREATE POLICY "Admins insert insurers" ON public.insurance_providers FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY "Admins update insurers" ON public.insurance_providers FOR UPDATE TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete insurers" ON public.insurance_providers FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'));
CREATE TRIGGER set_insurance_providers_updated_at BEFORE UPDATE ON public.insurance_providers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Lab test catalog (with prices)
CREATE TABLE public.lab_test_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  price numeric NOT NULL DEFAULT 0 CHECK (price >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lab_test_catalog TO authenticated;
GRANT ALL ON public.lab_test_catalog TO service_role;
ALTER TABLE public.lab_test_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved view tests" ON public.lab_test_catalog FOR SELECT TO authenticated USING (is_approved(auth.uid()));
CREATE POLICY "Admins insert tests" ON public.lab_test_catalog FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY "Admins update tests" ON public.lab_test_catalog FOR UPDATE TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete tests" ON public.lab_test_catalog FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'));
CREATE TRIGGER set_lab_test_catalog_updated_at BEFORE UPDATE ON public.lab_test_catalog FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Patient registrations / queue
CREATE TABLE public.patient_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_name text NOT NULL,
  date_of_birth date,
  phone text,
  file_number text,
  payment_mode text NOT NULL CHECK (payment_mode IN ('cash','insurance','free')),
  insurance_provider_id uuid REFERENCES public.insurance_providers(id) ON DELETE SET NULL,
  insurance_coverage_percentage numeric,
  tests jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal numeric NOT NULL DEFAULT 0,
  insurance_covered numeric NOT NULL DEFAULT 0,
  patient_due numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','in_progress','done','cancelled')),
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_registrations TO authenticated;
GRANT ALL ON public.patient_registrations TO service_role;
ALTER TABLE public.patient_registrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved view regs" ON public.patient_registrations FOR SELECT TO authenticated USING (is_approved(auth.uid()));
CREATE POLICY "Approved insert regs" ON public.patient_registrations FOR INSERT TO authenticated WITH CHECK (is_approved(auth.uid()));
CREATE POLICY "Approved update regs" ON public.patient_registrations FOR UPDATE TO authenticated USING (is_approved(auth.uid())) WITH CHECK (is_approved(auth.uid()));
CREATE POLICY "Approved delete regs" ON public.patient_registrations FOR DELETE TO authenticated USING (is_approved(auth.uid()));
CREATE TRIGGER set_patient_registrations_updated_at BEFORE UPDATE ON public.patient_registrations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_patient_registrations_created_at ON public.patient_registrations(created_at DESC);
CREATE INDEX idx_patient_registrations_status ON public.patient_registrations(status);

-- Seed default lab tests
INSERT INTO public.lab_test_catalog (name, price) VALUES
  ('Full Blood Count', 15),
  ('Malaria Test', 5),
  ('Urinalysis', 8),
  ('Blood Glucose', 6),
  ('Pregnancy Test', 5),
  ('HIV Screening', 10),
  ('Liver Function Test', 25),
  ('Kidney Function Test', 25),
  ('Lipid Profile', 20),
  ('Widal Test', 10)
ON CONFLICT (name) DO NOTHING;
