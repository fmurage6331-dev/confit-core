-- Sprint 8C: SHR Client Access Notification
-- Digital Health (Data Exchange Component) Regulations 2025
-- Requirement: system must electronically alert the client whenever
-- their SHR is accessed. Fires on every new encounter (= SHR access event).
-- SMS delivery is a stub until Africa's Talking credentials arrive.
-- Notification is queued in dha_outbound_queue for the claims-dispatcher
-- Edge Function to process when credentials are available.

-- ============================================================
-- 1. TRIGGER FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION public.trg_shr_access_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient_name text;
  v_patient_phone text;
BEGIN
  -- Look up patient contact details
  SELECT patient_name, phone
  INTO   v_patient_name, v_patient_phone
  FROM   public.patients
  WHERE  id = NEW.patient_id;

  -- Only queue if patient has a phone number
  IF v_patient_phone IS NULL OR trim(v_patient_phone) = '' THEN
    RETURN NEW;
  END IF;

  -- Queue SHR access notification
  INSERT INTO public.dha_outbound_queue (
    id,
    encounter_id,
    patient_id,
    queue_type,
    payload,
    status,
    attempts,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    NEW.id,
    NEW.patient_id,
    'shr_access_notification',
    jsonb_build_object(
      'patient_id',     NEW.patient_id,
      'patient_name',   v_patient_name,
      'patient_phone',  v_patient_phone,
      'encounter_id',   NEW.id,
      'accessed_at',    NOW(),
      'message',        format(
        'AegisCare: Your health record was accessed on %s. If this was not authorised, call your facility immediately.',
        to_char(NOW() AT TIME ZONE 'Africa/Nairobi', 'DD-Mon-YYYY HH24:MI')
      )
    ),
    'pending',
    0,
    NOW(),
    NOW()
  );

  RETURN NEW;
END;
$$;

-- ============================================================
-- 2. ATTACH TRIGGER TO encounters
-- ============================================================
DROP TRIGGER IF EXISTS trg_shr_access_notification ON public.encounters;

CREATE TRIGGER trg_shr_access_notification
  AFTER INSERT ON public.encounters
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_shr_access_notification();

-- ============================================================
-- 3. ALSO FIRE ON BREAK-GLASS ACCESS
-- Update log_break_glass_access() to also queue a notification
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_break_glass_access(
  p_patient_id     uuid,
  p_justification  text,
  p_accessed_by    uuid,
  p_accessor_email text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient_name  text;
  v_patient_phone text;
BEGIN
  IF p_justification IS NULL OR trim(p_justification) = '' THEN
    RAISE EXCEPTION 'Break-glass justification is required';
  END IF;

  -- Write BREAK_GLASS audit event
  INSERT INTO public.audit_log (
    id,
    table_name,
    record_id,
    action,
    old_data,
    new_data,
    changed_by,
    changed_at
  ) VALUES (
    gen_random_uuid(),
    'patients',
    p_patient_id,
    'BREAK_GLASS',
    NULL,
    jsonb_build_object(
      'justification',      trim(p_justification),
      'accessed_by_email',  p_accessor_email,
      'accessed_at',        NOW()
    ),
    p_accessed_by,
    NOW()
  );

  -- Look up patient contact details
  SELECT patient_name, phone
  INTO   v_patient_name, v_patient_phone
  FROM   public.patients
  WHERE  id = p_patient_id;

  -- Queue break-glass SHR access notification if patient has phone
  IF v_patient_phone IS NOT NULL AND trim(v_patient_phone) != '' THEN
    INSERT INTO public.dha_outbound_queue (
      id,
      patient_id,
      queue_type,
      payload,
      status,
      attempts,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      p_patient_id,
      'shr_access_notification',
      jsonb_build_object(
        'patient_id',     p_patient_id,
        'patient_name',   v_patient_name,
        'patient_phone',  v_patient_phone,
        'access_type',    'BREAK_GLASS',
        'accessed_by',    p_accessor_email,
        'accessed_at',    NOW(),
        'message',        format(
          'AegisCare URGENT: Emergency access to your health record was made on %s by %s. Contact your facility if not authorised.',
          to_char(NOW() AT TIME ZONE 'Africa/Nairobi', 'DD-Mon-YYYY HH24:MI'),
          p_accessor_email
        )
      ),
      'pending',
      0,
      NOW(),
      NOW()
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.log_break_glass_access(uuid, text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_break_glass_access(uuid, text, uuid, text) TO authenticated;
