SET check_function_bodies = false;

CREATE TYPE public.app_role AS ENUM (
    'admin', 'staff', 'accountant', 'lab_tech', 'records_officer',
    'doctor', 'clinical_officer', 'nurse', 'radiologist', 'pharmacist', 'mortician'
);

CREATE TYPE public.machine_log_type AS ENUM ('maintenance', 'service', 'calibration');

CREATE FUNCTION public.accrue_daily_bed_charges() RETURNS void LANGUAGE plpgsql AS $$
DECLARE _adm RECORD; _invoice_id uuid;
BEGIN
  FOR _adm IN SELECT a.id AS admission_id, a.encounter_id, a.ward_id, w.daily_rate, w.name AS ward_name FROM admissions a JOIN wards w ON w.id = a.ward_id WHERE a.status = 'admitted' LOOP
    SELECT id INTO _invoice_id FROM invoices WHERE encounter_id = _adm.encounter_id ORDER BY created_at ASC LIMIT 1;
    IF _invoice_id IS NOT NULL THEN
      INSERT INTO invoice_line_items (invoice_id, encounter_id, item_type, source_id, description, quantity, unit_price, amount)
      VALUES (_invoice_id, _adm.encounter_id, 'bed_day', _adm.admission_id, _adm.ward_name || ' - bed charge (' || to_char(now(), 'YYYY-MM-DD') || ')', 1, _adm.daily_rate, _adm.daily_rate);
    END IF;
  END LOOP;
END; $$;

CREATE FUNCTION public.apply_stock_movement() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN UPDATE public.stock_items SET current_quantity = current_quantity + NEW.change WHERE id = NEW.item_id; RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN UPDATE public.stock_items SET current_quantity = current_quantity - OLD.change WHERE id = OLD.item_id; RETURN OLD;
  END IF; RETURN NULL;
END; $$;

CREATE FUNCTION public.assign_patient_file_number() RETURNS trigger LANGUAGE plpgsql AS $$
begin
  if NEW.file_number is null or trim(NEW.file_number) = '' or exists (select 1 from patients where file_number = NEW.file_number) then
    NEW.file_number := 'P' || lpad(nextval('patient_file_seq')::text, 6, '0');
    while exists (select 1 from patients where file_number = NEW.file_number) loop
      NEW.file_number := 'P' || lpad(nextval('patient_file_seq')::text, 6, '0');
    end loop;
  end if;
  return NEW;
end; $$;

CREATE FUNCTION public.audit_trigger_fn() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO audit_log (table_name, record_id, action, old_data, new_data, changed_by)
  VALUES (TG_TABLE_NAME, COALESCE(NEW.id, OLD.id), TG_OP,
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) ELSE NULL END, auth.uid());
  RETURN COALESCE(NEW, OLD);
END; $$;

