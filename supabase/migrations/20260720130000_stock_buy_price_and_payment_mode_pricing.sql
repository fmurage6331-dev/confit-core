-- 1. Add buy_price (cost price) to stock_items. cash_price and insurance_price
--    already existed but were never exposed in the UI or actually used anywhere.
ALTER TABLE public.stock_items
  ADD COLUMN IF NOT EXISTS buy_price numeric;

-- 2. When a prescription is dispensed, the invoice line item was always priced
--    from stock_items.unit_price regardless of how the patient is paying.
--    Now it picks cash_price for cash patients and insurance_price for
--    insurance patients, falling back to unit_price (then 0) if the specific
--    price hasn't been set for that item yet — so items you haven't repriced
--    yet keep working exactly as before.
CREATE OR REPLACE FUNCTION public.sync_invoice_line_item_from_prescription()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  _invoice_id uuid;
  _price numeric;
  _payment_mode text;
BEGIN
  IF NEW.status = 'dispensed' AND (OLD.status IS DISTINCT FROM 'dispensed') THEN
    SELECT id INTO _invoice_id FROM invoices WHERE encounter_id = NEW.registration_id ORDER BY created_at ASC LIMIT 1;
    IF _invoice_id IS NOT NULL THEN
      SELECT payment_mode INTO _payment_mode FROM encounters WHERE id = NEW.registration_id;

      SELECT CASE
               WHEN _payment_mode = 'insurance' THEN COALESCE(insurance_price, cash_price, unit_price)
               ELSE COALESCE(cash_price, unit_price)
             END
        INTO _price
        FROM stock_items WHERE id = NEW.stock_item_id;

      INSERT INTO invoice_line_items (invoice_id, encounter_id, item_type, source_id, description, quantity, unit_price, amount)
      VALUES (
        _invoice_id, NEW.registration_id, 'prescription', NEW.id,
        NEW.drug_name, NEW.quantity, COALESCE(_price,0), COALESCE(_price,0) * NEW.quantity
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
