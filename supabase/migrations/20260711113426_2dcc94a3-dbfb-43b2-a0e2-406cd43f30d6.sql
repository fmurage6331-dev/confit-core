
-- Elevate trigger functions to SECURITY DEFINER with locked search_path

CREATE OR REPLACE FUNCTION public.require_discharge_summary()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  IF NEW.status = 'discharged' AND OLD.status IS DISTINCT FROM 'discharged' THEN
    IF NOT EXISTS (
      SELECT 1 FROM clinical_notes
      WHERE admission_id = NEW.id AND note_type = 'discharge_note'
    ) THEN
      RAISE EXCEPTION 'Cannot discharge patient without a discharge summary. Please add a discharge note first.';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_radiology_orders_from_tests()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  _test jsonb;
  _kind text;
  _catalog_id uuid;
  _existing_count int;
BEGIN
  IF NEW.tests IS NOT NULL THEN
    FOR _test IN SELECT * FROM jsonb_array_elements(NEW.tests) LOOP
      _catalog_id := (_test->>'id')::uuid;
      SELECT kind INTO _kind FROM lab_test_catalog WHERE id = _catalog_id;

      IF _kind = 'radiology' THEN
        SELECT COUNT(*) INTO _existing_count
        FROM radiology_orders
        WHERE encounter_id = NEW.id AND catalog_id = _catalog_id;

        IF _existing_count = 0 THEN
          INSERT INTO radiology_orders (encounter_id, patient_id, catalog_id, ordered_by, status)
          VALUES (NEW.id, NEW.patient_id, _catalog_id, NEW.created_by, 'ordered');
        END IF;
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_invoice_line_item_from_prescription()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  _invoice_id uuid;
  _price numeric;
