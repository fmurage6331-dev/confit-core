-- Sprint 7A: Audit Log Archiving
-- DHA requirement: 20-year retention
-- Extensions captured by Lovable. Remaining SQL appended manually.
-- NOTE: All objects already applied to DB. IF NOT EXISTS / OR REPLACE guards
--       make this safe to replay.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ============================================================
-- 1. AUDIT LOG ARCHIVE TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_log_archive (
  id           uuid        NOT NULL,
  table_name   text        NOT NULL,
  record_id    uuid,
  action       text        NOT NULL,
  old_data     jsonb,
  new_data     jsonb,
  changed_by   uuid,
  changed_at   timestamptz NOT NULL,
  archived_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_archive_changed_at
  ON public.audit_log_archive (changed_at);

CREATE INDEX IF NOT EXISTS idx_audit_archive_table_name
  ON public.audit_log_archive (table_name);

CREATE INDEX IF NOT EXISTS idx_audit_archive_record_id
  ON public.audit_log_archive (record_id);

-- ============================================================
-- 2. ARCHIVE RUNS TRACKING TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_archive_runs (
  id             uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_at         timestamptz NOT NULL DEFAULT now(),
  rows_archived  integer     NOT NULL DEFAULT 0,
  oldest_row     timestamptz,
  newest_row     timestamptz,
  status         text        NOT NULL DEFAULT 'success',
  error_message  text
);

-- ============================================================
-- 3. RLS — APPEND-ONLY (mirrors audit_log policy)
-- ============================================================
ALTER TABLE public.audit_log_archive  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_archive_runs ENABLE ROW LEVEL SECURITY;

-- audit_log_archive
DROP POLICY IF EXISTS "audit_archive_select"    ON public.audit_log_archive;
DROP POLICY IF EXISTS "audit_archive_no_insert" ON public.audit_log_archive;
DROP POLICY IF EXISTS "audit_archive_no_update" ON public.audit_log_archive;
DROP POLICY IF EXISTS "audit_archive_no_delete" ON public.audit_log_archive;

CREATE POLICY "audit_archive_select"
  ON public.audit_log_archive FOR SELECT
  TO authenticated
  USING (public.is_approved(auth.uid()));

CREATE POLICY "audit_archive_no_insert"
  ON public.audit_log_archive FOR INSERT
  TO authenticated
  WITH CHECK (false);

CREATE POLICY "audit_archive_no_update"
  ON public.audit_log_archive FOR UPDATE
  TO authenticated
  USING (false);

CREATE POLICY "audit_archive_no_delete"
  ON public.audit_log_archive FOR DELETE
  TO authenticated
  USING (false);

-- audit_archive_runs
DROP POLICY IF EXISTS "audit_archive_runs_select"    ON public.audit_archive_runs;
DROP POLICY IF EXISTS "audit_archive_runs_no_insert" ON public.audit_archive_runs;
DROP POLICY IF EXISTS "audit_archive_runs_no_update" ON public.audit_archive_runs;
DROP POLICY IF EXISTS "audit_archive_runs_no_delete" ON public.audit_archive_runs;

CREATE POLICY "audit_archive_runs_select"
  ON public.audit_archive_runs FOR SELECT
  TO authenticated
  USING (public.is_approved(auth.uid()));

CREATE POLICY "audit_archive_runs_no_insert"
  ON public.audit_archive_runs FOR INSERT
  TO authenticated
  WITH CHECK (false);

CREATE POLICY "audit_archive_runs_no_update"
  ON public.audit_archive_runs FOR UPDATE
  TO authenticated
  USING (false);

CREATE POLICY "audit_archive_runs_no_delete"
  ON public.audit_archive_runs FOR DELETE
  TO authenticated
  USING (false);

-- ============================================================
-- 4. ARCHIVE FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION public.archive_old_audit_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cutoff     timestamptz := now() - INTERVAL '2 years';
  v_rows_moved integer     := 0;
  v_oldest     timestamptz;
  v_newest     timestamptz;
BEGIN
  SELECT MIN(changed_at), MAX(changed_at)
  INTO   v_oldest, v_newest
  FROM   public.audit_log
  WHERE  changed_at < v_cutoff;

  IF v_oldest IS NULL THEN
    INSERT INTO public.audit_archive_runs (rows_archived, status)
    VALUES (0, 'no_op');
    RETURN;
  END IF;

  WITH moved AS (
    DELETE FROM public.audit_log
    WHERE changed_at < v_cutoff
    RETURNING
      id, table_name, record_id, action,
      old_data, new_data, changed_by, changed_at
  )
  INSERT INTO public.audit_log_archive (
    id, table_name, record_id, action,
    old_data, new_data, changed_by, changed_at, archived_at
  )
  SELECT
    id, table_name, record_id, action,
    old_data, new_data, changed_by, changed_at, now()
  FROM moved;

  GET DIAGNOSTICS v_rows_moved = ROW_COUNT;

  INSERT INTO public.audit_archive_runs
    (rows_archived, oldest_row, newest_row, status)
  VALUES
    (v_rows_moved, v_oldest, v_newest, 'success');

EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.audit_archive_runs
    (rows_archived, status, error_message)
  VALUES
    (0, 'error', SQLERRM);
  RAISE;
END;
$$;

-- ============================================================
-- 5. pg_cron SCHEDULE (idempotent — unschedule first if exists)
-- Nightly at 23:00 UTC = 02:00 EAT (Africa/Nairobi)
-- ============================================================
SELECT cron.unschedule('archive-audit-logs-nightly')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'archive-audit-logs-nightly'
);

SELECT cron.schedule(
  'archive-audit-logs-nightly',
  '0 23 * * *',
  $$ SELECT public.archive_old_audit_logs(); $$
);