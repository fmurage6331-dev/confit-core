-- Sprint 8 (G4): FHIR Claim resource on sha_claims
-- sha_claims.fhir_bundle currently holds no proper FHIR Claim resource.
-- This migration:
--   1. Adds fhir_bundle JSONB column to sha_claims
--   2. Creates build_fhir_claim() function
--   3. Creates trigger to auto-build FHIR Claim when draft claim is inserted

-- 1. Add fhir_bundle column
ALTER TABLE public.sha_claims
  ADD COLUMN IF NOT EXISTS fhir_bundle JSONB DEFAULT NULL;

ALTER TABLE public.sha_claims
  ADD COLUMN IF NOT EXISTS fhir_built_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN public.sha_claims.fhir_bundle IS
  'FHIR R4 Claim resource built for this SHA claim. Submitted to DHA HIE in SHA-10.';

COMMENT ON COLUMN public.sha_claims.fhir_built_at IS
  'Timestamp when the FHIR Claim bundle was last built.';

-- 2. Build FHIR Claim function
CREATE OR REPLACE FUNCTION public.build_fhir_claim(p_claim_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_claim        RECORD;
  v_encounter    RECORD;
  v_patient      RECORD;
  v_settings     RECORD;
  v_items        JSONB;
  v_insurance    JSONB;
  v_related      JSONB;
  v_fhir_claim   JSONB;
BEGIN
  -- Fetch claim
  SELECT * INTO v_claim
  FROM public.sha_claims
  WHERE id = p_claim_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'sha_claim not found: %', p_claim_id;
  END IF;

  -- Fetch encounter
  SELECT
    e.id,
    e.encounter_type,
    e.created_at,
    e.sha_fund_type,
    e.insurance_policy_number,
    e.insurance_provider_id
  INTO v_encounter
  FROM public.encounters e
  WHERE e.id = v_claim.encounter_id;

  -- Fetch patient
  SELECT
    p.id,
    p.patient_name,
    p.sha_member_number,
    p.cr_number,
    p.national_id
  INTO v_patient
  FROM public.patients p
  WHERE p.id = v_claim.patient_id;

  -- Fetch facility settings
  SELECT
    facility_name,
    facility_kmhfl_code,
    facility_sha_id,
    facility_sha_provider_no
  INTO v_settings
  FROM public.app_settings
  WHERE id = 'global';

  -- Build claim items from sha_claim_items
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'sequence',   row_number() OVER (),
        'productOrService', jsonb_build_object(
          'coding', jsonb_build_array(
            jsonb_build_object(
              'system',  'https://sha.go.ke/services',
              'code',    sci.service_code,
              'display', sci.service_name
            )
          ),
          'text', sci.service_name
        ),
        'quantity', jsonb_build_object(
          'value', sci.quantity
        ),
        'unitPrice', jsonb_build_object(
          'value',    sci.unit_price,
          'currency', 'KES'
        ),
        'net', jsonb_build_object(
          'value',    sci.total_price,
          'currency', 'KES'
        )
      )
    ),
    '[]'::JSONB
  )
  INTO v_items
  FROM public.sha_claim_items sci
  WHERE sci.claim_id = p_claim_id;

  -- Build insurance array
  v_insurance := jsonb_build_array(
    jsonb_build_object(
      'sequence',  1,
      'focal',     true,
      'identifier', jsonb_build_object(
        'system', 'https://sha.go.ke/members',
        'value',  COALESCE(v_patient.sha_member_number, 'UNKNOWN')
      ),
      'coverage', jsonb_build_object(
        'display', COALESCE(v_claim.sha_fund_type, 'sha_shif')
      )
    )
  );

  -- Build related (preauth) if preauth_id exists
  v_related := CASE
    WHEN v_claim.preauth_id IS NOT NULL THEN
      jsonb_build_array(
        jsonb_build_object(
          'claim', jsonb_build_object(
            'identifier', jsonb_build_object(
              'system', 'https://sha.go.ke/preauth',
              'value',  v_claim.preauth_id
            )
          ),
          'relationship', jsonb_build_object(
            'coding', jsonb_build_array(
              jsonb_build_object(
                'system',  'http://terminology.hl7.org/CodeSystem/ex-relatedclaimrelationship',
                'code',    'prior',
                'display', 'Prior Claim'
              )
            )
          )
        )
      )
    ELSE NULL
  END;

  -- Assemble FHIR R4 Claim resource
  v_fhir_claim := jsonb_build_object(
    'resourceType', 'Claim',
    'id',           p_claim_id::TEXT,
    'meta', jsonb_build_object(
      'profile', jsonb_build_array(
        'http://hl7.org/fhir/StructureDefinition/Claim'
      )
    ),
    'status',   'draft',
    'type', jsonb_build_object(
      'coding', jsonb_build_array(
        jsonb_build_object(
          'system',  'http://terminology.hl7.org/CodeSystem/claim-type',
          'code',    'professional',
          'display', 'Professional'
        )
      )
    ),
    'subType', jsonb_build_object(
      'coding', jsonb_build_array(
        jsonb_build_object(
          'system',  'https://sha.go.ke/claim-subtype',
          'code',    v_claim.claim_subtype,
          'display', CASE v_claim.claim_subtype
            WHEN 'ip' THEN 'Inpatient'
            ELSE 'Outpatient'
          END
        )
      )
    ),
    'use',       'claim',
    'patient', jsonb_build_object(
      'reference', 'Patient/' || v_claim.patient_id::TEXT,
      'display',   COALESCE(v_patient.patient_name, '')
    ),
    'created',   NOW(),
    'provider', jsonb_build_object(
      'identifier', jsonb_build_object(
        'system', 'https://hiskenya.org/facility',
        'value',  COALESCE(v_settings.facility_kmhfl_code, 'UNKNOWN')
      ),
      'display', COALESCE(v_settings.facility_name, 'AegisCare')
    ),
    'priority', jsonb_build_object(
      'coding', jsonb_build_array(
        jsonb_build_object(
          'code', 'normal'
        )
      )
    ),
    'insurance',  v_insurance,
    'item',       v_items,
    'related',    v_related,
    'identifier', jsonb_build_array(
      jsonb_build_object(
        'system', 'https://sha.go.ke/claims',
        'value',  p_claim_id::TEXT
      )
    )
  );

  RETURN v_fhir_claim;
END;
$$;

-- 3. Trigger to auto-build FHIR Claim when draft sha_claim inserted
CREATE OR REPLACE FUNCTION public.auto_build_fhir_claim()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    NEW.fhir_bundle   := public.build_fhir_claim(NEW.id);
    NEW.fhir_built_at := NOW();
  EXCEPTION WHEN OTHERS THEN
    -- Do not block claim insert if FHIR build fails
    RAISE WARNING 'auto_build_fhir_claim failed for claim %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_build_fhir_claim ON public.sha_claims;

CREATE TRIGGER trg_auto_build_fhir_claim
  BEFORE INSERT ON public.sha_claims
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_build_fhir_claim();

COMMENT ON FUNCTION public.build_fhir_claim(UUID) IS
  'Builds a FHIR R4 Claim resource for a given sha_claim. Called by trigger on insert and by claims-dispatcher on submission.';

COMMENT ON FUNCTION public.auto_build_fhir_claim() IS
  'Trigger function: auto-builds FHIR Claim resource on sha_claims INSERT.';
