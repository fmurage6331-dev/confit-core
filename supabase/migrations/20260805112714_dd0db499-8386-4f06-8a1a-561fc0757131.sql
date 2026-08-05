CREATE OR REPLACE FUNCTION public.patient_registrations_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient_id uuid;
  v_encounter_id uuid;
BEGIN
  v_patient_id := NEW.patient_id;

  IF v_patient_id IS NULL THEN
    INSERT INTO public.patients (
      patient_name, first_name, middle_name, family_name, sex,
      date_of_birth, dob_known, estimated_age, phone, email,
      address_line1, address_line2, city, county, postal_code, country,
      occupation, marital_status, nationality, religion, education_level,
      is_deceased, date_of_death, cause_of_death, relationships, next_of_kin,
      national_id, national_id_type, sha_member_number, sha_relationship_to_principal,
      file_number, created_by
    ) VALUES (
      NEW.patient_name, NEW.first_name, NEW.middle_name, NEW.family_name, NEW.sex,
      NEW.date_of_birth, COALESCE(NEW.dob_known, true), NEW.estimated_age, NEW.phone, NEW.email,
      NEW.address_line1, NEW.address_line2, NEW.city, NEW.county, NEW.postal_code, NEW.country,
      NEW.occupation, NEW.marital_status, NEW.nationality, NEW.religion, NEW.education_level,
      COALESCE(NEW.is_deceased, false), NEW.date_of_death, NEW.cause_of_death,
      COALESCE(NEW.relationships, '[]'::jsonb), COALESCE(NEW.next_of_kin, '{}'::jsonb),
      NEW.national_id, NEW.national_id_type, NEW.sha_member_number, NEW.sha_relationship_to_principal,
      NEW.file_number, NEW.created_by
    )
    RETURNING id INTO v_patient_id;
  END IF;

  INSERT INTO public.encounters (
    patient_id, payment_mode, insurance_provider_id, insurance_coverage_percentage,
    insurance_policy_number, insurer_type, sha_notification_number, sha_fund_type,
    claim_status, claim_number, preauth_number,
    tests, subtotal, insurance_covered, patient_due, status, notes,
    payment_status, amount_paid, paid_at, paid_by, payment_method, payment_reference,
    from_room, current_room_id, next_room_id, vitals, history, diagnoses,
    is_emergency, referral_direction, referral_out_facility, referral_out_reason,
    created_by
  ) VALUES (
    v_patient_id, NEW.payment_mode, NEW.insurance_provider_id, NEW.insurance_coverage_percentage,
    NEW.insurance_policy_number, NEW.insurer_type, NEW.sha_notification_number, NEW.sha_fund_type,
    NEW.claim_status, NEW.claim_number, NEW.preauth_number,
    COALESCE(NEW.tests, '[]'::jsonb), COALESCE(NEW.subtotal, 0), COALESCE(NEW.insurance_covered, 0),
    COALESCE(NEW.patient_due, 0), COALESCE(NEW.status, 'pending'), NEW.notes,
    COALESCE(NEW.payment_status, 'unpaid'), COALESCE(NEW.amount_paid, 0), NEW.paid_at, NEW.paid_by,
    NEW.payment_method, NEW.payment_reference,
    NEW.from_room, NEW.current_room_id, NEW.next_room_id,
    COALESCE(NEW.vitals, '{}'::jsonb), COALESCE(NEW.history, '{}'::jsonb), COALESCE(NEW.diagnoses, '[]'::jsonb),
    COALESCE(NEW.is_emergency, false), NEW.referral_direction, NEW.referral_out_facility, NEW.referral_out_reason,
    NEW.created_by
  )
  RETURNING id INTO v_encounter_id;

  NEW.id := v_encounter_id;
  NEW.patient_id := v_patient_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.patient_registrations_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.patients SET
    patient_name = NEW.patient_name,
    first_name = NEW.first_name,
    middle_name = NEW.middle_name,
    family_name = NEW.family_name,
    sex = NEW.sex,
    date_of_birth = NEW.date_of_birth,
    dob_known = NEW.dob_known,
    estimated_age = NEW.estimated_age,
    phone = NEW.phone,
    email = NEW.email,
    file_number = NEW.file_number,
    address_line1 = NEW.address_line1,
    address_line2 = NEW.address_line2,
    city = NEW.city,
    county = NEW.county,
    postal_code = NEW.postal_code,
    country = NEW.country,
    occupation = NEW.occupation,
    marital_status = NEW.marital_status,
    nationality = NEW.nationality,
    religion = NEW.religion,
    education_level = NEW.education_level,
    is_deceased = NEW.is_deceased,
    date_of_death = NEW.date_of_death,
    cause_of_death = NEW.cause_of_death,
    relationships = NEW.relationships,
    next_of_kin = NEW.next_of_kin,
    national_id = NEW.national_id,
    national_id_type = NEW.national_id_type,
    sha_member_number = NEW.sha_member_number,
    sha_relationship_to_principal = NEW.sha_relationship_to_principal,
    updated_at = now()
  WHERE id = OLD.patient_id;

  UPDATE public.encounters SET
    payment_mode = NEW.payment_mode,
    insurance_provider_id = NEW.insurance_provider_id,
    insurance_coverage_percentage = NEW.insurance_coverage_percentage,
    insurance_policy_number = NEW.insurance_policy_number,
    insurer_type = NEW.insurer_type,
    sha_notification_number = NEW.sha_notification_number,
    sha_fund_type = NEW.sha_fund_type,
    claim_status = NEW.claim_status,
    claim_number = NEW.claim_number,
    preauth_number = NEW.preauth_number,
    tests = NEW.tests,
    subtotal = NEW.subtotal,
    insurance_covered = NEW.insurance_covered,
    patient_due = NEW.patient_due,
    status = NEW.status,
    notes = NEW.notes,
    payment_status = NEW.payment_status,
    amount_paid = NEW.amount_paid,
    paid_at = NEW.paid_at,
    paid_by = NEW.paid_by,
    payment_method = NEW.payment_method,
    payment_reference = NEW.payment_reference,
    from_room = NEW.from_room,
    current_room_id = NEW.current_room_id,
    next_room_id = NEW.next_room_id,
    vitals = NEW.vitals,
    history = NEW.history,
    diagnoses = NEW.diagnoses,
    is_emergency = NEW.is_emergency,
    referral_direction = NEW.referral_direction,
    referral_out_facility = NEW.referral_out_facility,
    referral_out_reason = NEW.referral_out_reason,
    acknowledged_by = NEW.acknowledged_by,
    acknowledged_at = NEW.acknowledged_at,
    updated_at = now()
  WHERE id = OLD.id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS patient_registrations_insert_trg ON public.patient_registrations;
CREATE TRIGGER patient_registrations_insert_trg
INSTEAD OF INSERT ON public.patient_registrations
FOR EACH ROW EXECUTE FUNCTION public.patient_registrations_insert();

DROP TRIGGER IF EXISTS patient_registrations_update_trg ON public.patient_registrations;
CREATE TRIGGER patient_registrations_update_trg
INSTEAD OF UPDATE ON public.patient_registrations
FOR EACH ROW EXECUTE FUNCTION public.patient_registrations_update();

GRANT SELECT, INSERT, UPDATE ON public.patient_registrations TO authenticated;
GRANT ALL ON public.patient_registrations TO service_role;