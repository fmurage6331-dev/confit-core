ALTER TABLE public.stock_items
  ADD COLUMN IF NOT EXISTS strength numeric,
  ADD COLUMN IF NOT EXISTS strength_unit text;

COMMENT ON COLUMN public.stock_items.strength IS 'Strength per unit e.g. 500 for 500mg tablet';
COMMENT ON COLUMN public.stock_items.strength_unit IS 'Unit of strength e.g. mg, g, ml, mcg';