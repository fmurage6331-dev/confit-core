-- Drift fix: dha_outbound_queue table has no CREATE TABLE in any migration.
-- This migration documents its structure and creates it if it doesn't exist
-- (safe to run on live DB that already has it).

CREATE TABLE IF NOT EXISTS public.dha_outbound_queue (
  id                  uuid DEFAULT gen_random_uuid() NOT NULL,
  encounter_id        uuid REFERENCES public.encounters(id) ON DELETE SET NULL,
  patient_id          uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  queue_type          text NOT NULL,
  insurer_type        text,
  payload             jsonb,
  status              text DEFAULT 'pending',
  attempts            integer DEFAULT 0,
  last_attempted_at   timestamptz,
  response            jsonb,
  error_message       text,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now(),
  CONSTRAINT dha_outbound_queue_pkey PRIMARY KEY (id),
  CONSTRAINT dha_outbound_queue_queue_type_check
    CHECK (queue_type IN (
      'fhir_sync', 'sha_claim', 'private_claim',
      'cash_receipt', 'shr_access_notification'
    )),
  CONSTRAINT dha_outbound_queue_status_check
    CHECK (status IN (
      'pending', 'processing', 'sent',
      'acknowledged', 'failed', 'skipped'
    ))
);

CREATE INDEX IF NOT EXISTS idx_dha_outbound_queue_status
  ON public.dha_outbound_queue(status);
CREATE INDEX IF NOT EXISTS idx_dha_outbound_queue_encounter
  ON public.dha_outbound_queue(encounter_id);
CREATE INDEX IF NOT EXISTS idx_dha_outbound_queue_created
  ON public.dha_outbound_queue(created_at DESC);

-- RLS
ALTER TABLE public.dha_outbound_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "dha_outbound_queue_authenticated"
  ON public.dha_outbound_queue
  FOR ALL
  TO authenticated
  USING (public.is_approved(auth.uid()));

COMMENT ON TABLE public.dha_outbound_queue IS
  'Outbound queue for DHA/AfyaLink HIE API calls — fhir_sync, sha_claim, private_claim, shr_access_notification';
