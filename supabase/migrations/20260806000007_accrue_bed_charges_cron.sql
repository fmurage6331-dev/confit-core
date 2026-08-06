-- Bed charge daily accrual — pg_cron job
-- Function accrue_daily_bed_charges() already exists
-- This migration schedules it nightly at 21:01 UTC (00:01 EAT)
-- Runs for all admissions with status = 'admitted' that have a linked invoice

SELECT cron.unschedule('accrue-daily-bed-charges')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'accrue-daily-bed-charges'
);

SELECT cron.schedule(
  'accrue-daily-bed-charges',
  '1 21 * * *',
  $$ SELECT public.accrue_daily_bed_charges(); $$
);
