-- Sprint 10B: Mortuary workflow
-- Supports internal (facility death) and external (received from outside) bodies
-- Daily storage charges accrue via pg_cron same pattern as bed charges

CREATE TABLE IF NOT EXISTS public.mortuary_records (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_number          text UNIQUE,
  intake_type               text NOT NULL DEFAULT 'internal'
    CHECK (intake_type IN ('internal', 'external')),
  encounter_id              uuid REFERENCES public.encounters(id) ON DELETE SET NULL,
  patient_id                uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  invoice_id                uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  deceased_name             text NOT NULL,
  age_years                 integer,
  sex                       text,
  national_id               text,
  date_of_death             date,
  cause_of_death            text,
  admitted_to_mortuary_at   timestamptz NOT NULL DEFAULT now(),
  received_by               text,
  notes                     text,
  daily_storage_rate        numeric NOT NULL DEFAULT 500,
  total_storage_charges     numeric NOT NULL DEFAULT 0,
  status                    text NOT NULL DEFAULT 'stored'
    CHECK (status IN ('stored', 'released')),
  released_at               timestamptz,
  released_to_name          text,
  released_to_relationship  text,
  release_notes             text,
  created_by                uuid REFERENCES auth.users(id),
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.assign_mortuary_reference()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  _year  text := to_char(now(), 'YYYY');
  _seq   integer;
BEGIN
  SELECT COALESCE(MAX(
    CASE WHEN reference_number ~ ('^MORT-' || _year || '-[0-9]+$')
    THEN (regexp_replace(reference_number, '^MORT-' || _year || '-', ''))::integer
    ELSE 0 END
  ), 0) + 1
  INTO _seq
  FROM public.mortuary_records;
  NEW.reference_number := 'MORT-' || _year || '-' || LPAD(_seq::text, 4, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_assign_mortuary_reference
  BEFORE INSERT ON public.mortuary_records
  FOR EACH ROW
  WHEN (NEW.reference_number IS NULL)
  EXECUTE FUNCTION public.assign_mortuary_reference();

CREATE OR REPLACE FUNCTION public.trg_mortuary_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_mortuary_updated_at
  BEFORE UPDATE ON public.mortuary_records
  FOR EACH ROW EXECUTE FUNCTION public.trg_mortuary_updated_at();

ALTER TABLE public.mortuary_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "approved_read_mortuary"
  ON public.mortuary_records FOR SELECT
  TO authenticated
  USING (public.is_approved(auth.uid()));

CREATE POLICY "approved_write_mortuary"
  ON public.mortuary_records FOR ALL
  TO authenticated
  USING (public.is_approved(auth.uid()))
  WITH CHECK (public.is_approved(auth.uid()));

CREATE OR REPLACE FUNCTION public.accrue_daily_mortuary_charges()
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  _rec RECORD;
  _today text := to_char(now(), 'YYYY-MM-DD');
BEGIN
  FOR _rec IN
    SELECT m.id, m.intake_type, m.deceased_name,
           m.daily_storage_rate, m.invoice_id, m.encounter_id
    FROM public.mortuary_records m
    WHERE m.status = 'stored'
  LOOP
    IF _rec.intake_type = 'internal' AND _rec.invoice_id IS NOT NULL THEN
      INSERT INTO public.invoice_line_items (
        invoice_id, encounter_id, item_type, source_id,
        description, quantity, unit_price, amount
      ) VALUES (
        _rec.invoice_id,
        _rec.encounter_id,
        'mortuary_storage',
        _rec.id,
        _rec.deceased_name || ' — mortuary storage (' || _today || ')',
        1,
        _rec.daily_storage_rate,
        _rec.daily_storage_rate
      );
    ELSE
      UPDATE public.mortuary_records
      SET total_storage_charges = total_storage_charges + daily_storage_rate
      WHERE id = _rec.id;
    END IF;
  END LOOP;
END;
$$;

SELECT cron.schedule(
  'accrue-daily-mortuary-charges',
  '31 21 * * *',
  'SELECT public.accrue_daily_mortuary_charges();'
);
