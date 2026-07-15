CREATE TABLE public.test_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_name text NOT NULL UNIQUE,
  parameters jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.test_templates TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.test_templates TO authenticated;
GRANT ALL ON public.test_templates TO service_role;

ALTER TABLE public.test_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved can view templates"
ON public.test_templates FOR SELECT TO authenticated
USING (is_approved(auth.uid()));

CREATE POLICY "Admins can insert templates"
ON public.test_templates FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update templates"
ON public.test_templates FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete templates"
ON public.test_templates FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_test_templates_updated_at
BEFORE UPDATE ON public.test_templates
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();