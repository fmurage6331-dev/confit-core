-- Auto-generate unique file numbers for patients
CREATE SEQUENCE IF NOT EXISTS public.patient_file_seq START 1000;

CREATE OR REPLACE FUNCTION public.set_patient_file_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.file_number IS NULL OR btrim(NEW.file_number) = '' THEN
    NEW.file_number := 'P' || lpad(nextval('public.patient_file_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_patient_file_number ON public.patients;
CREATE TRIGGER trg_set_patient_file_number
BEFORE INSERT ON public.patients
FOR EACH ROW EXECUTE FUNCTION public.set_patient_file_number();

-- Advance sequence past any existing numeric file numbers so we never collide
SELECT setval(
  'public.patient_file_seq',
  GREATEST(
    1000,
    COALESCE((
      SELECT MAX((regexp_replace(file_number, '\D', '', 'g'))::bigint)
      FROM public.patients
      WHERE file_number ~ '\d'
    ), 1000)
  )
);