CREATE FUNCTION public.can_access_room(_user uuid, _room uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.has_role(_user, 'admin'::public.app_role) OR EXISTS (SELECT 1 FROM public.user_room_access WHERE user_id = _user AND room_id = _room);
$$;

CREATE FUNCTION public.clean_and_validate_diagnosis_insert() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_validated_title TEXT; v_clean_code TEXT;
BEGIN
    IF NEW.icd11_code IS NULL OR UPPER(TRIM(NEW.icd11_code)) = 'NO CODE' OR TRIM(NEW.icd11_code) = '' THEN
        NEW.icd11_code := 'UNCODED';
    ELSE
        v_clean_code := UPPER(TRIM(NEW.icd11_code));
        NEW.icd11_code := v_clean_code;
        SELECT p_title INTO v_validated_title FROM public.validate_and_get_icd11(v_clean_code);
        IF v_validated_title IS NOT NULL THEN NEW.diagnosis_name := v_validated_title; END IF;
    END IF;
    RETURN NEW;
END; $$;

CREATE FUNCTION public.create_invoice_for_encounter() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN INSERT INTO invoices (encounter_id, patient_id, created_by) VALUES (NEW.id, NEW.patient_id, NEW.created_by); RETURN NEW; END; $$;

CREATE FUNCTION public.delivery_to_stock() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.stock_item_id IS NOT NULL THEN
    INSERT INTO public.stock_movements (item_id, change, reason, notes, created_by)
    VALUES (NEW.stock_item_id, NEW.quantity, 'delivery', 'Delivery #'||COALESCE(NEW.invoice_number, NEW.id::text), NEW.created_by);
  END IF; RETURN NEW;
END; $$;

CREATE FUNCTION public.dispense_prescription_stock() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status = 'dispensed' AND (OLD.status IS DISTINCT FROM 'dispensed') AND NEW.stock_item_id IS NOT NULL THEN
    INSERT INTO public.stock_movements (item_id, change, reason, notes, created_by)
    VALUES (NEW.stock_item_id, -ABS(NEW.quantity), 'dispense', 'Prescription '||NEW.id::text||' for reg '||NEW.registration_id::text, COALESCE(NEW.dispensed_by, NEW.created_by));
    IF NEW.dispensed_at IS NULL THEN NEW.dispensed_at := now(); END IF;
  END IF; RETURN NEW;
END $$;

CREATE FUNCTION public.enforce_encounter_lock() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_encounter_status TEXT;
BEGIN
    SELECT status INTO v_encounter_status FROM public.encounters WHERE id = COALESCE(NEW.encounter_id, OLD.encounter_id);
    IF v_encounter_status IN ('signed', 'finalized', 'completed') THEN
        RAISE EXCEPTION 'Encounter Integrity Error: This encounter has been signed/locked and cannot be modified.';
    END IF;
    IF (TG_OP = 'DELETE') THEN RETURN OLD; ELSE RETURN NEW; END IF;
END; $$;

CREATE FUNCTION public.get_return_room(p_encounter_id uuid) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE _room_id uuid;
BEGIN
  SELECT erv.room_id INTO _room_id FROM encounter_room_visits erv JOIN rooms r ON r.id = erv.room_id
  WHERE erv.encounter_id = p_encounter_id AND r.kind NOT IN ('billing', 'lab') ORDER BY erv.entered_at DESC LIMIT 1;
  RETURN _room_id;
END; $$;

CREATE FUNCTION public.handle_new_user_access_request() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN INSERT INTO public.access_requests (user_id, email) VALUES (NEW.id, NEW.email) ON CONFLICT (user_id) DO NOTHING; RETURN NEW; END; $$;

CREATE FUNCTION public.has_role(allowed_roles text[]) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN RETURN EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role::text = ANY(allowed_roles)); END; $$;

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE FUNCTION public.is_approved(_user_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','staff','accountant','lab_tech','records_officer'))
$$;

CREATE FUNCTION public.log_encounter_room_visit() RETURNS trigger LANGUAGE plpgsql AS $$
begin
  if TG_OP = 'INSERT' then
    if NEW.current_room_id is not null then
      insert into encounter_room_visits (encounter_id, room_id, entered_at) values (NEW.id, NEW.current_room_id, now());
    end if; return NEW;
  end if;
  if TG_OP = 'UPDATE' then
    if NEW.current_room_id is distinct from OLD.current_room_id then
      if OLD.current_room_id is not null then
        update encounter_room_visits set left_at = now() where encounter_id = OLD.id and room_id = OLD.current_room_id and left_at is null;
      end if;
      if NEW.current_room_id is not null then
        insert into encounter_room_visits (encounter_id, room_id, entered_at) values (NEW.id, NEW.current_room_id, now());
      end if;
    end if; return NEW;
  end if; return NEW;
end; $$;

CREATE FUNCTION public.patient_registrations_instead_insert() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _patient_id uuid; _encounter_id uuid := COALESCE(NEW.id, gen_random_uuid());
BEGIN
  IF NEW.file_number IS NOT NULL THEN SELECT id INTO _patient_id FROM patients WHERE file_number = NEW.file_number; END IF;
  IF _patient_id IS NULL THEN
    INSERT INTO patients (file_number, first_name, middle_name, family_name, patient_name, date_of_birth, dob_known, estimated_age, sex, phone, email, address_line1, address_line2, city, county, postal_code, country, occupation, marital_status, nationality, religion, education_level, is_deceased, date_of_death, cause_of_death, next_of_kin, relationships, created_by)
    VALUES (NEW.file_number, NEW.first_name, NEW.middle_name, NEW.family_name, NEW.patient_name, NEW.date_of_birth, NEW.dob_known, NEW.estimated_age, NEW.sex, NEW.phone, NEW.email, NEW.address_line1, NEW.address_line2, NEW.city, NEW.county, NEW.postal_code, NEW.country, NEW.occupation, NEW.marital_status, NEW.nationality, NEW.religion, NEW.education_level, NEW.is_deceased, NEW.date_of_death, NEW.cause_of_death, NEW.next_of_kin, NEW.relationships, NEW.created_by)
    RETURNING id INTO _patient_id;
  END IF;
  INSERT INTO encounters (id, patient_id, payment_mode, insurance_provider_id, insurance_coverage_percentage, tests, subtotal, insurance_covered, patient_due, status, notes, payment_status, amount_paid, paid_at, paid_by, payment_method, payment_reference, from_room, current_room_id, next_room_id, vitals, history, diagnoses, acknowledged_by, acknowledged_at, created_by)
  VALUES (_encounter_id, _patient_id, NEW.payment_mode, NEW.insurance_provider_id, NEW.insurance_coverage_percentage, NEW.tests, NEW.subtotal, NEW.insurance_covered, NEW.patient_due, NEW.status, NEW.notes, NEW.payment_status, NEW.amount_paid, NEW.paid_at, NEW.paid_by, NEW.payment_method, NEW.payment_reference, NEW.from_room, NEW.current_room_id, NEW.next_room_id, NEW.vitals, NEW.history, NEW.diagnoses, NEW.acknowledged_by, NEW.acknowledged_at, NEW.created_by);
  NEW.id := _encounter_id; RETURN NEW;
END; $$;

CREATE FUNCTION public.patient_registrations_instead_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE patients SET file_number = NEW.file_number, first_name = NEW.first_name, middle_name = NEW.middle_name, family_name = NEW.family_name, patient_name = NEW.patient_name, date_of_birth = NEW.date_of_birth, dob_known = NEW.dob_known, estimated_age = NEW.estimated_age, sex = NEW.sex, phone = NEW.phone, email = NEW.email, address_line1 = NEW.address_line1, address_line2 = NEW.address_line2, city = NEW.city, county = NEW.county, postal_code = NEW.postal_code, country = NEW.country, occupation = NEW.occupation, marital_status = NEW.marital_status, nationality = NEW.nationality, religion = NEW.religion, education_level = NEW.education_level, is_deceased = NEW.is_deceased, date_of_death = NEW.date_of_death, cause_of_death = NEW.cause_of_death, next_of_kin = NEW.next_of_kin, relationships = NEW.relationships, updated_at = now()
  WHERE id = (SELECT patient_id FROM encounters WHERE id = OLD.id);
  UPDATE encounters SET payment_mode = NEW.payment_mode, insurance_provider_id = NEW.insurance_provider_id, insurance_coverage_percentage = NEW.insurance_coverage_percentage, tests = NEW.tests, subtotal = NEW.subtotal, insurance_covered = NEW.insurance_covered, patient_due = NEW.patient_due, status = NEW.status, notes = NEW.notes, payment_status = NEW.payment_status, amount_paid = NEW.amount_paid, paid_at = NEW.paid_at, paid_by = NEW.paid_by, payment_method = NEW.payment_method, payment_reference = NEW.payment_reference, from_room = NEW.from_room, current_room_id = NEW.current_room_id, next_room_id = NEW.next_room_id, vitals = NEW.vitals, history = NEW.history, diagnoses = NEW.diagnoses, acknowledged_by = NEW.acknowledged_by, acknowledged_at = NEW.acknowledged_at
  WHERE id = OLD.id;
  RETURN NEW;
END; $$;

CREATE FUNCTION public.process_encounter_indicators() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE patient_age INT; def RECORD;
BEGIN
  SELECT EXTRACT(YEAR FROM AGE(date_of_birth)) INTO patient_age FROM patients WHERE id = NEW.patient_id;
  FOR def IN SELECT * FROM moh_indicator_definitions LOOP
    IF def.criteria_type = 'age_range' THEN
      IF def.criteria_value = '<5' AND patient_age < 5 THEN
        INSERT INTO encounter_indicator_tags (encounter_id, indicator_code) VALUES (NEW.id, def.indicator_code);
      ELSIF def.criteria_value = '>=5' AND patient_age >= 5 THEN
        INSERT INTO encounter_indicator_tags (encounter_id, indicator_code) VALUES (NEW.id, def.indicator_code);
      END IF;
    ELSIF def.criteria_type = 'lab_test' AND EXISTS (SELECT 1 FROM jsonb_array_elements(NEW.tests) t JOIN lab_test_catalog c ON c.id = (t->>'id')::uuid WHERE c.category = def.criteria_value) THEN
      INSERT INTO encounter_indicator_tags (encounter_id, indicator_code) VALUES (NEW.id, def.indicator_code);
    END IF;
  END LOOP;
  RETURN NEW;
END; $$;

CREATE FUNCTION public.recalc_encounter_subtotal() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _subtotal numeric;
BEGIN
  SELECT COALESCE(SUM((t->>'price')::numeric), 0) INTO _subtotal FROM jsonb_array_elements(NEW.tests) t;
  NEW.subtotal := _subtotal; NEW.patient_due := _subtotal - COALESCE(NEW.insurance_covered, 0);
  RETURN NEW;
END; $$;

CREATE FUNCTION public.recalc_invoice_payments() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _invoice_id uuid; _paid numeric; _total_due numeric;
BEGIN
  _invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);
  SELECT COALESCE(SUM(amount), 0) INTO _paid FROM invoice_payments WHERE invoice_id = _invoice_id;
  SELECT total_due INTO _total_due FROM invoices WHERE id = _invoice_id;
  UPDATE invoices SET amount_paid = _paid, balance = _total_due - _paid,
    status = CASE WHEN _total_due - _paid <= 0 AND _total_due > 0 THEN 'paid' WHEN _paid > 0 THEN 'partial' WHEN _total_due > 0 THEN 'unpaid' ELSE 'draft' END, updated_at = now()
  WHERE id = _invoice_id;
  RETURN NULL;