BEGIN
  IF NEW.status = 'dispensed' AND (OLD.status IS DISTINCT FROM 'dispensed') THEN
    SELECT id INTO _invoice_id FROM invoices WHERE encounter_id = NEW.registration_id ORDER BY created_at ASC LIMIT 1;
    IF _invoice_id IS NOT NULL THEN
      SELECT unit_price INTO _price FROM stock_items WHERE id = NEW.stock_item_id;
      INSERT INTO invoice_line_items (invoice_id, encounter_id, item_type, source_id, description, quantity, unit_price, amount)
      VALUES (
        _invoice_id, NEW.registration_id, 'prescription', NEW.id,
        NEW.drug_name, NEW.quantity, COALESCE(_price,0), COALESCE(_price,0) * NEW.quantity
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.create_invoice_for_encounter()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  INSERT INTO invoices (encounter_id, patient_id, created_by)
  VALUES (NEW.id, NEW.patient_id, NEW.created_by);
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_appointment_time_range()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  NEW.time_range := tstzrange(
    NEW.scheduled_at,
    NEW.scheduled_at + (NEW.duration_minutes || ' minutes')::interval,
    '[)'
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_invoice_line_items_from_tests()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  _invoice_id uuid;
  _test jsonb;
  _kind text;
  _item_type text;
BEGIN
  SELECT id INTO _invoice_id FROM invoices WHERE encounter_id = NEW.id ORDER BY created_at ASC LIMIT 1;
  IF _invoice_id IS NULL THEN
    RETURN NEW;
  END IF;

  DELETE FROM invoice_line_items
  WHERE invoice_id = _invoice_id AND item_type IN ('lab_test','service','consultation','other','radiology');

  IF NEW.tests IS NOT NULL THEN
    FOR _test IN SELECT * FROM jsonb_array_elements(NEW.tests) LOOP
      SELECT kind INTO _kind FROM lab_test_catalog WHERE id = (_test->>'id')::uuid;

      _item_type := CASE
        WHEN _kind = 'lab' THEN 'lab_test'
        WHEN _kind = 'service' THEN 'service'
        WHEN _kind = 'radiology' THEN 'radiology'
        ELSE 'other'
      END;

      INSERT INTO invoice_line_items (invoice_id, encounter_id, item_type, source_id, description, quantity, unit_price, amount)
      VALUES (
        _invoice_id, NEW.id, _item_type,
        (_test->>'id')::uuid,
        _test->>'name',
        1,
        COALESCE((_test->>'price')::numeric, 0),
        COALESCE((_test->>'price')::numeric, 0)
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_bed_status_on_admission()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
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
END;
$function$;

CREATE OR REPLACE FUNCTION public.recalc_encounter_subtotal()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  _subtotal numeric;
BEGIN
  SELECT COALESCE(SUM((t->>'price')::numeric), 0) INTO _subtotal
  FROM jsonb_array_elements(NEW.tests) t;

  NEW.subtotal := _subtotal;
  NEW.patient_due := _subtotal - COALESCE(NEW.insurance_covered, 0);
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_invoice_from_encounter_payment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  _invoice_id uuid;
BEGIN
  IF NEW.amount_paid IS DISTINCT FROM OLD.amount_paid
     OR NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN

    SELECT id INTO _invoice_id FROM invoices WHERE encounter_id = NEW.id ORDER BY created_at ASC LIMIT 1;

    IF _invoice_id IS NOT NULL THEN
      UPDATE invoices
      SET amount_paid = NEW.amount_paid,
          balance = total_due - NEW.amount_paid,
          status = CASE
            WHEN NEW.payment_status = 'waived' THEN 'waived'
            WHEN total_due - NEW.amount_paid <= 0 AND total_due > 0 THEN 'paid'
            WHEN NEW.amount_paid > 0 THEN 'partial'
            WHEN total_due > 0 THEN 'unpaid'
            ELSE 'draft'
          END,
          updated_at = now()
      WHERE id = _invoice_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_encounter_from_invoice_payment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  _encounter_id uuid;
  _paid numeric;
BEGIN
  SELECT encounter_id INTO _encounter_id FROM invoices WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);
  SELECT COALESCE(SUM(amount),0) INTO _paid FROM invoice_payments WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id);

  UPDATE encounters
  SET amount_paid = _paid,
      payment_status = CASE
        WHEN _paid >= subtotal AND subtotal > 0 THEN 'paid'
        WHEN _paid > 0 THEN 'partial'
        ELSE 'unpaid'
      END
  WHERE id = _encounter_id;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.route_registration_to_service_room()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  _room uuid;
  _has_lab boolean;
BEGIN
  IF NEW.tests IS NOT NULL AND jsonb_array_length(NEW.tests) > 0 THEN
    SELECT EXISTS (
      SELECT 1 FROM jsonb_array_elements(NEW.tests) t
      JOIN lab_test_catalog c ON c.id = (t->>'id')::uuid
      WHERE COALESCE(c.kind,'lab') = 'lab'
    ) INTO _has_lab;

    IF NOT _has_lab THEN
      SELECT c.target_room_id INTO _room
      FROM jsonb_array_elements(NEW.tests) t
      JOIN lab_test_catalog c ON c.id = (t->>'id')::uuid
      WHERE c.target_room_id IS NOT NULL
      LIMIT 1;

      IF _room IS NOT NULL THEN
        NEW.current_room_id := _room;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.patient_registrations_instead_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  _patient_id uuid;
  _encounter_id uuid := COALESCE(NEW.id, gen_random_uuid());
BEGIN
  IF NEW.file_number IS NOT NULL THEN
    SELECT id INTO _patient_id FROM patients WHERE file_number = NEW.file_number;
  END IF;

  IF _patient_id IS NULL THEN
    INSERT INTO patients (
      file_number, first_name, middle_name, family_name, patient_name,
      date_of_birth, dob_known, estimated_age, sex, phone, email,
      address_line1, address_line2, city, county, postal_code, country,
      occupation, marital_status, nationality, religion, education_level,
      is_deceased, date_of_death, cause_of_death, next_of_kin, relationships,
      created_by
    ) VALUES (
      NEW.file_number, NEW.first_name, NEW.middle_name, NEW.family_name, NEW.patient_name,
      NEW.date_of_birth, NEW.dob_known, NEW.estimated_age, NEW.sex, NEW.phone, NEW.email,
      NEW.address_line1, NEW.address_line2, NEW.city, NEW.county, NEW.postal_code, NEW.country,
      NEW.occupation, NEW.marital_status, NEW.nationality, NEW.religion, NEW.education_level,
      NEW.is_deceased, NEW.date_of_death, NEW.cause_of_death, NEW.next_of_kin, NEW.relationships,
      NEW.created_by
    )
    RETURNING id INTO _patient_id;
  END IF;

  INSERT INTO encounters (
    id, patient_id, payment_mode, insurance_provider_id, insurance_coverage_percentage,
    tests, subtotal, insurance_covered, patient_due, status, notes,
    payment_status, amount_paid, paid_at, paid_by, payment_method, payment_reference,
    from_room, current_room_id, next_room_id, vitals, history, diagnoses,
    acknowledged_by, acknowledged_at, created_by
  ) VALUES (
    _encounter_id, _patient_id, NEW.payment_mode, NEW.insurance_provider_id, NEW.insurance_coverage_percentage,
    NEW.tests, NEW.subtotal, NEW.insurance_covered, NEW.patient_due, NEW.status, NEW.notes,
    NEW.payment_status, NEW.amount_paid, NEW.paid_at, NEW.paid_by, NEW.payment_method, NEW.payment_reference,
    NEW.from_room, NEW.current_room_id, NEW.next_room_id, NEW.vitals, NEW.history, NEW.diagnoses,
    NEW.acknowledged_by, NEW.acknowledged_at, NEW.created_by
  );

  NEW.id := _encounter_id;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.route_registration_billing()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
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
END
$function$;

CREATE OR REPLACE FUNCTION public.recalc_invoice_payments()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  _invoice_id uuid;
  _paid numeric;
  _total_due numeric;
BEGIN
  _invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);

  SELECT COALESCE(SUM(amount), 0) INTO _paid
  FROM invoice_payments WHERE invoice_id = _invoice_id;

  SELECT total_due INTO _total_due FROM invoices WHERE id = _invoice_id;

  UPDATE invoices
  SET amount_paid = _paid,
      balance = _total_due - _paid,
      status = CASE
        WHEN _total_due - _paid <= 0 AND _total_due > 0 THEN 'paid'
        WHEN _paid > 0 THEN 'partial'
        WHEN _total_due > 0 THEN 'unpaid'
        ELSE 'draft'
      END,
      updated_at = now()
  WHERE id = _invoice_id;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_invoice_line_item_from_radiology()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  _invoice_id uuid;
  _name text;
  _price numeric;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    SELECT id INTO _invoice_id FROM invoices WHERE encounter_id = NEW.encounter_id ORDER BY created_at ASC LIMIT 1;

    IF _invoice_id IS NOT NULL THEN
      SELECT name, cash_price INTO _name, _price FROM lab_test_catalog WHERE id = NEW.catalog_id;

      INSERT INTO invoice_line_items (invoice_id, encounter_id, item_type, source_id, description, quantity, unit_price, amount)
      VALUES (
        _invoice_id, NEW.encounter_id, 'radiology', NEW.id,
        _name, 1, COALESCE(_price, 0), COALESCE(_price, 0)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.recalc_invoice_totals()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  _invoice_id uuid;
  _subtotal numeric;
BEGIN
  _invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);

  SELECT COALESCE(SUM(amount), 0) INTO _subtotal
  FROM invoice_line_items WHERE invoice_id = _invoice_id;

  UPDATE invoices
  SET subtotal = _subtotal,
      total_due = _subtotal - discount - insurance_covered,
      balance = (_subtotal - discount - insurance_covered) - amount_paid,
      status = CASE
        WHEN (_subtotal - discount - insurance_covered) - amount_paid <= 0 AND _subtotal > 0 THEN 'paid'
        WHEN amount_paid > 0 THEN 'partial'
        WHEN _subtotal > 0 THEN 'unpaid'
        ELSE 'draft'
      END,
      updated_at = now()
  WHERE id = _invoice_id;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.apply_stock_movement()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.delivery_to_stock()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  IF NEW.stock_item_id IS NOT NULL THEN
    INSERT INTO public.stock_movements (item_id, change, reason, notes, created_by)
    VALUES (NEW.stock_item_id, NEW.quantity, 'delivery', 'Delivery #'||COALESCE(NEW.invoice_number, NEW.id::text), NEW.created_by);
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $function$;
