-- ============================================================================
-- Migration: 20260917000001_lab_results_email.sql
-- Description: Brevo lab results email integration with immutable audit log and trigger
-- ============================================================================

-- 1. Enable pg_net (required for HTTP calls from triggers)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 2. email_send_log table
CREATE TABLE IF NOT EXISTS public.email_send_log (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id       uuid,
  lab_order_id     uuid,
  email_address    text,
  sent_at          timestamptz DEFAULT now(),
  status           text CHECK (status IN ('sent','failed','no_email')),
  brevo_message_id text,
  error_message    text
);

CREATE INDEX IF NOT EXISTS idx_email_send_log_patient_id ON public.email_send_log (patient_id);
CREATE INDEX IF NOT EXISTS idx_email_send_log_lab_order_id ON public.email_send_log (lab_order_id);
CREATE INDEX IF NOT EXISTS idx_email_send_log_sent_at ON public.email_send_log (sent_at DESC);

COMMENT ON TABLE public.email_send_log IS
  'Immutable log of transactional lab result emails sent via Brevo.';
COMMENT ON COLUMN public.email_send_log.status IS
  'Delivery attempt status: sent | failed | no_email';

-- RLS:
-- ENABLE ROW LEVEL SECURITY
-- service_role -> INSERT (no RLS bypass needed, SECURITY DEFINER function handles it)
-- authenticated + is_approved(auth.uid()) -> SELECT
-- NO UPDATE, NO DELETE policies
ALTER TABLE public.email_send_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_send_log_select" ON public.email_send_log;
CREATE POLICY "email_send_log_select"
  ON public.email_send_log FOR SELECT
  TO authenticated
  USING (public.is_approved(auth.uid()));

DROP POLICY IF EXISTS "email_send_log_service_role_insert" ON public.email_send_log;
CREATE POLICY "email_send_log_service_role_insert"
  ON public.email_send_log FOR INSERT
  TO service_role
  WITH CHECK (true);

-- 3. Immutability trigger (same pattern as audit_log and pii_access_log)
-- Block UPDATE and DELETE on email_send_log
-- RAISE EXCEPTION 'email_send_log records are immutable'
CREATE OR REPLACE FUNCTION public.block_email_send_log_modification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'email_send_log records are immutable';
END;
$$;

DROP TRIGGER IF EXISTS trg_immutable_email_send_log ON public.email_send_log;
CREATE TRIGGER trg_immutable_email_send_log
  BEFORE UPDATE OR DELETE ON public.email_send_log
  FOR EACH ROW
  EXECUTE FUNCTION public.block_email_send_log_modification();

-- 4. DB trigger function: notify_lab_result_complete()
-- RETURNS trigger, LANGUAGE plpgsql, SECURITY DEFINER
-- Fires AFTER UPDATE OF status ON lab_orders
-- FOR EACH ROW
-- WHEN (NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed')
CREATE OR REPLACE FUNCTION public.notify_lab_result_complete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, net
AS $$
DECLARE
  v_email            text;
  v_base_url         text;
  v_url              text;
  v_service_role_key text;
  v_headers          jsonb;
  v_body             jsonb;
BEGIN
  -- Wrap in BEGIN/EXCEPTION so trigger NEVER blocks lab order update
  BEGIN
    -- Check if patient has email:
    SELECT email INTO v_email
    FROM public.patients
    WHERE id = NEW.patient_id
      AND email IS NOT NULL
      AND trim(email) <> '';

    -- If no email: INSERT into email_send_log (status='no_email') and RETURN NEW
    IF v_email IS NULL THEN
      INSERT INTO public.email_send_log (
        patient_id,
        lab_order_id,
        email_address,
        status,
        error_message
      ) VALUES (
        NEW.patient_id,
        NEW.id,
        NULL,
        'no_email',
        'Patient has no email address'
      );
      RETURN NEW;
    END IF;

    -- URL resolution: current_setting('app.supabase_url', true)
    -- fallback: hardcoded 'https://tvdsanagnijrockptzat.supabase.co/functions/v1/send-lab-results'
    v_base_url := nullif(current_setting('app.supabase_url', true), '');
    IF v_base_url IS NOT NULL THEN
      v_url := rtrim(v_base_url, '/') || '/functions/v1/send-lab-results';
    ELSE
      v_url := 'https://tvdsanagnijrockptzat.supabase.co/functions/v1/send-lab-results';
    END IF;

    -- Authorization header: read from current_setting('app.service_role_key', true)
    -- if empty, read from vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1
    v_service_role_key := nullif(current_setting('app.service_role_key', true), '');
    IF v_service_role_key IS NULL THEN
      BEGIN
        SELECT ds.decrypted_secret
          INTO v_service_role_key
          FROM vault.decrypted_secrets ds
         WHERE ds.name = 'SUPABASE_SERVICE_ROLE_KEY'
         LIMIT 1;
      EXCEPTION
        WHEN undefined_table OR invalid_schema_name OR insufficient_privilege OR undefined_column THEN
          v_service_role_key := NULL;
      END;
    END IF;

    v_headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(v_service_role_key, '')
    );

    v_body := jsonb_build_object(
      'lab_order_id', NEW.id::text
    );

    -- Call pg_net.http_post() to invoke the Edge Function (fire-and-forget)
    IF to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') IS NOT NULL THEN
      PERFORM net.http_post(
        url := v_url,
        headers := v_headers,
        body := v_body
      );
    ELSIF to_regprocedure('extensions.http_post(text,jsonb,jsonb,jsonb,integer)') IS NOT NULL THEN
      PERFORM extensions.http_post(
        url := v_url,
        headers := v_headers,
        body := v_body
      );
    ELSIF to_regprocedure('pg_net.http_post(text,jsonb,jsonb,jsonb,integer)') IS NOT NULL THEN
      EXECUTE 'SELECT pg_net.http_post(url := $1, headers := $2, body := $3)'
        USING v_url, v_headers, v_body;
    ELSE
      PERFORM net.http_post(
        url := v_url,
        headers := v_headers,
        body := v_body
      );
    END IF;

  EXCEPTION WHEN OTHERS THEN
    -- Trigger must NEVER block lab order update
    RAISE WARNING 'notify_lab_result_complete failed: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- 5. Create the trigger
DROP TRIGGER IF EXISTS trg_lab_result_complete_email ON public.lab_orders;
CREATE TRIGGER trg_lab_result_complete_email
  AFTER UPDATE OF status ON public.lab_orders
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed')
  EXECUTE FUNCTION public.notify_lab_result_complete();

-- 6. Verify block (same pattern as encryption migration)
DO $$
DECLARE
  v_missing text[] := ARRAY[]::text[];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    v_missing := array_append(v_missing, 'extension pg_net');
  END IF;

  IF to_regclass('public.email_send_log') IS NULL THEN
    v_missing := array_append(v_missing, 'table email_send_log');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.lab_orders'::regclass
      AND tgname = 'trg_lab_result_complete_email'
  ) THEN
    v_missing := array_append(v_missing, 'trigger trg_lab_result_complete_email');
  END IF;

  IF cardinality(v_missing) > 0 THEN
    RAISE EXCEPTION 'Lab results email integration migration incomplete — missing: %', array_to_string(v_missing, ', ');
  END IF;

  RAISE NOTICE 'Lab results email integration verified OK.';
END;
$$;
