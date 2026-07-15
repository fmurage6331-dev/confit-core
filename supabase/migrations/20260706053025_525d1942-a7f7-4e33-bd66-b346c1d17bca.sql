
-- Expand rooms.kind to allow billing
ALTER TABLE public.rooms DROP CONSTRAINT IF EXISTS rooms_kind_check;
ALTER TABLE public.rooms ADD CONSTRAINT rooms_kind_check
  CHECK (kind = ANY (ARRAY['general','lab','triage','consultation','pharmacy','billing']));

-- next_room_id + accountant acknowledgment
ALTER TABLE public.patient_registrations
  ADD COLUMN IF NOT EXISTS next_room_id uuid REFERENCES public.rooms(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS acknowledged_by uuid,
  ADD COLUMN IF NOT EXISTS acknowledged_at timestamptz;

-- Default billing room
INSERT INTO public.rooms (name, code, kind, is_active)
SELECT 'Billing / Cashier', 'BILL', 'billing', true
WHERE NOT EXISTS (SELECT 1 FROM public.rooms WHERE kind = 'billing');

-- Trigger
CREATE OR REPLACE FUNCTION public.route_registration_billing()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE _bill uuid;
BEGIN
  SELECT id INTO _bill FROM public.rooms WHERE kind = 'billing' AND is_active LIMIT 1;

  IF NEW.patient_due > COALESCE(NEW.amount_paid, 0)
     AND NEW.payment_status IN ('unpaid','partial')
     AND _bill IS NOT NULL
     AND (NEW.current_room_id IS NULL OR NEW.current_room_id <> _bill) THEN
    NEW.next_room_id := COALESCE(NEW.next_room_id, NEW.current_room_id);
    NEW.current_room_id := _bill;
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.payment_status IN ('paid','waived')
     AND OLD.payment_status IS DISTINCT FROM NEW.payment_status
     AND NEW.next_room_id IS NOT NULL THEN
    NEW.current_room_id := NEW.next_room_id;
    NEW.next_room_id := NULL;
    IF NEW.acknowledged_at IS NULL THEN
      NEW.acknowledged_at := now();
    END IF;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS zzz_route_billing_ins ON public.patient_registrations;
DROP TRIGGER IF EXISTS zzz_route_billing_upd ON public.patient_registrations;

CREATE TRIGGER zzz_route_billing_ins
BEFORE INSERT ON public.patient_registrations
FOR EACH ROW EXECUTE FUNCTION public.route_registration_billing();

CREATE TRIGGER zzz_route_billing_upd
BEFORE UPDATE ON public.patient_registrations
FOR EACH ROW EXECUTE FUNCTION public.route_registration_billing();
