-- B3 Fix: External mortuary charges now billed via standalone invoice
-- accrue_daily_mortuary_charges() updated to create invoice for external bodies
-- on first accrual then reuse it on subsequent days

CREATE OR REPLACE FUNCTION public.accrue_daily_mortuary_charges()
RETURNS void
LANGUAGE plpgsql
AS $function$
DECLARE
  _rec   RECORD;
  _today text := to_char(now(), 'YYYY-MM-DD');
  _inv_id uuid;
BEGIN
  FOR _rec IN
    SELECT
      m.id,
      m.intake_type,
      m.deceased_name,
      m.daily_storage_rate,
      m.invoice_id,
      m.encounter_id,
      m.patient_id
    FROM public.mortuary_records m
    WHERE m.status = 'stored'
  LOOP

    -- ── INTERNAL: already has invoice linked via encounter ────────────────
    IF _rec.intake_type = 'internal' AND _rec.invoice_id IS NOT NULL THEN
      INSERT INTO public.invoice_line_items (
        invoice_id, encounter_id, item_type,
        source_id, description, quantity, unit_price, amount
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

    -- ── EXTERNAL: create standalone invoice on first accrual ─────────────
    ELSIF _rec.intake_type = 'external' THEN
      _inv_id := _rec.invoice_id;

      -- Create invoice if not yet linked
      IF _inv_id IS NULL THEN
        INSERT INTO public.invoices (
          encounter_id, patient_id, status
        ) VALUES (
          NULL, _rec.patient_id, 'unpaid'
        )
        RETURNING id INTO _inv_id;

        -- Link invoice back to mortuary record
        UPDATE public.mortuary_records
        SET invoice_id = _inv_id
        WHERE id = _rec.id;
      END IF;

      -- Insert daily charge line item
      INSERT INTO public.invoice_line_items (
        invoice_id, encounter_id, item_type,
        source_id, description, quantity, unit_price, amount
      ) VALUES (
        _inv_id,
        NULL,
        'mortuary_storage',
        _rec.id,
        _rec.deceased_name || ' — mortuary storage (' || _today || ')',
        1,
        _rec.daily_storage_rate,
        _rec.daily_storage_rate
      );

      -- Update running total on record
      UPDATE public.mortuary_records
      SET total_storage_charges = total_storage_charges + _rec.daily_storage_rate
      WHERE id = _rec.id;

    END IF;

  END LOOP;
END;
$function$;