END; $$;

CREATE FUNCTION public.recalc_invoice_totals() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _invoice_id uuid; _subtotal numeric;
BEGIN
  _invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);
  SELECT COALESCE(SUM(amount), 0) INTO _subtotal FROM invoice_line_items WHERE invoice_id = _invoice_id;
  UPDATE invoices SET subtotal = _subtotal, total_due = _subtotal - discount - insurance_covered,
    balance = (_subtotal - discount - insurance_covered) - amount_paid,
    status = CASE WHEN (_subtotal - discount - insurance_covered) - amount_paid <= 0 AND _subtotal > 0 THEN 'paid' WHEN amount_paid > 0 THEN 'partial' WHEN _subtotal > 0 THEN 'unpaid' ELSE 'draft' END, updated_at = now()
  WHERE id = _invoice_id;
  RETURN NULL;
END; $$;

CREATE FUNCTION public.refresh_moh_aggregates(target_month date) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
    DELETE FROM moh_monthly_aggregates WHERE period_month = target_month;
    INSERT INTO moh_monthly_aggregates (indicator_code, period_month, value, computed_at)
    SELECT eit.indicator_code, target_month, COUNT(*)::numeric, NOW()
    FROM encounter_indicator_tags eit WHERE date_trunc('month', eit.tagged_at)::date = target_month
    GROUP BY eit.indicator_code;
END; $$;

CREATE FUNCTION public.require_discharge_summary() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status = 'discharged' AND OLD.status IS DISTINCT FROM 'discharged' THEN
    IF NOT EXISTS (SELECT 1 FROM clinical_notes WHERE admission_id = NEW.id AND note_type = 'discharge_note') THEN
      RAISE EXCEPTION 'Cannot discharge patient without a discharge summary. Please add a discharge note first.';
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE FUNCTION public.route_prescription_to_pharmacy() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE _pharm uuid;
BEGIN
  IF NEW.status = 'pending' THEN
    SELECT id INTO _pharm FROM public.rooms WHERE kind='pharmacy' AND is_active LIMIT 1;
    IF _pharm IS NOT NULL THEN
      UPDATE public.encounters SET current_room_id = _pharm WHERE id = NEW.registration_id AND (current_room_id IS NULL OR current_room_id <> _pharm);
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION public.route_registration_billing() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _bill uuid;
BEGIN
  SELECT id INTO _bill FROM public.rooms WHERE kind = 'billing' AND is_active LIMIT 1;
  IF NEW.patient_due > COALESCE(NEW.amount_paid, 0) AND NEW.payment_status IN ('unpaid','partial') AND _bill IS NOT NULL AND (NEW.current_room_id IS NULL OR NEW.current_room_id <> _bill) THEN
    NEW.next_room_id := COALESCE(NEW.next_room_id, NEW.current_room_id);
    NEW.current_room_id := _bill;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.payment_status IN ('paid','waived') AND OLD.payment_status IS DISTINCT FROM NEW.payment_status AND NEW.next_room_id IS NOT NULL THEN
    NEW.current_room_id := NEW.next_room_id; NEW.next_room_id := NULL;
    IF NEW.acknowledged_at IS NULL THEN NEW.acknowledged_at := now(); END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION public.route_registration_to_lab() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE _lab uuid;
BEGIN
  IF NEW.tests IS NOT NULL AND jsonb_array_length(NEW.tests) > 0 AND (NEW.current_room_id IS NULL OR EXISTS (SELECT 1 FROM public.rooms r WHERE r.id = NEW.current_room_id AND r.kind <> 'lab')) THEN
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(NEW.tests) t JOIN public.lab_test_catalog c ON c.id = (t->>'id')::uuid WHERE COALESCE(c.kind,'lab') = 'lab') THEN
      SELECT id INTO _lab FROM public.rooms WHERE kind='lab' AND is_active LIMIT 1;
      IF _lab IS NOT NULL THEN NEW.current_room_id := _lab; END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE FUNCTION public.route_registration_to_service_room() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _room uuid; _has_lab boolean;
