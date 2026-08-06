-- RLS Enforcement — 6 tables found with RLS disabled
-- lab_orders + lab_results = HIGH risk (patient clinical data)
-- encounter_room_visits = MEDIUM risk (patient movement data)
-- icd11_codes, moh_indicator_definitions, room_indicator_map = LOW (reference data)

-- 1. lab_orders
ALTER TABLE public.lab_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lab_orders_select" ON public.lab_orders FOR SELECT TO authenticated USING (public.is_approved(auth.uid()));
CREATE POLICY "lab_orders_insert" ON public.lab_orders FOR INSERT TO authenticated WITH CHECK (public.is_approved(auth.uid()));
CREATE POLICY "lab_orders_update" ON public.lab_orders FOR UPDATE TO authenticated USING (public.is_approved(auth.uid()));
CREATE POLICY "lab_orders_delete" ON public.lab_orders FOR DELETE TO authenticated USING (public.is_approved(auth.uid()));

-- 2. lab_results
ALTER TABLE public.lab_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lab_results_select" ON public.lab_results FOR SELECT TO authenticated USING (public.is_approved(auth.uid()));
CREATE POLICY "lab_results_insert" ON public.lab_results FOR INSERT TO authenticated WITH CHECK (public.is_approved(auth.uid()));
CREATE POLICY "lab_results_update" ON public.lab_results FOR UPDATE TO authenticated USING (public.is_approved(auth.uid()));
CREATE POLICY "lab_results_delete" ON public.lab_results FOR DELETE TO authenticated USING (public.is_approved(auth.uid()));

-- 3. encounter_room_visits
ALTER TABLE public.encounter_room_visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "encounter_room_visits_select" ON public.encounter_room_visits FOR SELECT TO authenticated USING (public.is_approved(auth.uid()));
CREATE POLICY "encounter_room_visits_insert" ON public.encounter_room_visits FOR INSERT TO authenticated WITH CHECK (public.is_approved(auth.uid()));
CREATE POLICY "encounter_room_visits_update" ON public.encounter_room_visits FOR UPDATE TO authenticated USING (public.is_approved(auth.uid()));
CREATE POLICY "encounter_room_visits_delete" ON public.encounter_room_visits FOR DELETE TO authenticated USING (public.is_approved(auth.uid()));

-- 4. icd11_codes (read-only reference)
ALTER TABLE public.icd11_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "icd11_codes_select" ON public.icd11_codes FOR SELECT TO authenticated USING (public.is_approved(auth.uid()));

-- 5. moh_indicator_definitions (read-only reference)
ALTER TABLE public.moh_indicator_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "moh_indicator_definitions_select" ON public.moh_indicator_definitions FOR SELECT TO authenticated USING (public.is_approved(auth.uid()));

-- 6. room_indicator_map (read-only reference)
ALTER TABLE public.room_indicator_map ENABLE ROW LEVEL SECURITY;
CREATE POLICY "room_indicator_map_select" ON public.room_indicator_map FOR SELECT TO authenticated USING (public.is_approved(auth.uid()));
