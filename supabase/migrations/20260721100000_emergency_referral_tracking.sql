-- 1. New columns on encounters to actually capture emergency cases and referrals.
ALTER TABLE public.encounters
  ADD COLUMN IF NOT EXISTS is_emergency boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS referral_direction text,
  ADD CONSTRAINT encounters_referral_direction_check
    CHECK (referral_direction IS NULL OR referral_direction IN ('in', 'out'));

-- 2. Recreate patient_registrations view to expose the two new columns
--    (adding at the end — safe for CREATE OR REPLACE VIEW).
CREATE OR REPLACE VIEW public.patient_registrations AS
 SELECT e.id, p.patient_name, p.date_of_birth, p.phone, p.file_number, e.payment_mode, e.insurance_provider_id, e.insurance_coverage_percentage,
    e.tests, e.subtotal, e.insurance_covered, e.patient_due, e.status, e.notes, e.created_by, e.created_at, e.updated_at, e.payment_status,
    e.amount_paid, e.paid_at, e.paid_by, e.payment_method, e.payment_reference, e.from_room, e.current_room_id,
    p.first_name, p.middle_name, p.family_name, p.sex, p.dob_known, p.estimated_age, p.email, p.address_line1, p.address_line2,
    p.city, p.county, p.postal_code, p.country, p.occupation, p.marital_status, p.nationality, p.religion, p.education_level,
    p.is_deceased, p.date_of_death, p.cause_of_death, p.relationships, p.next_of_kin, e.vitals, e.history, e.diagnoses,
    e.next_room_id, e.acknowledged_by, e.acknowledged_at, e.patient_id, e.is_emergency, e.referral_direction
   FROM public.encounters e JOIN public.patients p ON p.id = e.patient_id;

-- 3. Insert trigger: pass through is_emergency / referral_direction.
CREATE OR REPLACE FUNCTION public.patient_registrations_instead_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE _patient_id uuid; _encounter_id uuid := COALESCE(NEW.id, gen_random_uuid());
BEGIN
  IF NEW.file_number IS NOT NULL THEN SELECT id INTO _patient_id FROM patients WHERE file_number = NEW.file_number; END IF;
  IF _patient_id IS NULL THEN
    INSERT INTO patients (file_number, first_name, middle_name, family_name, patient_name, date_of_birth, dob_known, estimated_age, sex, phone, email, address_line1, address_line2, city, county, postal_code, country, occupation, marital_status, nationality, religion, education_level, is_deceased, date_of_death, cause_of_death, next_of_kin, relationships, created_by)
    VALUES (NEW.file_number, NEW.first_name, NEW.middle_name, NEW.family_name, NEW.patient_name, NEW.date_of_birth, NEW.dob_known, NEW.estimated_age, NEW.sex, NEW.phone, NEW.email, NEW.address_line1, NEW.address_line2, NEW.city, NEW.county, NEW.postal_code, NEW.country, NEW.occupation, NEW.marital_status, NEW.nationality, NEW.religion, NEW.education_level, NEW.is_deceased, NEW.date_of_death, NEW.cause_of_death, NEW.next_of_kin, NEW.relationships, NEW.created_by)
    RETURNING id INTO _patient_id;
  END IF;
  INSERT INTO encounters (id, patient_id, payment_mode, insurance_provider_id, insurance_coverage_percentage, tests, subtotal, insurance_covered, patient_due, status, notes, payment_status, amount_paid, paid_at, paid_by, payment_method, payment_reference, from_room, current_room_id, next_room_id, vitals, history, diagnoses, acknowledged_by, acknowledged_at, created_by, is_emergency, referral_direction)
  VALUES (_encounter_id, _patient_id, NEW.payment_mode, NEW.insurance_provider_id, NEW.insurance_coverage_percentage, NEW.tests, NEW.subtotal, NEW.insurance_covered, NEW.patient_due, NEW.status, NEW.notes, NEW.payment_status, NEW.amount_paid, NEW.paid_at, NEW.paid_by, NEW.payment_method, NEW.payment_reference, NEW.from_room, NEW.current_room_id, NEW.next_room_id, NEW.vitals, NEW.history, NEW.diagnoses, NEW.acknowledged_by, NEW.acknowledged_at, NEW.created_by, COALESCE(NEW.is_emergency, false), NEW.referral_direction);
  NEW.id := _encounter_id; RETURN NEW;
END; $$;

-- 4. Update trigger: same.
CREATE OR REPLACE FUNCTION public.patient_registrations_instead_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  UPDATE patients SET file_number = NEW.file_number, first_name = NEW.first_name, middle_name = NEW.middle_name, family_name = NEW.family_name, patient_name = NEW.patient_name, date_of_birth = NEW.date_of_birth, dob_known = NEW.dob_known, estimated_age = NEW.estimated_age, sex = NEW.sex, phone = NEW.phone, email = NEW.email, address_line1 = NEW.address_line1, address_line2 = NEW.address_line2, city = NEW.city, county = NEW.county, postal_code = NEW.postal_code, country = NEW.country, occupation = NEW.occupation, marital_status = NEW.marital_status, nationality = NEW.nationality, religion = NEW.religion, education_level = NEW.education_level, is_deceased = NEW.is_deceased, date_of_death = NEW.date_of_death, cause_of_death = NEW.cause_of_death, next_of_kin = NEW.next_of_kin, relationships = NEW.relationships, updated_at = now()
  WHERE id = (SELECT patient_id FROM encounters WHERE id = OLD.id);
  UPDATE encounters SET payment_mode = NEW.payment_mode, insurance_provider_id = NEW.insurance_provider_id, insurance_coverage_percentage = NEW.insurance_coverage_percentage, tests = NEW.tests, subtotal = NEW.subtotal, insurance_covered = NEW.insurance_covered, patient_due = NEW.patient_due, status = NEW.status, notes = NEW.notes, payment_status = NEW.payment_status, amount_paid = NEW.amount_paid, paid_at = NEW.paid_at, paid_by = NEW.paid_by, payment_method = NEW.payment_method, payment_reference = NEW.payment_reference, from_room = NEW.from_room, current_room_id = NEW.current_room_id, next_room_id = NEW.next_room_id, vitals = NEW.vitals, history = NEW.history, diagnoses = NEW.diagnoses, acknowledged_by = NEW.acknowledged_by, acknowledged_at = NEW.acknowledged_at, is_emergency = COALESCE(NEW.is_emergency, false), referral_direction = NEW.referral_direction
  WHERE id = OLD.id;
  RETURN NEW;
END; $$;

-- 5. Dashboard function: emergency case count + referral in/out counts within a date range.
CREATE OR REPLACE FUNCTION public.dashboard_emergency_referrals(p_start date, p_end date)
RETURNS TABLE(emergency_count bigint, referrals_in bigint, referrals_out bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(*) FILTER (WHERE is_emergency) AS emergency_count,
    COUNT(*) FILTER (WHERE referral_direction = 'in') AS referrals_in,
    COUNT(*) FILTER (WHERE referral_direction = 'out') AS referrals_out
  FROM encounters
  WHERE created_at::date BETWEEN p_start AND p_end;
$$;
