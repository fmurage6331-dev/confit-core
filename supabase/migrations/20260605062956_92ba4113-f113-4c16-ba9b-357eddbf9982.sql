
-- 1. Add "from_room" (which room the patient was sent from) to registrations
ALTER TABLE public.patient_registrations
  ADD COLUMN IF NOT EXISTS from_room TEXT;

-- 2. Permission catalogue per role (admin always allowed; gets no rows)
CREATE TABLE IF NOT EXISTS public.role_permissions (
  role public.app_role NOT NULL,
  permission TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (role, permission)
);

GRANT SELECT ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved view role_permissions" ON public.role_permissions
  FOR SELECT TO authenticated USING (public.is_approved(auth.uid()));
CREATE POLICY "Admins insert role_permissions" ON public.role_permissions
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete role_permissions" ON public.role_permissions
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 3. Helper: does this user (via any of their roles) hold this permission? Admin always true.
CREATE OR REPLACE FUNCTION public.user_has_permission(_user uuid, _perm text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user, 'admin')
      OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.role_permissions rp ON rp.role = ur.role
        WHERE ur.user_id = _user AND rp.permission = _perm
      );
$$;

-- 4. Seed default permissions
INSERT INTO public.role_permissions (role, permission) VALUES
  ('records_officer','register_patient'),
  ('records_officer','view_queue'),
  ('records_officer','reports.registrations'),
  ('lab_tech','view_queue'),
  ('lab_tech','records_view'),
  ('lab_tech','records_create'),
  ('lab_tech','machines'),
  ('lab_tech','deliveries'),
  ('lab_tech','stock'),
  ('lab_tech','reports.tests'),
  ('lab_tech','reports.stock'),
  ('accountant','accounting'),
  ('accountant','reports.finance'),
  ('staff','register_patient'),
  ('staff','view_queue'),
  ('staff','accounting'),
  ('staff','records_view'),
  ('staff','records_create'),
  ('staff','machines'),
  ('staff','deliveries'),
  ('staff','stock'),
  ('staff','reports.tests'),
  ('staff','reports.finance'),
  ('staff','reports.stock'),
  ('staff','reports.registrations')
ON CONFLICT DO NOTHING;
