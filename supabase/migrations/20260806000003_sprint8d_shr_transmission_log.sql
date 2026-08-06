-- Sprint 8D: SHR Transmission Metadata Log
-- Digital Health (Data Exchange Component) Regulations 2025
-- Requirement: system must maintain a metadata log of all SHR transmissions
-- SEPARATE from the general audit log — distinct statutory obligation
-- Captures: what was sent, when, to whom, success/failure
-- Fires on dha_outbound_queue status changes for fhir_sync +
-- shr_access_notification queue types

-- ============================================================
-- 1. SHR TRANSMISSION LOG TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.shr_transmission_log (
  id                uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  queue_id          uuid        NOT NULL,
  encounter_id      uuid,
  patient_id        uuid,
  transmission_type text        NOT NULL,
  status            text        NOT NULL,
  payload_summary   jsonb,
  response_code     text,
  error_message     text,
  transmitted_at    timestamptz NOT NULL DEFAULT now(),
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shr_log_patient_id
  ON public.shr_transmission_log (patient_id);

CREATE INDEX IF NOT EXISTS idx_shr_log_encounter_id
  ON public.shr_transmission_log (encounter_id);

CREATE INDEX IF NOT EXISTS idx_shr_log_transmitted_at
  ON public.shr_transmission_log (transmitted_at);

CREATE INDEX IF NOT EXISTS idx_shr_log_transmission_type
  ON public.shr_transmission_log (transmission_type);

COMMENT ON TABLE public.shr_transmission_log IS
  'DHA statutory SHR transmission metadata log — Digital Health (Data Exchange Component) Regulations 2025. Separate from audit_log per regulatory requirement.';

-- ============================================================
-- 2. RLS — READ-ONLY FOR USERS (append-only, mirrors audit_log)
-- ============================================================
ALTER TABLE public.shr_transmission_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shr_log_select"
  ON public.shr_transmission_log FOR SELECT
  TO authenticated
  USING (public.is_approved(auth.uid()));

CREATE POLICY "shr_log_no_insert"
  ON public.shr_transmission_log FOR INSERT
  TO authenticated
  WITH CHECK (false);

CREATE POLICY "shr_log_no_update"
  ON public.shr_transmission_log FOR UPDATE
  TO authenticated
  USING (false);

CREATE POLICY "shr_log_no_delete"
  ON public.shr_transmission_log FOR DELETE
  TO authenticated
  USING (false);

-- ============================================================
-- 3. TRIGGER FUNCTION
-- Fires on dha_outbound_queue UPDATE when status changes
-- Only logs fhir_sync and shr_access_notification types
-- ============================================================
CREATE OR REPLACE FUNCTION public.trg_shr_transmission_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only log SHR-relevant queue types
  IF NEW.queue_type NOT IN ('fhir_sync', 'shr_access_notification') THEN
    RETURN NEW;
  END IF;

  -- Only log when status actually changes
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.shr_transmission_log (
    queue_id,
    encounter_id,
    patient_id,
    transmission_type,
    status,
    payload_summary,
    response_code,
    error_message,
    transmitted_at,
    created_at
  ) VALUES (
    NEW.id,
    NEW.encounter_id,
    NEW.patient_id,
    NEW.queue_type,
    NEW.status,
    jsonb_build_object(
      'queue_type',       NEW.queue_type,
      'previous_status',  OLD.status,
      'new_status',       NEW.status,
      'attempts',         NEW.attempts,
      'last_attempted_at',NEW.last_attempted_at,
      'payload_keys',     (
        SELECT jsonb_agg(k)
        FROM jsonb_object_keys(COALESCE(NEW.payload, '{}'::jsonb)) AS k
      )
    ),
    (NEW.response->>'code'),
    NEW.error_message,
    NOW(),
    NOW()
  );

  RETURN NEW;
END;
$$;

-- ============================================================
-- 4. ATTACH TRIGGER TO dha_outbound_queue
-- ============================================================
DROP TRIGGER IF EXISTS trg_shr_transmission_log ON public.dha_outbound_queue;

CREATE TRIGGER trg_shr_transmission_log
  AFTER UPDATE ON public.dha_outbound_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_shr_transmission_log();

-- ============================================================
-- 5. ALSO LOG ON INSERT (captures initial queue entry)
-- ============================================================
CREATE OR REPLACE FUNCTION public.trg_shr_transmission_log_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.queue_type NOT IN ('fhir_sync', 'shr_access_notification') THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.shr_transmission_log (
    queue_id,
    encounter_id,
    patient_id,
    transmission_type,
    status,
    payload_summary,
    transmitted_at,
    created_at
  ) VALUES (
    NEW.id,
    NEW.encounter_id,
    NEW.patient_id,
    NEW.queue_type,
    NEW.status,
    jsonb_build_object(
      'queue_type',   NEW.queue_type,
      'payload_keys', (
        SELECT jsonb_agg(k)
        FROM jsonb_object_keys(COALESCE(NEW.payload, '{}'::jsonb)) AS k
      )
    ),
    NOW(),
    NOW()
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_shr_transmission_log_insert ON public.dha_outbound_queue;

CREATE TRIGGER trg_shr_transmission_log_insert
  AFTER INSERT ON public.dha_outbound_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_shr_transmission_log_insert();
