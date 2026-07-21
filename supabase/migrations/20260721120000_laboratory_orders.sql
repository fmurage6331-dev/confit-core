-- Laboratory worklist: mirrors the radiology_orders / radiology_results pattern
-- so Laboratory becomes a live order-driven queue instead of a manual
-- "type in the registration number" form (that flow stays in place on
-- lab_tests / Records for now — nothing here touches it).
--
-- Flow: a room adds a kind='lab' item to tests (written through the
-- patient_registrations view, which lands on the real encounters table) ->
-- trigger below (attached to encounters, since regular AFTER triggers can't
-- fire on a view) creates a lab_orders row ('ordered') -> lab tech picks it
-- up on /laboratory (status -> in_progress) -> enters results on
-- /laboratory/$id and finalizes (status -> completed) -> lab_results row
-- holds the structured result (same {version, parameters, summary} shape as
-- the existing ParameterTable / StructuredResult component used on Records).

CREATE SEQUENCE IF NOT EXISTS public.lab_order_seq START WITH 10001 INCREMENT BY 1;

CREATE TABLE public.lab_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text DEFAULT ('ORD-' || lpad(nextval('public.lab_order_seq')::text, 5, '0')),
  encounter_id uuid REFERENCES public.encounters(id) ON DELETE CASCADE,
  patient_id uuid REFERENCES public.patients(id),
  catalog_id uuid REFERENCES public.lab_test_catalog(id),
  requested_by_room_id uuid REFERENCES public.rooms(id),
  ordered_by uuid,
  priority text NOT NULL DEFAULT 'routine' CHECK (priority IN ('routine', 'urgent', 'stat')),
  status text NOT NULL DEFAULT 'ordered' CHECK (status IN ('ordered', 'in_progress', 'completed', 'declined')),
  instructions text,
  decline_reason text,
  ordered_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_lab_orders_encounter ON public.lab_orders(encounter_id);
CREATE INDEX idx_lab_orders_status ON public.lab_orders(status);

CREATE TRIGGER set_lab_orders_updated_at
  BEFORE UPDATE ON public.lab_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.lab_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.lab_orders(id) ON DELETE CASCADE,
  result jsonb,
  performed_by text,
  reported_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_lab_results_order ON public.lab_results(order_id);

CREATE TRIGGER set_lab_results_updated_at
  BEFORE UPDATE ON public.lab_results
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Same pattern as sync_radiology_orders_from_tests(), for kind='lab' items,
-- and tags each order with whichever room requested that specific test
-- (tests[].requested_by_room_id) so results can route back correctly.
CREATE OR REPLACE FUNCTION public.sync_lab_orders_from_tests()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _test jsonb;
  _kind text;
  _catalog_id uuid;
  _room_id uuid;
  _existing_count int;
BEGIN
  IF NEW.tests IS NOT NULL THEN
    FOR _test IN SELECT * FROM jsonb_array_elements(NEW.tests) LOOP
      _catalog_id := (_test->>'id')::uuid;
      SELECT kind INTO _kind FROM lab_test_catalog WHERE id = _catalog_id;

      IF _kind = 'lab' THEN
        SELECT COUNT(*) INTO _existing_count
        FROM lab_orders
        WHERE encounter_id = NEW.id AND catalog_id = _catalog_id;

        IF _existing_count = 0 THEN
          _room_id := NULLIF(_test->>'requested_by_room_id', '')::uuid;
          INSERT INTO lab_orders (encounter_id, patient_id, catalog_id, ordered_by, requested_by_room_id, status)
          VALUES (NEW.id, NEW.patient_id, _catalog_id, NEW.created_by, _room_id, 'ordered');
        END IF;
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_lab_orders_from_tests ON public.encounters;
CREATE TRIGGER trg_sync_lab_orders_from_tests
  AFTER INSERT OR UPDATE OF tests ON public.encounters
  FOR EACH ROW EXECUTE FUNCTION public.sync_lab_orders_from_tests();

-- Backfill: create lab_orders for any kind='lab' items already sitting on
-- open registrations from before this migration ran, so the worklist isn't
-- empty on day one.
DO $backfill$
DECLARE
  _reg record;
  _test jsonb;
  _kind text;
  _catalog_id uuid;
  _room_id uuid;
  _existing_count int;
BEGIN
  FOR _reg IN SELECT id, patient_id, tests, created_by FROM public.encounters WHERE tests IS NOT NULL LOOP
    FOR _test IN SELECT * FROM jsonb_array_elements(_reg.tests) LOOP
      _catalog_id := (_test->>'id')::uuid;
      SELECT kind INTO _kind FROM lab_test_catalog WHERE id = _catalog_id;
      IF _kind = 'lab' THEN
        SELECT COUNT(*) INTO _existing_count FROM lab_orders WHERE encounter_id = _reg.id AND catalog_id = _catalog_id;
        IF _existing_count = 0 THEN
          _room_id := NULLIF(_test->>'requested_by_room_id', '')::uuid;
          INSERT INTO lab_orders (encounter_id, patient_id, catalog_id, ordered_by, requested_by_room_id, status)
          VALUES (_reg.id, _reg.patient_id, _catalog_id, _reg.created_by, _room_id, 'ordered');
        END IF;
      END IF;
    END LOOP;
  END LOOP;
END;
$backfill$;

-- Permissions. Mirrors the radiology_view / radiology_update /
-- radiology_results_create keys the frontend already expects — those three
-- were referenced in radiology.$id.tsx but were never actually granted to
-- any role, so radiologists other than admin couldn't use that page. Fixing
-- that here alongside the new lab_* keys.
INSERT INTO public.role_permissions (role, permission) VALUES
  ('lab_tech', 'lab_view'),
  ('lab_tech', 'lab_update'),
  ('lab_tech', 'lab_results_create'),
  ('staff', 'lab_view'),
  ('staff', 'lab_update'),
  ('staff', 'lab_results_create'),
  ('radiologist', 'radiology_view'),
  ('radiologist', 'radiology_update'),
  ('radiologist', 'radiology_results_create'),
  ('lab_tech', 'radiology_view'),
  ('staff', 'radiology_view')
ON CONFLICT DO NOTHING;
