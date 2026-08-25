-- Fix build_fhir_claim(): use the real sha_claim_items columns.
-- Previously the function referenced sci.service_code / sci.service_name /
-- sci.total_price, which do not exist, so FHIR claim items were empty.
-- Also restricts item aggregation to is_included = true and normalises the
-- fund_type display to the SHA nomenclature used on sha_claims.

CREATE OR REPLACE FUNCTION public.build_fhir_claim(p_claim_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
  SELECT * INTO v_claim
  FROM public.sha_claims
  WHERE id = p_claim_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'sha_claim not found: %', p_claim_id;
  END IF;

  SELECT
    e.id, e.encounter_type, e.created_at,
    e.sha_fund_type, e.insurance_policy_number,
    e.insurance_provider_id
  INTO v_encounter
  FROM public.encounters e
  WHERE e.id = v_claim.encounter_id;

  SELECT
    p.id, p.patient_name, p.sha_member_number,
    p.cr_number, p.national_id
  INTO v_patient
  FROM public.patients p
  WHERE p.id = v_claim.patient_id;

  SELECT
    facility_name, facility_kmhfl_code,
    facility_sha_id, facility_sha_provider_no
  INTO v_settings
  FROM public.app_settings
  WHERE id = 'global';

  -- Fixed: use actual column names from sha_claim_items
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'sequence', row_number() OVER (),
        'productOrService', jsonb_build_object(
          'coding', jsonb_build_array(
            jsonb_build_object(
              'system',  'https://sha.go.ke/services',
              'code',    COALESCE(sci.intervention_code, sci.item_type),
              'display', sci.description
            )
          ),
          'text', sci.description
        ),
        'quantity', jsonb_build_object(
          'value', sci.quantity
        ),
        'unitPrice', jsonb_build_object(
          'value',    sci.unit_price,
          'currency', 'KES'
        ),
        'net', jsonb_build_object(
          'value',    sci.amount,
          'currency', 'KES'
        )
      )
    ),
    '[]'::JSONB
  )
  INTO v_items
  FROM public.sha_claim_items sci
  WHERE sci.claim_id = p_claim_id
    AND sci.is_included = true;

  v_insurance := jsonb_build_array(
    jsonb_build_object(
      'sequence',  1,
      'focal',     true,
      'identifier', jsonb_build_object(
        'system', 'https://sha.go.ke/members',
        'value',  COALESCE(v_patient.sha_member_number, 'UNKNOWN')
      ),
      'coverage', jsonb_build_object(
        'display', COALESCE(v_claim.fund_type, 'SHIF')
      )
    )
  );

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
        jsonb_build_object('code', 'normal')
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
