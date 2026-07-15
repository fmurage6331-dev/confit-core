
-- Extend room kinds: triage, consultation, pharmacy
ALTER TABLE public.rooms DROP CONSTRAINT IF EXISTS rooms_kind_check;
ALTER TABLE public.rooms ADD CONSTRAINT rooms_kind_check
  CHECK (kind IN ('general','lab','triage','consultation','pharmacy'));

-- Clinical fields on patient_registrations
ALTER TABLE public.patient_registrations
  ADD COLUMN IF NOT EXISTS vitals jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS history jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS diagnoses jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Prescriptions table
CREATE TABLE IF NOT EXISTS public.prescriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid NOT NULL REFERENCES public.patient_registrations(id) ON DELETE CASCADE,
  stock_item_id uuid REFERENCES public.stock_items(id) ON DELETE SET NULL,
  drug_name text NOT NULL,
  dosage text,
  frequency text,
  duration text,
  quantity numeric NOT NULL DEFAULT 1,
  notes text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','dispensed','cancelled')),
  created_by uuid REFERENCES auth.users(id),
  dispensed_by uuid REFERENCES auth.users(id),
  dispensed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prescriptions TO authenticated;
GRANT ALL ON public.prescriptions TO service_role;

ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved staff can view prescriptions" ON public.prescriptions
  FOR SELECT TO authenticated USING (public.is_approved(auth.uid()));
CREATE POLICY "Approved staff can insert prescriptions" ON public.prescriptions
  FOR INSERT TO authenticated WITH CHECK (public.is_approved(auth.uid()));
CREATE POLICY "Approved staff can update prescriptions" ON public.prescriptions
  FOR UPDATE TO authenticated USING (public.is_approved(auth.uid())) WITH CHECK (public.is_approved(auth.uid()));
CREATE POLICY "Admins can delete prescriptions" ON public.prescriptions
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE INDEX IF NOT EXISTS prescriptions_registration_idx ON public.prescriptions(registration_id);
CREATE INDEX IF NOT EXISTS prescriptions_status_idx ON public.prescriptions(status);

CREATE TRIGGER trg_prescriptions_updated
  BEFORE UPDATE ON public.prescriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- On INSERT of a pending prescription, route patient to pharmacy room
CREATE OR REPLACE FUNCTION public.route_prescription_to_pharmacy()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE _pharm uuid;
BEGIN
  IF NEW.status = 'pending' THEN
    SELECT id INTO _pharm FROM public.rooms WHERE kind='pharmacy' AND is_active LIMIT 1;
    IF _pharm IS NOT NULL THEN
      UPDATE public.patient_registrations
        SET current_room_id = _pharm
        WHERE id = NEW.registration_id
          AND (current_room_id IS NULL OR current_room_id <> _pharm);
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_route_prescription_to_pharmacy ON public.prescriptions;
CREATE TRIGGER trg_route_prescription_to_pharmacy
  AFTER INSERT ON public.prescriptions
  FOR EACH ROW EXECUTE FUNCTION public.route_prescription_to_pharmacy();

-- On dispense, decrement stock if linked to stock item
CREATE OR REPLACE FUNCTION public.dispense_prescription_stock()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status = 'dispensed' AND (OLD.status IS DISTINCT FROM 'dispensed') AND NEW.stock_item_id IS NOT NULL THEN
    INSERT INTO public.stock_movements (item_id, change, reason, notes, created_by)
    VALUES (NEW.stock_item_id, -ABS(NEW.quantity), 'dispense',
            'Prescription '||NEW.id::text||' for reg '||NEW.registration_id::text,
            COALESCE(NEW.dispensed_by, NEW.created_by));
    IF NEW.dispensed_at IS NULL THEN NEW.dispensed_at := now(); END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_dispense_prescription_stock ON public.prescriptions;
CREATE TRIGGER trg_dispense_prescription_stock
  BEFORE UPDATE ON public.prescriptions
  FOR EACH ROW EXECUTE FUNCTION public.dispense_prescription_stock();
