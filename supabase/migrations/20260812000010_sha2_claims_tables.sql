-- SHA-2: sha_claims + sha_claim_items + sha_claim_packages
-- SHA-3: patients.cr_number (DHA Client Registry number)

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS cr_number text;

COMMENT ON COLUMN public.patients.cr_number IS
  'DHA Client Registry number — retrieved via CR lookup API';

CREATE TABLE IF NOT EXISTS public.sha_claims (
  id                    uuid DEFAULT gen_random_uuid() NOT NULL,
  encounter_id          uuid REFERENCES public.encounters(id) ON DELETE SET NULL,
  patient_id            uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  claim_number          text,
  dha_claim_id          text,
  claim_type            text NOT NULL DEFAULT 'sha_shif',
  fund_type             text,
  status                text NOT NULL DEFAULT 'draft',
  preauth_number        text,
  preauth_status        text,
  preauth_requested_at  timestamptz,
  preauth_approved_at   timestamptz,
  otp_verified          boolean DEFAULT false,
  otp_verified_at       timestamptz,
  consent_token         text,
  total_amount          numeric DEFAULT 0,
  approved_amount       numeric,
  rejected_amount       numeric,
  rejection_reason      text,
  fhir_bundle           jsonb,
  submitted_at          timestamptz,
  acknowledged_at       timestamptz,
  resolved_at           timestamptz,
  submitted_by          uuid,
  notes                 text,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now(),
  CONSTRAINT sha_claims_pkey PRIMARY KEY (id),
  CONSTRAINT sha_claims_claim_type_check
    CHECK (claim_type IN ('sha_shif', 'sha_phf', 'sha_eccif', 'private', 'cash')),
  CONSTRAINT sha_claims_fund_type_check
    CHECK (fund_type IN ('PHF', 'SHIF', 'ECCIF') OR fund_type IS NULL),
  CONSTRAINT sha_claims_status_check
    CHECK (status IN (
      'draft', 'pending_otp', 'pending_preauth',
      'ready', 'submitted', 'acknowledged',
      'approved', 'rejected', 'appealed', 'paid'
    ))
);

CREATE TABLE IF NOT EXISTS public.sha_claim_items (
  id                    uuid DEFAULT gen_random_uuid() NOT NULL,
  claim_id              uuid NOT NULL REFERENCES public.sha_claims(id) ON DELETE CASCADE,
  invoice_line_item_id  uuid REFERENCES public.invoice_line_items(id) ON DELETE SET NULL,
  item_type             text NOT NULL,
  description           text NOT NULL,
  quantity              numeric DEFAULT 1,
  unit_price            numeric DEFAULT 0,
  amount                numeric DEFAULT 0,
  intervention_code     text,
  is_included           boolean DEFAULT true,
  created_at            timestamptz DEFAULT now(),
  CONSTRAINT sha_claim_items_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.sha_claim_packages (
  id                  uuid DEFAULT gen_random_uuid() NOT NULL,
  claim_id            uuid NOT NULL REFERENCES public.sha_claims(id) ON DELETE CASCADE,
  package_id          uuid NOT NULL REFERENCES public.sha_benefit_packages(id),
  package_code        text NOT NULL,
  is_primary          boolean DEFAULT false,
  created_at          timestamptz DEFAULT now(),
  CONSTRAINT sha_claim_packages_pkey PRIMARY KEY (id),
  CONSTRAINT sha_claim_packages_unique UNIQUE (claim_id, package_code)
);

CREATE INDEX IF NOT EXISTS idx_sha_claims_encounter    ON public.sha_claims(encounter_id);
CREATE INDEX IF NOT EXISTS idx_sha_claims_patient      ON public.sha_claims(patient_id);
CREATE INDEX IF NOT EXISTS idx_sha_claims_status       ON public.sha_claims(status);
CREATE INDEX IF NOT EXISTS idx_sha_claims_submitted    ON public.sha_claims(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_sha_claim_items_claim   ON public.sha_claim_items(claim_id);
CREATE INDEX IF NOT EXISTS idx_sha_claim_packages_claim ON public.sha_claim_packages(claim_id);

ALTER TABLE public.sha_claims         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sha_claim_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sha_claim_packages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sha_claims_authenticated"          ON public.sha_claims;
DROP POLICY IF EXISTS "sha_claim_items_authenticated"     ON public.sha_claim_items;
DROP POLICY IF EXISTS "sha_claim_packages_authenticated"  ON public.sha_claim_packages;

CREATE POLICY "sha_claims_authenticated"
  ON public.sha_claims FOR ALL TO authenticated
  USING (public.is_approved(auth.uid()));

CREATE POLICY "sha_claim_items_authenticated"
  ON public.sha_claim_items FOR ALL TO authenticated
  USING (public.is_approved(auth.uid()));

CREATE POLICY "sha_claim_packages_authenticated"
  ON public.sha_claim_packages FOR ALL TO authenticated
  USING (public.is_approved(auth.uid()));
