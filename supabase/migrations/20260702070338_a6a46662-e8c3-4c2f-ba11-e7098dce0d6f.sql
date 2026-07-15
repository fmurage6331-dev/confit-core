
-- 1) Services & lab test catalog: add category, kind, per-mode prices
ALTER TABLE public.lab_test_catalog
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'lab',
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS cash_price numeric(10,2),
  ADD COLUMN IF NOT EXISTS insurance_price numeric(10,2);

-- Backfill cash_price from price where missing
UPDATE public.lab_test_catalog SET cash_price = price WHERE cash_price IS NULL;

-- 2) Stock items: pharmaceutical / non_pharmaceutical / consumable
ALTER TABLE public.stock_items
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'consumable';

-- 3) Trigger: only auto-route to lab when tests exist and no current room set.
-- Fire on INSERT and UPDATE so adding tests later (from consultation) routes to lab.
CREATE OR REPLACE FUNCTION public.route_registration_to_lab()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE _lab uuid;
BEGIN
  IF NEW.tests IS NOT NULL
     AND jsonb_array_length(NEW.tests) > 0
     AND (NEW.current_room_id IS NULL
          OR EXISTS (SELECT 1 FROM public.rooms r
                     WHERE r.id = NEW.current_room_id AND r.kind <> 'lab')) THEN
    -- Only reroute if any test is a lab kind
    IF EXISTS (
      SELECT 1
      FROM jsonb_array_elements(NEW.tests) t
      JOIN public.lab_test_catalog c ON c.id = (t->>'id')::uuid
      WHERE COALESCE(c.kind,'lab') = 'lab'
    ) THEN
      SELECT id INTO _lab FROM public.rooms WHERE kind='lab' AND is_active LIMIT 1;
      IF _lab IS NOT NULL THEN NEW.current_room_id := _lab; END IF;
    END IF;
  END IF;
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS trg_route_registration_to_lab_ins ON public.patient_registrations;
DROP TRIGGER IF EXISTS trg_route_registration_to_lab_upd ON public.patient_registrations;
CREATE TRIGGER trg_route_registration_to_lab_ins
  BEFORE INSERT ON public.patient_registrations
  FOR EACH ROW EXECUTE FUNCTION public.route_registration_to_lab();
CREATE TRIGGER trg_route_registration_to_lab_upd
  BEFORE UPDATE OF tests ON public.patient_registrations
  FOR EACH ROW EXECUTE FUNCTION public.route_registration_to_lab();

-- 4) Permissions for the new services admin surface (reuse existing catalog perm if any)
INSERT INTO public.role_permissions (role, permission) VALUES
  ('admin','services.manage')
ON CONFLICT DO NOTHING;