BEGIN
  IF NEW.tests IS NOT NULL AND jsonb_array_length(NEW.tests) > 0 THEN
    SELECT EXISTS (SELECT 1 FROM jsonb_array_elements(NEW.tests) t JOIN lab_test_catalog c ON c.id = (t->>'id')::uuid WHERE COALESCE(c.kind,'lab') = 'lab') INTO _has_lab;
    IF NOT _has_lab THEN
      SELECT c.target_room_id INTO _room FROM jsonb_array_elements(NEW.tests) t JOIN lab_test_catalog c ON c.id = (t->>'id')::uuid WHERE c.target_room_id IS NOT NULL LIMIT 1;
      IF _room IS NOT NULL THEN NEW.current_room_id := _room; END IF;
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE FUNCTION public.send_lab_results_to_requesting_room(p_encounter_id uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _room_id uuid;
BEGIN
  SELECT erv.room_id INTO _room_id FROM encounter_room_visits erv JOIN rooms r ON r.id = erv.room_id
  WHERE erv.encounter_id = p_encounter_id AND r.kind NOT IN ('billing', 'lab') ORDER BY erv.entered_at DESC LIMIT 1;
  IF _room_id IS NULL THEN RAISE EXCEPTION 'Could not determine a room to send this encounter back to'; END IF;
  UPDATE encounters SET current_room_id = _room_id WHERE id = p_encounter_id;
  RETURN _room_id;
END; $$;

CREATE FUNCTION public.set_appointment_time_range() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  NEW.time_range := tstzrange(NEW.scheduled_at, NEW.scheduled_at + (NEW.duration_minutes || ' minutes')::interval, '[)');
  RETURN NEW;
END; $$;

CREATE FUNCTION public.set_patient_file_number() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.file_number IS NULL OR btrim(NEW.file_number) = '' THEN
    NEW.file_number := 'P' || lpad(nextval('public.patient_file_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END; $$;

CREATE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE FUNCTION public.sync_bed_status_on_admission() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'admitted' THEN
    UPDATE beds SET status = 'occupied', updated_at = now() WHERE id = NEW.bed_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IN ('discharged','transferred') AND OLD.status = 'admitted' THEN
      UPDATE beds SET status = 'available', updated_at = now() WHERE id = OLD.bed_id;
    END IF;
    IF NEW.status = 'admitted' AND NEW.bed_id IS DISTINCT FROM OLD.bed_id THEN
      UPDATE beds SET status = 'occupied', updated_at = now() WHERE id = NEW.bed_id;
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE FUNCTION public.sync_encounter_from_invoice_payment() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _encounter_id uuid; _paid numeric;
BEGIN
  SELECT encounter_id INTO _encounter_id FROM invoices WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);
  SELECT COALESCE(SUM(amount),0) INTO _paid FROM invoice_payments WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id);
  UPDATE encounters SET amount_paid = _paid,
    payment_status = CASE WHEN _paid >= subtotal AND subtotal > 0 THEN 'paid' WHEN _paid > 0 THEN 'partial' ELSE 'unpaid' END
  WHERE id = _encounter_id;
  RETURN NULL;
END; $$;

CREATE FUNCTION public.sync_invoice_from_encounter_payment() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _invoice_id uuid;
BEGIN
  IF NEW.amount_paid IS DISTINCT FROM OLD.amount_paid OR NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
    SELECT id INTO _invoice_id FROM invoices WHERE encounter_id = NEW.id ORDER BY created_at ASC LIMIT 1;
    IF _invoice_id IS NOT NULL THEN
      UPDATE invoices SET amount_paid = NEW.amount_paid, balance = total_due - NEW.amount_paid,
        status = CASE WHEN NEW.payment_status = 'waived' THEN 'waived' WHEN total_due - NEW.amount_paid <= 0 AND total_due > 0 THEN 'paid' WHEN NEW.amount_paid > 0 THEN 'partial' WHEN total_due > 0 THEN 'unpaid' ELSE 'draft' END, updated_at = now()
      WHERE id = _invoice_id;
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE FUNCTION public.sync_invoice_line_item_from_prescription() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _invoice_id uuid; _price numeric;
BEGIN
  IF NEW.status = 'dispensed' AND (OLD.status IS DISTINCT FROM 'dispensed') THEN
    SELECT id INTO _invoice_id FROM invoices WHERE encounter_id = NEW.registration_id ORDER BY created_at ASC LIMIT 1;
    IF _invoice_id IS NOT NULL THEN
      SELECT unit_price INTO _price FROM stock_items WHERE id = NEW.stock_item_id;
      INSERT INTO invoice_line_items (invoice_id, encounter_id, item_type, source_id, description, quantity, unit_price, amount)
      VALUES (_invoice_id, NEW.registration_id, 'prescription', NEW.id, NEW.drug_name, NEW.quantity, COALESCE(_price,0), COALESCE(_price,0) * NEW.quantity);
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE FUNCTION public.sync_invoice_line_item_from_radiology() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _invoice_id uuid; _name text; _price numeric;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    SELECT id INTO _invoice_id FROM invoices WHERE encounter_id = NEW.encounter_id ORDER BY created_at ASC LIMIT 1;
    IF _invoice_id IS NOT NULL THEN
      SELECT name, cash_price INTO _name, _price FROM lab_test_catalog WHERE id = NEW.catalog_id;
      INSERT INTO invoice_line_items (invoice_id, encounter_id, item_type, source_id, description, quantity, unit_price, amount)
      VALUES (_invoice_id, NEW.encounter_id, 'radiology', NEW.id, _name, 1, COALESCE(_price, 0), COALESCE(_price, 0));
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE FUNCTION public.sync_invoice_line_items_from_tests() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _invoice_id uuid; _test jsonb; _kind text; _item_type text;
BEGIN
  SELECT id INTO _invoice_id FROM invoices WHERE encounter_id = NEW.id ORDER BY created_at ASC LIMIT 1;
  IF _invoice_id IS NULL THEN RETURN NEW; END IF;
  DELETE FROM invoice_line_items WHERE invoice_id = _invoice_id AND item_type IN ('lab_test','service','consultation','other','radiology');
  IF NEW.tests IS NOT NULL THEN
    FOR _test IN SELECT * FROM jsonb_array_elements(NEW.tests) LOOP
      SELECT kind INTO _kind FROM lab_test_catalog WHERE id = (_test->>'id')::uuid;
      _item_type := CASE WHEN _kind = 'lab' THEN 'lab_test' WHEN _kind = 'service' THEN 'service' WHEN _kind = 'radiology' THEN 'radiology' ELSE 'other' END;
      INSERT INTO invoice_line_items (invoice_id, encounter_id, item_type, source_id, description, quantity, unit_price, amount)
      VALUES (_invoice_id, NEW.id, _item_type, (_test->>'id')::uuid, _test->>'name', 1, COALESCE((_test->>'price')::numeric, 0), COALESCE((_test->>'price')::numeric, 0));
    END LOOP;
  END IF;
  RETURN NEW;
END; $$;

CREATE FUNCTION public.sync_radiology_orders_from_tests() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _test jsonb; _kind text; _catalog_id uuid; _existing_count int;
BEGIN
  IF NEW.tests IS NOT NULL THEN
    FOR _test IN SELECT * FROM jsonb_array_elements(NEW.tests) LOOP
      _catalog_id := (_test->>'id')::uuid;
      SELECT kind INTO _kind FROM lab_test_catalog WHERE id = _catalog_id;
      IF _kind = 'radiology' THEN
        SELECT COUNT(*) INTO _existing_count FROM radiology_orders WHERE encounter_id = NEW.id AND catalog_id = _catalog_id;
        IF _existing_count = 0 THEN
          INSERT INTO radiology_orders (encounter_id, patient_id, catalog_id, ordered_by, status)
          VALUES (NEW.id, NEW.patient_id, _catalog_id, NEW.created_by, 'ordered');
        END IF;
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END; $$;

CREATE FUNCTION public.tag_encounter_demographics() RETURNS trigger LANGUAGE plpgsql AS $$
declare v_age int; v_sex text; v_indicator text;
begin
  if NEW.encounter_type is distinct from 'outpatient' then return NEW; end if;
  select case when dob_known and date_of_birth is not null then date_part('year', age(current_date, date_of_birth))::int else estimated_age end, lower(sex)
  into v_age, v_sex from patients where id = NEW.patient_id;
  if v_age is null then return NEW; end if;
  if v_age >= 60 then v_indicator := 'OPD_OVER60';
  elsif v_age < 5 then v_indicator := case when v_sex like 'm%' then 'OPD_UNDER5_M' when v_sex like 'f%' then 'OPD_UNDER5_F' else null end;
  else v_indicator := case when v_sex like 'm%' then 'OPD_OVER5_M' when v_sex like 'f%' then 'OPD_OVER5_F' else null end;
  end if;
  if v_indicator is not null then
    insert into encounter_indicator_tags (encounter_id, indicator_code, tagged_by) values (NEW.id, v_indicator, 'system') on conflict (encounter_id, indicator_code) do nothing;
  end if;
  return NEW;
end; $$;

CREATE FUNCTION public.tag_encounter_from_room_visit() RETURNS trigger LANGUAGE plpgsql AS $$
declare v_indicator text;
begin
  select indicator_code into v_indicator from room_indicator_map where room_id = NEW.room_id;
  if v_indicator is not null then
    insert into encounter_indicator_tags (encounter_id, indicator_code, tagged_by) values (NEW.encounter_id, v_indicator, 'system') on conflict (encounter_id, indicator_code) do nothing;
  end if;
  return NEW;
end; $$;

CREATE FUNCTION public.user_has_permission(_user uuid, _perm text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.has_role(_user, 'admin'::public.app_role)
      OR EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.role_permissions rp ON rp.role = ur.role WHERE ur.user_id = _user AND rp.permission = _perm);
$$;

CREATE FUNCTION public.validate_and_get_icd11(search_code text) RETURNS TABLE(p_code text, p_title text, p_uri text, p_is_cached boolean) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE cleaned_code text := UPPER(TRIM(search_code)); mock_title text; mock_uri text;
BEGIN
    RETURN QUERY SELECT c.code::text, c.title, c.uri, true FROM public.icd11_codes c WHERE UPPER(c.code) = cleaned_code;
    IF FOUND THEN RETURN; END IF;
    mock_title := CASE cleaned_code
        WHEN '1B12' THEN 'Tuberculosis of nervous system' WHEN 'CA40' THEN 'Acute bronchitis'
        WHEN 'BA41' THEN 'Ischaemic heart disease' WHEN '1A00' THEN 'Cholera'
        WHEN '5A11' THEN 'Type 2 diabetes mellitus' WHEN 'GB04' THEN 'Acute appendicitis'
        WHEN 'FA00' THEN 'Depressive episode' ELSE 'Clinical Diagnosis (Validated Placeholder)' END;
    mock_uri := 'https://id.who.int/icd/entity/mock/' || cleaned_code;
    INSERT INTO public.icd11_codes (code, title, uri) VALUES (cleaned_code, mock_title, mock_uri) ON CONFLICT (code) DO NOTHING;
    RETURN QUERY SELECT cleaned_code, mock_title, mock_uri, true;
END; $$;

CREATE TABLE public.access_requests (id uuid DEFAULT gen_random_uuid() NOT NULL, user_id uuid NOT NULL, email text NOT NULL, full_name text, reason text, status text DEFAULT 'pending'::text NOT NULL, reviewed_by uuid, reviewed_at timestamp with time zone, created_at timestamp with time zone DEFAULT now() NOT NULL, updated_at timestamp with time zone DEFAULT now() NOT NULL, CONSTRAINT access_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text]))));

