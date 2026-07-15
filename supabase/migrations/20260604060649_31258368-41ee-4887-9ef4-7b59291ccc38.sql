
ALTER TABLE public.patient_registrations
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS amount_paid numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS paid_by uuid,
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS payment_reference text;

UPDATE public.patient_registrations
  SET payment_status = 'waived', amount_paid = 0
  WHERE payment_mode = 'free' AND payment_status = 'unpaid';

ALTER TABLE public.patient_registrations
  DROP CONSTRAINT IF EXISTS patient_registrations_payment_status_check;
ALTER TABLE public.patient_registrations
  ADD CONSTRAINT patient_registrations_payment_status_check
  CHECK (payment_status IN ('unpaid','paid','waived','partial'));
