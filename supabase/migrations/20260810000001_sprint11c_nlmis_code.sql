-- Sprint 11C: Add NLMIS commodity code to stock_items
-- Required for NLMIS registration and pharmacy module compliance

ALTER TABLE public.stock_items
  ADD COLUMN IF NOT EXISTS nlmis_code text;

COMMENT ON COLUMN public.stock_items.nlmis_code
  IS 'NLMIS commodity code — required for NLMIS reporting and pharmacy compliance';

-- Recreate view to expose nlmis_code
DROP VIEW IF EXISTS public.stock_store_balances_view;

CREATE VIEW public.stock_store_balances_view AS
SELECT
  slb.id,
  slb.location_id,
  sl.name        AS location_name,
  sl.location_type,
  sl.is_main_store,
  slb.item_id,
  si.name        AS item_name,
  si.category,
  si.kind,
  si.unit,
  si.nlmis_code,
  slb.quantity,
  slb.updated_at
FROM public.stock_location_balances slb
JOIN public.stock_locations sl ON sl.id = slb.location_id
JOIN public.stock_items si     ON si.id = slb.item_id;

-- Restore grants
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.stock_store_balances_view TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.stock_store_balances_view TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.stock_store_balances_view TO service_role;
GRANT SELECT, INSERT
  ON public.stock_store_balances_view TO sandbox_exec;