CREATE TABLE public.admissions (id uuid DEFAULT gen_random_uuid() NOT NULL, encounter_id uuid, patient_id uuid, bed_id uuid, ward_id uuid, admitted_at timestamp with time zone DEFAULT now(), expected_discharge_date date, discharged_at timestamp with time zone, admitting_doctor text, admission_reason text, admission_type text, status text DEFAULT 'admitted'::text, created_by uuid, created_at timestamp with time zone DEFAULT now(), updated_at timestamp with time zone DEFAULT now());

CREATE TABLE public.app_settings (id text DEFAULT 'global'::text NOT NULL, app_name text DEFAULT 'LabTrack'::text NOT NULL, logo_url text, updated_at timestamp with time zone DEFAULT now() NOT NULL, updated_by uuid);

CREATE TABLE public.appointments (id uuid DEFAULT gen_random_uuid() NOT NULL, patient_id uuid, encounter_id uuid, provider_id uuid, scheduled_at timestamp with time zone NOT NULL, duration_minutes integer DEFAULT 30, appointment_type text DEFAULT 'new'::text, status text DEFAULT 'scheduled'::text, reason text, notes text, created_by uuid, created_at timestamp with time zone DEFAULT now(), updated_at timestamp with time zone DEFAULT now(), time_range tstzrange);

CREATE TABLE public.audit_log (id uuid DEFAULT gen_random_uuid() NOT NULL, table_name text NOT NULL, record_id uuid, action text NOT NULL, old_data jsonb, new_data jsonb, changed_by uuid, changed_at timestamp with time zone DEFAULT now());

CREATE TABLE public.beds (id uuid DEFAULT gen_random_uuid() NOT NULL, ward_id uuid, bed_number text NOT NULL, status text DEFAULT 'available'::text, created_at timestamp with time zone DEFAULT now(), updated_at timestamp with time zone DEFAULT now());

CREATE TABLE public.clinical_notes (id uuid DEFAULT gen_random_uuid() NOT NULL, encounter_id uuid, admission_id uuid, note_type text NOT NULL, content text, authored_by uuid, authored_at timestamp with time zone DEFAULT now(), created_at timestamp with time zone DEFAULT now());

