-- Drift fix: consent_otps table — structure documented.
-- Table exists in live DB via 20260805000000 DDL section
-- but we document it explicitly here for transfer safety.

CREATE TABLE IF NOT EXISTS public.consent_otps (
  id                  uuid DEFAULT gen_random_uuid() NOT NULL,
  patient_id          uuid REFERENCES public.patients(id) ON DELETE CASCADE,
  encounter_id        uuid REFERENCES public.encounters(id) ON DELETE SET NULL,
  phone               text NOT NULL,
  otp_hash            text NOT NULL,
  consent_type        text NOT NULL,
  verified            boolean DEFAULT false,
  expires_at          timestamptz NOT NULL,
  verified_at         timestamptz,
  receptionist_user_id uuid,
  delivery_status     text DEFAULT 'pending',
  override_reason     text,
  created_at          timestamptz DEFAULT now(),
  CONSTRAINT consent_otps_pkey PRIMARY KEY (id),
  CONSTRAINT consent_otps_consent_type_check
    CHECK (consent_type IN (
      'patient_consent', 'sha_claim', 'preauth', 'shr_access'
    )),
  CONSTRAINT consent_otps_delivery_status_check
    CHECK (delivery_status IN ('pending', 'sent', 'failed', 'verified'))
);

CREATE INDEX IF NOT EXISTS idx_consent_otps_patient
  ON public.consent_otps(patient_id);
CREATE INDEX IF NOT EXISTS idx_consent_otps_encounter
  ON public.consent_otps(encounter_id);
CREATE INDEX IF NOT EXISTS idx_consent_otps_expires
  ON public.consent_otps(expires_at);

ALTER TABLE public.consent_otps ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "consent_otps_authenticated"
  ON public.consent_otps
  FOR ALL
  TO authenticated
  USING (public.is_approved(auth.uid()));
