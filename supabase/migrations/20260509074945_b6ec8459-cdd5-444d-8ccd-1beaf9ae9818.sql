
DROP POLICY "Authenticated users can update lab tests" ON public.lab_tests;
DROP POLICY "Authenticated users can delete lab tests" ON public.lab_tests;

CREATE POLICY "Authenticated users can update lab tests"
  ON public.lab_tests FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete lab tests"
  ON public.lab_tests FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