CREATE TABLE public.deliveries (id uuid DEFAULT gen_random_uuid() NOT NULL, delivery_date date DEFAULT CURRENT_DATE NOT NULL, supplier text, item_name text NOT NULL, stock_item_id uuid, quantity numeric(12,2) NOT NULL, unit text, batch_number text, expiry_date date, invoice_number text, received_by text, notes text, created_by uuid, created_at timestamp with time zone DEFAULT now() NOT NULL, updated_at timestamp with time zone DEFAULT now() NOT NULL);

CREATE TABLE public.encounter_amendments (id uuid DEFAULT gen_random_uuid() NOT NULL, encounter_id uuid NOT NULL, amendment_text text NOT NULL, reason_for_amendment text, created_by uuid DEFAULT auth.uid(), created_at timestamp with time zone DEFAULT now(), updated_at timestamp with time zone DEFAULT now());

CREATE TABLE public.encounter_diagnoses (id uuid DEFAULT gen_random_uuid() NOT NULL, encounter_id uuid NOT NULL, icd11_code character varying(255) NOT NULL, icd11_title text NOT NULL, icd11_uri text, diagnosis_type text, notes text, created_by uuid, created_at timestamp with time zone DEFAULT now(), updated_at timestamp with time zone DEFAULT now(), CONSTRAINT encounter_diagnoses_diagnosis_type_check CHECK ((diagnosis_type = ANY (ARRAY['primary'::text, 'secondary'::text, 'differential'::text]))));

CREATE TABLE public.encounter_indicator_tags (id uuid DEFAULT gen_random_uuid() NOT NULL, encounter_id uuid NOT NULL, indicator_code text NOT NULL, tagged_at timestamp with time zone DEFAULT now(), tagged_by text DEFAULT 'system'::text);

CREATE TABLE public.encounters (id uuid NOT NULL, patient_id uuid, payment_mode text, insurance_provider_id uuid, insurance_coverage_percentage numeric, tests jsonb, subtotal numeric, insurance_covered numeric, patient_due numeric, status text DEFAULT 'waiting'::text, notes text, payment_status text, amount_paid numeric, paid_at timestamp with time zone, paid_by uuid, payment_method text, payment_reference text, from_room text, current_room_id uuid, next_room_id uuid, vitals jsonb, history jsonb, diagnoses jsonb, acknowledged_by uuid, acknowledged_at timestamp with time zone, created_by uuid, created_at timestamp with time zone DEFAULT now(), updated_at timestamp with time zone DEFAULT now(), encounter_type text DEFAULT 'outpatient'::text);

CREATE SEQUENCE public.invoice_number_seq START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

CREATE TABLE public.invoices (id uuid DEFAULT gen_random_uuid() NOT NULL, encounter_id uuid, patient_id uuid, invoice_number text DEFAULT ((('INV-'::text || to_char(now(), 'YYYY'::text)) || '-'::text) || lpad((nextval('public.invoice_number_seq'::regclass))::text, 5, '0'::text)), subtotal numeric DEFAULT 0, discount numeric DEFAULT 0, insurance_covered numeric DEFAULT 0, total_due numeric DEFAULT 0, amount_paid numeric DEFAULT 0, balance numeric DEFAULT 0, status text DEFAULT 'draft'::text, created_by uuid, created_at timestamp with time zone DEFAULT now(), updated_at timestamp with time zone DEFAULT now());

CREATE TABLE public.lab_tests (id uuid DEFAULT gen_random_uuid() NOT NULL, patient_name text NOT NULL, age integer NOT NULL, registration_number text NOT NULL, lab_number text NOT NULL, test_name text NOT NULL, result text, notes text, test_date date DEFAULT CURRENT_DATE NOT NULL, created_by uuid, created_at timestamp with time zone DEFAULT now() NOT NULL, updated_at timestamp with time zone DEFAULT now() NOT NULL, is_positive boolean DEFAULT false NOT NULL, is_medical_camp boolean DEFAULT false NOT NULL, registration_id uuid, sent_to_room text, sent_at timestamp with time zone);

CREATE TABLE public.patients (id uuid DEFAULT gen_random_uuid() NOT NULL, file_number text, first_name text, middle_name text, family_name text, patient_name text, date_of_birth date, dob_known boolean, estimated_age integer, sex text, phone text, email text, address_line1 text, address_line2 text, city text, county text, postal_code text, country text, occupation text, marital_status text, nationality text, religion text, education_level text, is_deceased boolean DEFAULT false, date_of_death date, cause_of_death text, next_of_kin jsonb, relationships jsonb, created_by uuid, created_at timestamp with time zone DEFAULT now(), updated_at timestamp with time zone DEFAULT now());

CREATE TABLE public.prescriptions (id uuid DEFAULT gen_random_uuid() NOT NULL, registration_id uuid NOT NULL, stock_item_id uuid, drug_name text NOT NULL, dosage text, frequency text, duration text, quantity numeric DEFAULT 1 NOT NULL, notes text, status text DEFAULT 'pending'::text NOT NULL, created_by uuid, dispensed_by uuid, dispensed_at timestamp with time zone, created_at timestamp with time zone DEFAULT now() NOT NULL, updated_at timestamp with time zone DEFAULT now() NOT NULL, CONSTRAINT prescriptions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'dispensed'::text, 'cancelled'::text]))));

CREATE TABLE public.radiology_orders (id uuid DEFAULT gen_random_uuid() NOT NULL, encounter_id uuid, patient_id uuid, catalog_id uuid, ordered_by uuid, ordered_at timestamp with time zone DEFAULT now(), priority text DEFAULT 'routine'::text, clinical_indication text, status text DEFAULT 'ordered'::text, created_at timestamp with time zone DEFAULT now(), updated_at timestamp with time zone DEFAULT now());

CREATE TABLE public.encounter_room_visits (id uuid DEFAULT gen_random_uuid() NOT NULL, encounter_id uuid NOT NULL, room_id uuid, entered_at timestamp with time zone DEFAULT now() NOT NULL, left_at timestamp with time zone);

CREATE TABLE public.fund_utilizations (id uuid DEFAULT gen_random_uuid() NOT NULL, util_date date DEFAULT CURRENT_DATE NOT NULL, category text NOT NULL, amount numeric(12,2) NOT NULL, notes text, created_by uuid, created_at timestamp with time zone DEFAULT now() NOT NULL, updated_at timestamp with time zone DEFAULT now() NOT NULL, CONSTRAINT fund_utilizations_category_check CHECK ((category = ANY (ARRAY['students'::text, 'staff'::text, 'external'::text]))));

