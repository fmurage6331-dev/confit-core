-- SHA claims compliance + state machine foundation.
-- Adds resubmission / payment columns, status history, the payment_completed
-- terminal status, the PHF zero-copay marker, and the sha_claims_aging view.

-- 1. Missing sha_claims columns
ALTER TABLE public.sha_claims
  ADD COLUMN IF NOT EXISTS resubmission_count  integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_reference   text,
  ADD COLUMN IF NOT EXISTS payment_date        date,
  ADD COLUMN IF NOT EXISTS last_status_check   timestamptz;

-- 2. Extend allowed status set to include the payment_completed terminal status
--    used by the claims-queue state machine.
ALTER TABLE public.sha_claims
  DROP CONSTRAINT IF EXISTS sha_claims_status_check;

ALTER TABLE public.sha_claims
  ADD CONSTRAINT sha_claims_status_check
  CHECK (status IN (
    'draft', 'pending_otp', 'pending_preauth',
    'ready', 'submitted', 'acknowledged',
    'approved', 'rejected', 'appealed',
    'paid', 'payment_completed'
  ));

-- 3. SHA claim status history
CREATE TABLE IF NOT EXISTS public.sha_claim_status_history (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id        uuid NOT NULL REFERENCES public.sha_claims(id) ON DELETE CASCADE,
  previous_status text,
  new_status      text NOT NULL,
  changed_by      uuid REFERENCES auth.users(id),
  reason          text,
  notes           text,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sha_claim_status_history_claim
  ON public.sha_claim_status_history (claim_id, created_at DESC);

ALTER TABLE public.sha_claim_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth users sha claim history"
  ON public.sha_claim_status_history;

CREATE POLICY "auth users sha claim history"
  ON public.sha_claim_status_history
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS audit_sha_claim_status_history
  ON public.sha_claim_status_history;

CREATE TRIGGER audit_sha_claim_status_history
  AFTER INSERT OR UPDATE OR DELETE
  ON public.sha_claim_status_history
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

-- 4. PHF zero-copay rule (PHF = public health facility; patient pays nothing)
CREATE OR REPLACE FUNCTION public.enforce_phf_zero_claim()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- PHF claims: SHA covers 100%. Stamp the claim so the insurance desk
  -- and any downstream invoice/claim exports never expect a patient portion.
  IF NEW.fund_type = 'PHF' THEN
    NEW.notes := COALESCE(NEW.notes, '')
      || CASE WHEN POSITION('[PHF: zero patient copay — SHA covers 100%]' IN COALESCE(NEW.notes, '')) > 0
              THEN ''
              ELSE ' [PHF: zero patient copay — SHA covers 100%]'
         END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_phf_zero_claim ON public.sha_claims;

CREATE TRIGGER enforce_phf_zero_claim
  BEFORE INSERT OR UPDATE ON public.sha_claims
  FOR EACH ROW EXECUTE FUNCTION public.enforce_phf_zero_claim();

-- 5. SHA claims aging view (status ageing, not invoice ageing)
CREATE OR REPLACE VIEW public.sha_claims_aging AS
SELECT
  sc.id,
  sc.fund_type,
  sc.status,
  sc.claim_subtype,
  sc.total_amount,
  sc.approved_amount,
  sc.rejected_amount,
  sc.resubmission_count,
  sc.preauth_status,
  sc.cr_number_missing,
  sc.sha_member_missing,
  sc.fhir_built_at,
  sc.submitted_at,
  sc.created_at,
  EXTRACT(DAY FROM now() - sc.created_at)::integer AS age_days,
  CASE
    WHEN sc.status = 'draft'
         AND EXTRACT(DAY FROM now() - sc.created_at) > 7
      THEN 'overdue_submission'
    WHEN sc.status = 'submitted'
         AND sc.submitted_at IS NOT NULL
         AND EXTRACT(DAY FROM now() - sc.submitted_at) > 30
      THEN 'overdue_response'
    WHEN sc.status = 'rejected'
      THEN 'needs_resubmission'
    ELSE 'on_track'
  END AS aging_status,
  p.patient_name,
  p.file_number,
  p.sha_member_number
FROM public.sha_claims sc
JOIN public.patients p ON p.id = sc.patient_id;
