-- Sprint 13B: Dispense negative stock guard
-- Adds current_quantity check to dispense_prescription_stock()
-- record_pharmacy_stock_usage_from_prescription() already guards stock_location_balances
-- This fixes the legacy stock_items.current_quantity path

CREATE OR REPLACE FUNCTION public.dispense_prescription_stock()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_current_qty NUMERIC;
BEGIN
  IF NEW.status = 'dispensed'
    AND (OLD.status IS DISTINCT FROM 'dispensed')
    AND NEW.stock_item_id IS NOT NULL
  THEN
    -- ── Stock check ──────────────────────────────────────────
    SELECT current_quantity
    INTO   v_current_qty
    FROM   public.stock_items
    WHERE  id = NEW.stock_item_id
    FOR UPDATE;

    IF COALESCE(v_current_qty, 0) < NEW.quantity THEN
      RAISE EXCEPTION
        'Insufficient stock. Available: %, requested: %. Transfer stock before dispensing.',
        COALESCE(v_current_qty, 0),
        NEW.quantity;
    END IF;

    -- ── Deduct via stock_movements ────────────────────────────
    INSERT INTO public.stock_movements (
      item_id,
      change,
      reason,
      notes,
      created_by
    ) VALUES (
      NEW.stock_item_id,
      -ABS(NEW.quantity),
      'dispense',
      'Prescription ' || NEW.id::text || ' for reg ' || NEW.registration_id::text,
      COALESCE(NEW.dispensed_by, NEW.created_by)
    );

    IF NEW.dispensed_at IS NULL THEN
      NEW.dispensed_at := now();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