CREATE TABLE public.icd11_codes (code character varying(50) NOT NULL, title text NOT NULL, uri text, validated_at timestamp with time zone DEFAULT now());

CREATE TABLE public.insurance_providers (id uuid DEFAULT gen_random_uuid() NOT NULL, name text NOT NULL, code text NOT NULL, coverage_percentage numeric DEFAULT 0 NOT NULL, is_active boolean DEFAULT true NOT NULL, created_by uuid, created_at timestamp with time zone DEFAULT now() NOT NULL, updated_at timestamp with time zone DEFAULT now() NOT NULL, CONSTRAINT insurance_providers_coverage_percentage_check CHECK (((coverage_percentage >= (0)::numeric) AND (coverage_percentage <= (100)::numeric))));

CREATE TABLE public.invoice_line_items (id uuid DEFAULT gen_random_uuid() NOT NULL, invoice_id uuid, encounter_id uuid, item_type text NOT NULL, source_id uuid, description text, quantity numeric DEFAULT 1, unit_price numeric DEFAULT 0, amount numeric DEFAULT 0, insurance_covered_amount numeric DEFAULT 0, created_at timestamp with time zone DEFAULT now());

CREATE TABLE public.invoice_payments (id uuid DEFAULT gen_random_uuid() NOT NULL, invoice_id uuid, amount numeric NOT NULL, method text, reference text, received_by uuid, paid_at timestamp with time zone DEFAULT now(), created_at timestamp with time zone DEFAULT now());

CREATE TABLE public.lab_test_catalog (id uuid DEFAULT gen_random_uuid() NOT NULL, name text NOT NULL, price numeric DEFAULT 0 NOT NULL, is_active boolean DEFAULT true NOT NULL, created_by uuid, created_at timestamp with time zone DEFAULT now() NOT NULL, updated_at timestamp with time zone DEFAULT now() NOT NULL, kind text DEFAULT 'lab'::text NOT NULL, category text, cash_price numeric(10,2), insurance_price numeric(10,2), target_room_id uuid, CONSTRAINT lab_test_catalog_price_check CHECK ((price >= (0)::numeric)));

CREATE TABLE public.machine_logs (id uuid DEFAULT gen_random_uuid() NOT NULL, machine_id uuid NOT NULL, log_type public.machine_log_type NOT NULL, log_date date DEFAULT CURRENT_DATE NOT NULL, performed_by text, description text NOT NULL, cost numeric(12,2), next_due_date date, created_by uuid, created_at timestamp with time zone DEFAULT now() NOT NULL, updated_at timestamp with time zone DEFAULT now() NOT NULL);

CREATE TABLE public.machines (id uuid DEFAULT gen_random_uuid() NOT NULL, name text NOT NULL, model text, serial_number text, location text, status text DEFAULT 'active'::text NOT NULL, notes text, created_by uuid, created_at timestamp with time zone DEFAULT now() NOT NULL, updated_at timestamp with time zone DEFAULT now() NOT NULL);

CREATE TABLE public.moh_indicator_definitions (id uuid DEFAULT gen_random_uuid() NOT NULL, form_number text NOT NULL, indicator_code text NOT NULL, description text, criteria_type text, criteria_value text);

CREATE TABLE public.moh_indicators (id uuid DEFAULT gen_random_uuid() NOT NULL, code text NOT NULL, description text NOT NULL, category text NOT NULL, data_type text DEFAULT 'count'::text NOT NULL, created_at timestamp with time zone DEFAULT now());

CREATE TABLE public.moh_monthly_aggregates (id uuid DEFAULT gen_random_uuid() NOT NULL, indicator_code text NOT NULL, period_month date NOT NULL, value numeric DEFAULT 0 NOT NULL, computed_at timestamp with time zone DEFAULT now());

CREATE TABLE public.moh_report_corrections (id uuid DEFAULT gen_random_uuid() NOT NULL, indicator_code text NOT NULL, period_month date NOT NULL, adjusted_value numeric NOT NULL, reason text NOT NULL, created_by uuid, created_at timestamp with time zone DEFAULT now());

CREATE TABLE public.moh_report_line_items (id uuid DEFAULT gen_random_uuid() NOT NULL, template_id uuid, section text, row_label text NOT NULL, column_label text, indicator_code text, sort_order integer DEFAULT 0 NOT NULL);

CREATE TABLE public.moh_report_submissions (id uuid DEFAULT gen_random_uuid() NOT NULL, template_id uuid NOT NULL, period_month date NOT NULL, status text DEFAULT 'draft'::text NOT NULL, prepared_by uuid, prepared_at timestamp with time zone, checked_by uuid, checked_at timestamp with time zone, received_by uuid, export_url text, created_at timestamp with time zone DEFAULT now());

CREATE TABLE public.moh_report_templates (id uuid DEFAULT gen_random_uuid() NOT NULL, form_code text NOT NULL, version text NOT NULL, title text NOT NULL);

CREATE SEQUENCE public.patient_file_seq START WITH 1000 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 1;

CREATE TABLE public.patient_registrations_legacy (id uuid DEFAULT gen_random_uuid() NOT NULL, patient_name text NOT NULL, date_of_birth date, phone text, file_number text, payment_mode text NOT NULL, insurance_provider_id uuid, insurance_coverage_percentage numeric, tests jsonb DEFAULT '[]'::jsonb NOT NULL, subtotal numeric DEFAULT 0 NOT NULL, insurance_covered numeric DEFAULT 0 NOT NULL, patient_due numeric DEFAULT 0 NOT NULL, status text DEFAULT 'waiting'::text NOT NULL, notes text, created_by uuid, created_at timestamp with time zone DEFAULT now() NOT NULL, updated_at timestamp with time zone DEFAULT now() NOT NULL, payment_status text DEFAULT 'unpaid'::text NOT NULL, amount_paid numeric DEFAULT 0 NOT NULL, paid_at timestamp with time zone, paid_by uuid, payment_method text, payment_reference text, from_room text, current_room_id uuid, first_name text, middle_name text, family_name text, sex text, dob_known boolean DEFAULT true, estimated_age integer, email text, address_line1 text, address_line2 text, city text, county text, postal_code text, country text, occupation text, marital_status text, nationality text, religion text, education_level text, is_deceased boolean DEFAULT false, date_of_death date, cause_of_death text, relationships jsonb DEFAULT '[]'::jsonb, next_of_kin jsonb DEFAULT '{}'::jsonb, vitals jsonb DEFAULT '{}'::jsonb NOT NULL, history jsonb DEFAULT '{}'::jsonb NOT NULL, diagnoses jsonb DEFAULT '[]'::jsonb NOT NULL, next_room_id uuid, acknowledged_by uuid, acknowledged_at timestamp with time zone, CONSTRAINT patient_registrations_payment_mode_check CHECK ((payment_mode = ANY (ARRAY['cash'::text, 'insurance'::text, 'free'::text]))), CONSTRAINT patient_registrations_payment_status_check CHECK ((payment_status = ANY (ARRAY['unpaid'::text, 'paid'::text, 'waived'::text, 'partial'::text]))), CONSTRAINT patient_registrations_status_check CHECK ((status = ANY (ARRAY['waiting'::text, 'in_progress'::text, 'done'::text, 'cancelled'::text]))));

