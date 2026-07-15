
-- 1. Add fields to lab_tests
ALTER TABLE public.lab_tests
  ADD COLUMN IF NOT EXISTS is_positive boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_medical_camp boolean NOT NULL DEFAULT false;

-- 2. Machines
CREATE TABLE public.machines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  model text,
  serial_number text,
  location text,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.machines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved view machines" ON public.machines FOR SELECT TO authenticated USING (is_approved(auth.uid()));
CREATE POLICY "Approved insert machines" ON public.machines FOR INSERT TO authenticated WITH CHECK (is_approved(auth.uid()));
CREATE POLICY "Approved update machines" ON public.machines FOR UPDATE TO authenticated USING (is_approved(auth.uid())) WITH CHECK (is_approved(auth.uid()));
CREATE POLICY "Approved delete machines" ON public.machines FOR DELETE TO authenticated USING (is_approved(auth.uid()));
CREATE TRIGGER trg_machines_updated BEFORE UPDATE ON public.machines FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Machine logs
CREATE TYPE public.machine_log_type AS ENUM ('maintenance', 'service', 'calibration');
CREATE TABLE public.machine_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id uuid NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  log_type public.machine_log_type NOT NULL,
  log_date date NOT NULL DEFAULT CURRENT_DATE,
  performed_by text,
  description text NOT NULL,
  cost numeric(12,2),
  next_due_date date,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.machine_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved view mlogs" ON public.machine_logs FOR SELECT TO authenticated USING (is_approved(auth.uid()));
CREATE POLICY "Approved insert mlogs" ON public.machine_logs FOR INSERT TO authenticated WITH CHECK (is_approved(auth.uid()));
CREATE POLICY "Approved update mlogs" ON public.machine_logs FOR UPDATE TO authenticated USING (is_approved(auth.uid())) WITH CHECK (is_approved(auth.uid()));
CREATE POLICY "Approved delete mlogs" ON public.machine_logs FOR DELETE TO authenticated USING (is_approved(auth.uid()));
CREATE TRIGGER trg_mlogs_updated BEFORE UPDATE ON public.machine_logs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_mlogs_machine ON public.machine_logs(machine_id);
CREATE INDEX idx_mlogs_next_due ON public.machine_logs(next_due_date) WHERE next_due_date IS NOT NULL;

