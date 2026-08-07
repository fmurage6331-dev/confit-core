-- contracted_prices: per-insurer rate card for lab_test_catalog, stock_items, wards
-- item_type values: 'lab_test' | 'stock_item' | 'ward'
-- item_id is polymorphic UUID pointing to the correct table per item_type
-- Falls back to item default insurance_price when no row exists

CREATE TABLE IF NOT EXISTS public.contracted_prices (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  insurance_provider_id uuid NOT NULL REFERENCES public.insurance_providers(id) ON DELETE CASCADE,
  item_type             text NOT NULL CHECK (item_type IN ('lab_test', 'stock_item', 'ward')),
  item_id               uuid NOT NULL,
  contracted_price      numeric NOT NULL CHECK (contracted_price >= 0),
  notes                 text,
  created_by            uuid REFERENCES auth.users(id),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (insurance_provider_id, item_type, item_id)
);

ALTER TABLE public.contracted_prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "approved_read_contracted_prices"
  ON public.contracted_prices FOR SELECT
  TO authenticated
  USING (public.is_approved(auth.uid()));

CREATE POLICY "admins_manage_contracted_prices"
  ON public.contracted_prices FOR ALL
  TO authenticated
  USING (public.is_approved(auth.uid()))
  WITH CHECK (public.is_approved(auth.uid()));

CREATE OR REPLACE FUNCTION public.get_contracted_price(
  p_insurance_provider_id uuid,
  p_item_type             text,
  p_item_id               uuid
)
RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT contracted_price
  FROM   public.contracted_prices
  WHERE  insurance_provider_id = p_insurance_provider_id
    AND  item_type              = p_item_type
    AND  item_id                = p_item_id
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.trg_contracted_prices_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_contracted_prices_updated_at
  BEFORE UPDATE ON public.contracted_prices
  FOR EACH ROW EXECUTE FUNCTION public.trg_contracted_prices_updated_at();