CREATE TABLE public.radiology_results (id uuid DEFAULT gen_random_uuid() NOT NULL, order_id uuid, findings text, impression text, radiologist text, image_paths jsonb DEFAULT '[]'::jsonb, reported_at timestamp with time zone, created_at timestamp with time zone DEFAULT now());

CREATE TABLE public.role_permissions (role public.app_role NOT NULL, permission text NOT NULL, created_at timestamp with time zone DEFAULT now() NOT NULL);

CREATE TABLE public.room_indicator_map (room_id uuid NOT NULL, indicator_code text NOT NULL);

CREATE TABLE public.rooms (id uuid DEFAULT gen_random_uuid() NOT NULL, name text NOT NULL, code text, is_active boolean DEFAULT true NOT NULL, created_by uuid, created_at timestamp with time zone DEFAULT now() NOT NULL, updated_at timestamp with time zone DEFAULT now() NOT NULL, kind text DEFAULT 'general'::text NOT NULL, CONSTRAINT rooms_kind_check CHECK ((kind = ANY (ARRAY['general'::text, 'lab'::text, 'triage'::text, 'consultation'::text, 'pharmacy'::text, 'billing'::text]))));

CREATE TABLE public.stock_items (id uuid DEFAULT gen_random_uuid() NOT NULL, name text NOT NULL, category text, unit text DEFAULT 'pcs'::text NOT NULL, current_quantity numeric(12,2) DEFAULT 0 NOT NULL, reorder_level numeric(12,2) DEFAULT 0 NOT NULL, notes text, created_at timestamp with time zone DEFAULT now() NOT NULL, updated_at timestamp with time zone DEFAULT now() NOT NULL, kind text DEFAULT 'consumable'::text NOT NULL, unit_price numeric DEFAULT 0, cash_price numeric, insurance_price numeric);

CREATE TABLE public.stock_movements (id uuid DEFAULT gen_random_uuid() NOT NULL, item_id uuid NOT NULL, change numeric(12,2) NOT NULL, reason text NOT NULL, notes text, created_by uuid, created_at timestamp with time zone DEFAULT now() NOT NULL);

CREATE TABLE public.test_templates (id uuid DEFAULT gen_random_uuid() NOT NULL, test_name text NOT NULL, parameters jsonb DEFAULT '[]'::jsonb NOT NULL, created_by uuid, created_at timestamp with time zone DEFAULT now() NOT NULL, updated_at timestamp with time zone DEFAULT now() NOT NULL);

CREATE TABLE public.user_roles (id uuid DEFAULT gen_random_uuid() NOT NULL, user_id uuid NOT NULL, role public.app_role NOT NULL, created_at timestamp with time zone DEFAULT now() NOT NULL);

CREATE TABLE public.user_room_access (user_id uuid NOT NULL, room_id uuid NOT NULL, granted_by uuid, granted_at timestamp with time zone DEFAULT now() NOT NULL);

CREATE TABLE public.wards (id uuid DEFAULT gen_random_uuid() NOT NULL, name text NOT NULL, ward_type text, floor text, gender_restriction text, daily_rate numeric DEFAULT 0, capacity integer, is_active boolean DEFAULT true, created_at timestamp with time zone DEFAULT now(), section text);

CREATE VIEW public.encounter_records_summary AS
 SELECT e.id AS encounter_id, e.patient_id, p.patient_name, e.created_at AS encounter_date, e.status AS encounter_status,
    i.id AS invoice_id, i.status AS invoice_status, i.total_due, i.balance,
    ( SELECT count(*) FROM public.clinical_notes cn WHERE cn.encounter_id = e.id AND cn.note_type = 'doctor_note') AS doctor_note_count,
    ( SELECT count(*) FROM public.clinical_notes cn WHERE cn.encounter_id = e.id AND cn.note_type = 'discharge_note') AS discharge_note_count,
    ( SELECT count(*) FROM public.prescriptions rx WHERE rx.registration_id = e.id) AS prescription_count,
    ( SELECT count(*) FROM public.lab_tests lt WHERE lt.registration_id = e.id) AS lab_test_count,
    ( SELECT count(*) FROM public.radiology_orders ro WHERE ro.encounter_id = e.id) AS radiology_order_count
   FROM public.encounters e JOIN public.patients p ON p.id = e.patient_id LEFT JOIN public.invoices i ON i.encounter_id = e.id;

CREATE VIEW public.patient_registrations AS
 SELECT e.id, p.patient_name, p.date_of_birth, p.phone, p.file_number, e.payment_mode, e.insurance_provider_id, e.insurance_coverage_percentage,
    e.tests, e.subtotal, e.insurance_covered, e.patient_due, e.status, e.notes, e.created_by, e.created_at, e.updated_at, e.payment_status,
    e.amount_paid, e.paid_at, e.paid_by, e.payment_method, e.payment_reference, e.from_room, e.current_room_id,
    p.first_name, p.middle_name, p.family_name, p.sex, p.dob_known, p.estimated_age, p.email, p.address_line1, p.address_line2,
    p.city, p.county, p.postal_code, p.country, p.occupation, p.marital_status, p.nationality, p.religion, p.education_level,
    p.is_deceased, p.date_of_death, p.cause_of_death, p.relationships, p.next_of_kin, e.vitals, e.history, e.diagnoses,
    e.next_room_id, e.acknowledged_by, e.acknowledged_at, e.patient_id
   FROM public.encounters e JOIN public.patients p ON p.id = e.patient_id;