-- 4. Stock items
CREATE TABLE public.stock_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text,
  unit text NOT NULL DEFAULT 'pcs',
  current_quantity numeric(12,2) NOT NULL DEFAULT 0,
  reorder_level numeric(12,2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.stock_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved view stock" ON public.stock_items FOR SELECT TO authenticated USING (is_approved(auth.uid()));
CREATE POLICY "Approved insert stock" ON public.stock_items FOR INSERT TO authenticated WITH CHECK (is_approved(auth.uid()));
CREATE POLICY "Approved update stock" ON public.stock_items FOR UPDATE TO authenticated USING (is_approved(auth.uid())) WITH CHECK (is_approved(auth.uid()));
CREATE POLICY "Approved delete stock" ON public.stock_items FOR DELETE TO authenticated USING (is_approved(auth.uid()));
CREATE TRIGGER trg_stock_updated BEFORE UPDATE ON public.stock_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. Stock movements
CREATE TABLE public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.stock_items(id) ON DELETE CASCADE,
  change numeric(12,2) NOT NULL,
  reason text NOT NULL,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved view smov" ON public.stock_movements FOR SELECT TO authenticated USING (is_approved(auth.uid()));
CREATE POLICY "Approved insert smov" ON public.stock_movements FOR INSERT TO authenticated WITH CHECK (is_approved(auth.uid()));
CREATE POLICY "Approved delete smov" ON public.stock_movements FOR DELETE TO authenticated USING (is_approved(auth.uid()));
CREATE INDEX idx_smov_item ON public.stock_movements(item_id);

-- Trigger to keep stock_items.current_quantity in sync
CREATE OR REPLACE FUNCTION public.apply_stock_movement()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.stock_items SET current_quantity = current_quantity + NEW.change WHERE id = NEW.item_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.stock_items SET current_quantity = current_quantity - OLD.change WHERE id = OLD.item_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER trg_smov_apply AFTER INSERT OR DELETE ON public.stock_movements
  FOR EACH ROW EXECUTE FUNCTION public.apply_stock_movement();

-- 6. Deliveries
CREATE TABLE public.deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_date date NOT NULL DEFAULT CURRENT_DATE,
  supplier text,
  item_name text NOT NULL,
  stock_item_id uuid REFERENCES public.stock_items(id) ON DELETE SET NULL,
  quantity numeric(12,2) NOT NULL,
  unit text,
  batch_number text,
  expiry_date date,
  invoice_number text,
  received_by text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved view deliv" ON public.deliveries FOR SELECT TO authenticated USING (is_approved(auth.uid()));
CREATE POLICY "Approved insert deliv" ON public.deliveries FOR INSERT TO authenticated WITH CHECK (is_approved(auth.uid()));
CREATE POLICY "Approved update deliv" ON public.deliveries FOR UPDATE TO authenticated USING (is_approved(auth.uid())) WITH CHECK (is_approved(auth.uid()));
CREATE POLICY "Approved delete deliv" ON public.deliveries FOR DELETE TO authenticated USING (is_approved(auth.uid()));
CREATE TRIGGER trg_deliv_updated BEFORE UPDATE ON public.deliveries FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto stock movement when delivery linked to stock_item
CREATE OR REPLACE FUNCTION public.delivery_to_stock()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.stock_item_id IS NOT NULL THEN
    INSERT INTO public.stock_movements (item_id, change, reason, notes, created_by)
    VALUES (NEW.stock_item_id, NEW.quantity, 'delivery', 'Delivery #'||COALESCE(NEW.invoice_number, NEW.id::text), NEW.created_by);
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_deliv_stock AFTER INSERT ON public.deliveries
  FOR EACH ROW EXECUTE FUNCTION public.delivery_to_stock();

-- 7. Fund utilizations
CREATE TABLE public.fund_utilizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  util_date date NOT NULL DEFAULT CURRENT_DATE,
  category text NOT NULL CHECK (category IN ('students','staff','external')),
  amount numeric(12,2) NOT NULL,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.fund_utilizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Approved view funds" ON public.fund_utilizations FOR SELECT TO authenticated USING (is_approved(auth.uid()));
CREATE POLICY "Approved insert funds" ON public.fund_utilizations FOR INSERT TO authenticated WITH CHECK (is_approved(auth.uid()));
CREATE POLICY "Approved update funds" ON public.fund_utilizations FOR UPDATE TO authenticated USING (is_approved(auth.uid())) WITH CHECK (is_approved(auth.uid()));
CREATE POLICY "Approved delete funds" ON public.fund_utilizations FOR DELETE TO authenticated USING (is_approved(auth.uid()));
CREATE TRIGGER trg_funds_updated BEFORE UPDATE ON public.fund_utilizations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 8. Disable open signup trigger (admin must create accounts now)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 9. Seed common lab consumables
INSERT INTO public.stock_items (name, category, unit, reorder_level) VALUES
  ('Disposable gloves (Medium)', 'PPE', 'box', 5),
  ('Disposable gloves (Large)', 'PPE', 'box', 5),
  ('Face masks', 'PPE', 'box', 5),
  ('Lab coats', 'PPE', 'pcs', 3),
  ('Microscope slides', 'Consumables', 'box', 10),
  ('Cover slips', 'Consumables', 'box', 10),
  ('Syringes 5ml', 'Consumables', 'pcs', 50),
  ('Syringes 10ml', 'Consumables', 'pcs', 50),
  ('Test tubes', 'Consumables', 'pcs', 50),
  ('EDTA blood tubes', 'Consumables', 'pcs', 50),
  ('Plain blood tubes', 'Consumables', 'pcs', 50),
  ('Pipette tips', 'Consumables', 'box', 5),
  ('Cotton swabs', 'Consumables', 'pack', 5),
  ('Alcohol swabs', 'Consumables', 'pack', 5),
  ('Distilled water', 'Reagents', 'L', 5),
  ('Giemsa stain', 'Reagents', 'bottle', 2),
  ('Methanol', 'Reagents', 'L', 2),
  ('HIV test kits', 'Test kits', 'pcs', 20),
  ('Malaria RDT kits', 'Test kits', 'pcs', 20),
  ('Pregnancy test kits', 'Test kits', 'pcs', 20),
  ('Urinalysis strips', 'Test kits', 'box', 5),
  ('Glucose strips', 'Test kits', 'box', 5);
