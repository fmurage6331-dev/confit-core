CREATE OR REPLACE FUNCTION public.build_fhir_claim(p_claim_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_claim        RECORD;
  v_encounter    RECORD;
  v_patient      RECORD;
  v_settings     RECORD;
  v_clinician    RECORD;
  v_items        JSONB;
  v_insurance    JSONB;
  v_related      JSONB;
  v_care_team    JSONB;
  v_fhir_claim   JSONB;
  v_service_start TEXT;
  v_service_end   TEXT;
BEGIN
  -- ── Load claim ────────────────────────────────────────────────
  SELECT * INTO v_claim
  FROM public.sha_claims
  WHERE id = p_claim_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'sha_claim not found: %', p_claim_id;
  END IF;

  -- ── Load encounter (with updated_at + created_by for periods) ─
  SELECT
    e.id,
    e.encounter_type,
    e.created_at,
    e.updated_at,
    e.created_by,
    e.sha_fund_type,
    e.insurance_policy_number,
    e.insurance_provider_id
  INTO v_encounter
  FROM public.encounters e
  WHERE e.id = v_claim.encounter_id;

  -- ── Service period from encounter dates ───────────────────────
  v_service_start := to_char(v_encounter.created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
  v_service_end   := to_char(
    COALESCE(v_encounter.updated_at, v_encounter.created_at),
    'YYYY-MM-DD"T"HH24:MI:SS"Z"'
  );

  -- ── Load patient ──────────────────────────────────────────────
  SELECT
    p.id,
    p.patient_name,
    p.sha_member_number,
    p.cr_number,
    p.national_id
  INTO v_patient
  FROM public.patients p
  WHERE p.id = v_claim.patient_id;

  -- ── Load facility settings ────────────────────────────────────
  SELECT
    facility_name,
    facility_kmhfl_code,
    facility_sha_id,
    facility_sha_provider_no
  INTO v_settings
  FROM public.app_settings
  WHERE id = 'global';

  -- ── Load attending clinician from profiles ────────────────────
  IF v_encounter.created_by IS NOT NULL THEN
    SELECT
      p.id,
      COALESCE(p.council_full_name, p.first_name || ' ' || p.last_name, p.full_name) AS display_name,
      p.council_registration_number,
      p.council_type
    INTO v_clinician
    FROM public.profiles p
    WHERE p.id = v_encounter.created_by;
  END IF;

  -- ── CareTeam ──────────────────────────────────────────────────
  IF v_clinician IS NOT NULL AND v_clinician.id IS NOT NULL THEN
    v_care_team := jsonb_build_array(
      jsonb_build_object(
        'sequence', 1,
        'provider', jsonb_build_object(
          'reference', 'Practitioner/' || v_encounter.created_by::TEXT,
          'display',   COALESCE(v_clinician.display_name, 'Unknown Clinician'),
          'identifier', jsonb_build_object(
            'system', 'https://hiskenya.org/hwr',
            'value',  COALESCE(v_clinician.council_registration_number, 'PENDING')
          )
        ),
        'role', jsonb_build_object(
          'coding', jsonb_build_array(
            jsonb_build_object(
              'system',  'http://terminology.hl7.org/CodeSystem/claimcareteamrole',
              'code',    'primary',
              'display', 'Primary Care Team'
            )
          )
        ),
        'qualification', jsonb_build_object(
          'coding', jsonb_build_array(
            jsonb_build_object(
              'system',  'https://hiskenya.org/council',
              'code',    COALESCE(v_clinician.council_type, 'OTHER'),
              'display', COALESCE(v_clinician.council_type, 'Health Worker')
            )
          )
        )
      )
    );
  ELSE
    v_care_team := jsonb_build_array(
      jsonb_build_object(
        'sequence', 1,
        'provider', jsonb_build_object(
          'display', 'Attending Clinician — HWR pending',
          'identifier', jsonb_build_object(
            'system', 'https://hiskenya.org/hwr',
            'value',  'PENDING'
          )
        ),
        'role', jsonb_build_object(
          'coding', jsonb_build_array(
            jsonb_build_object(
              'system',  'http://terminology.hl7.org/CodeSystem/claimcareteamrole',
              'code',    'primary',
              'display', 'Primary Care Team'
            )
          )
        )
      )
    );
  END IF;

  -- ── Claim items with servicedPeriod ───────────────────────────
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'sequence', row_number() OVER (),
        'careTeamSequence', jsonb_build_array(1),
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
        'servicedPeriod', jsonb_build_object(
          'start', v_service_start,
          'end',   v_service_end
        ),
        'quantity', jsonb_build_object(
          'value', sci.quantity
        ),
        'unitPrice', jsonb_build_object(
          'value',    CASE WHEN v_claim.fund_type = 'PHF' THEN 0 ELSE sci.unit_price END,
          'currency', 'KES'
        ),
        'net', jsonb_build_object(
          'value',    CASE WHEN v_claim.fund_type = 'PHF' THEN 0 ELSE sci.amount END,
          'currency', 'KES'
        )
      )
    ),
    '[]'::JSONB
  )
  INTO v_items
  FROM public.sha_claim_items sci
  WHERE sci.claim_id  = p_claim_id
    AND sci.is_included = true;

  -- ── Insurance ─────────────────────────────────────────────────
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

  -- ── Related (preauth) ─────────────────────────────────────────
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

  -- ── Assemble FHIR Claim ───────────────────────────────────────
  v_fhir_claim := jsonb_build_object(
    'resourceType', 'Claim',
    'id',           p_claim_id::TEXT,

    -- ✅ GAP 4: Kenya eClaims IG profile (not generic HL7)
    'meta', jsonb_build_object(
      'profile', jsonb_build_array(
        'https://ig.eclaims.intellisoftkenya.com/StructureDefinition/ke-claim'
      )
    ),

    'identifier', jsonb_build_array(
      jsonb_build_object(
        'system', 'https://sha.go.ke/claims',
        'value',  p_claim_id::TEXT
      )
    ),

    -- ✅ active for submission (not draft)
    'status', 'active',

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

    'use',     'claim',

    'patient', jsonb_build_object(
      'reference', 'Patient/' || v_claim.patient_id::TEXT,
      'display',   COALESCE(v_patient.patient_name, '')
    ),

    'created',  to_char(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),

    -- ✅ GAP 6: billablePeriod from encounter dates
    'billablePeriod', jsonb_build_object(
      'start', v_service_start,
      'end',   v_service_end
    ),

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

    -- ✅ GAP 6: careTeam with HWR practitioner
    'careTeam',  v_care_team,

    'insurance', v_insurance,

    -- ✅ GAP 7: PHF items zeroed at FHIR level
    'item',      v_items,

    'related',   v_related,

    -- ✅ total amount (zero for PHF)
    'total', jsonb_build_object(
      'value',    CASE WHEN v_claim.fund_type = 'PHF'
                       THEN 0
                       ELSE COALESCE(v_claim.total_amount, 0)
                  END,
      'currency', 'KES'
    )
  );

  RETURN v_fhir_claim;
END;
$function$;

-- ── Verify function replaced ──────────────────────────────────────
SELECT
  proname,
  'updated' AS status
FROM pg_proc
WHERE proname = 'build_fhir_claim'
  AND pronamespace = 'public'::regnamespace;
  -- Rebuild fhir_bundle for all existing claims
UPDATE public.sha_claims
SET fhir_bundle = public.build_fhir_claim(id)
WHERE id IN (
  SELECT id FROM public.sha_claims
  WHERE status NOT IN ('paid', 'payment_completed')
);

SELECT
  COUNT(*) AS claims_rebuilt
FROM public.sha_claims
WHERE fhir_bundle IS NOT NULL;