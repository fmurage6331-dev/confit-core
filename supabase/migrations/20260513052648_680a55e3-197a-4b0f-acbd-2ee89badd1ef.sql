
-- Branding settings (single row keyed by id='global')
CREATE TABLE public.app_settings (
  id text PRIMARY KEY DEFAULT 'global',
  app_name text NOT NULL DEFAULT 'LabTrack',
  logo_url text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read branding
CREATE POLICY "Anyone authenticated can view settings"
  ON public.app_settings FOR SELECT TO authenticated USING (true);

-- Only admins can insert/update
CREATE POLICY "Admins can insert settings"
  ON public.app_settings FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update settings"
  ON public.app_settings FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER set_app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.app_settings (id, app_name) VALUES ('global', 'LabTrack')
  ON CONFLICT (id) DO NOTHING;

-- Public bucket for logo
INSERT INTO storage.buckets (id, name, public) VALUES ('branding', 'branding', true)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read branding"
  ON storage.objects FOR SELECT TO public USING (bucket_id = 'branding');
CREATE POLICY "Admins upload branding"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'branding' AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update branding"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'branding' AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins delete branding"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'branding' AND has_role(auth.uid(), 'admin'::app_role));
