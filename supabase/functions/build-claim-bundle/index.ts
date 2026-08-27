// Supabase Edge Function: build-claim-bundle
// Builds a FHIR R4 Bundle (type=message) for SHA / AfyaLink claim submission.
// Bundle contains: MessageHeader, Organization, Patient, Coverage, Claim.
// This function uses the existing sha_claims.fhir_bundle Claim resource produced
// by public.build_fhir_claim(), wraps it into a submission Bundle, stores it back
// on sha_claims.fhir_bundle, and queues it in dha_outbound_queue.
//
// Live submission still depends on DHA/AfyaLink credentials.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://aegiscare-orcin.vercel.app",
  "https://aegiscarehms.lovable.app",
  "https://aegiscare.vercel.app",
  "http://localhost:5173",
  "http://localhost:3000",
];

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin") ?? "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin)
    ? origin
    : ALLOWED_ORIGINS[0];

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Credentials": "true",
    "Vary": "Origin",
  };
}

function jsonResponse(
  req: Request,
  body: Record<string, unknown>,
  status = 200,
  contentType = "application/json",
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...getCorsHeaders(req),
      "Content-Type": contentType,
    },
  });
}

function cleanId(value: unknown, fallback: string): string {
  const raw = String(value ?? fallback);
  return raw
    .trim()
    .replace(/[^A-Za-z0-9.-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64) || fallback;
}

function mapGender(sex: unknown): string {
  const value = String(sex ?? "").toLowerCase();
  if (value === "male" || value === "m") return "male";
  if (value === "female" || value === "f") return "female";
  return "unknown";
}

function buildOrganization(settings: Record<string, unknown>) {
  const facilityCode = String(settings.facility_kmhfl_code ?? "UNKNOWN");
  const organizationId = `org-${cleanId(facilityCode, "unknown")}`;

  return {
    resourceType: "Organization",
    id: organizationId,
    meta: {
      profile: ["http://hl7.org/fhir/StructureDefinition/Organization"],
    },
    identifier: [
      {
        system: "https://kmhfl.health.go.ke/facilities",
        value: facilityCode,
      },
      ...(settings.facility_sha_provider_no
        ? [
            {
              system: "https://sha.go.ke/provider-number",
              value: settings.facility_sha_provider_no,
            },
          ]
        : []),
      ...(settings.facility_sha_id
        ? [
            {
              system: "https://sha.go.ke/facilities",
              value: settings.facility_sha_id,
            },
          ]
        : []),
    ],
    active: true,
    name: settings.facility_name ?? "AegisCare Facility",
  };
}

function buildPatient(patient: Record<string, unknown>, facilityCode: string) {
  return {
    resourceType: "Patient",
    id: patient.id,
    meta: {
      profile: ["http://hl7.org/fhir/StructureDefinition/Patient"],
    },
    identifier: [
      {
        use: "official",
        system: `https://hiskenya.org/facility/${facilityCode}/patients`,
        value: patient.file_number ?? patient.id,
      },
      ...(patient.cr_number
        ? [
            {
              use: "secondary",
              system: "https://hiskenya.org/client-registry",
              value: patient.cr_number,
            },
          ]
        : []),
      ...(patient.sha_member_number
        ? [
            {
              use: "secondary",
              system: "https://sha.go.ke/members",
              value: patient.sha_member_number,
            },
          ]
        : []),
      ...(patient.national_id
        ? [
            {
              use: "usual",
              system: "https://hiskenya.org/national-id",
              value: patient.national_id,
            },
          ]
        : []),
    ],
    name: [
      {
        use: "official",
        text: patient.patient_name ?? "",
        family: patient.family_name ?? "",
        given: [patient.first_name, patient.middle_name].filter(Boolean),
      },
    ],
    gender: mapGender(patient.sex),
    ...(patient.date_of_birth ? { birthDate: patient.date_of_birth } : {}),
    telecom: [
      ...(patient.phone
        ? [{ system: "phone", value: patient.phone, use: "mobile" }]
        : []),
      ...(patient.email ? [{ system: "email", value: patient.email }] : []),
    ],
  };
}

function buildCoverage(
  claim: Record<string, unknown>,
  patient: Record<string, unknown>,
  organizationId: string,
) {
  const coverageId = `coverage-${claim.id}`;

  return {
    resourceType: "Coverage",
    id: coverageId,
    meta: {
      profile: ["http://hl7.org/fhir/StructureDefinition/Coverage"],
    },
    status: "active",
    type: {
      coding: [
        {
          system: "https://sha.go.ke/fund-type",
          code: claim.fund_type ?? "SHIF",
          display: claim.fund_type ?? "SHIF",
        },
      ],
      text: claim.fund_type ?? "SHIF",
    },
    beneficiary: {
      reference: `Patient/${patient.id}`,
      display: patient.patient_name ?? "",
    },
    payor: [
      {
        reference: `Organization/${organizationId}`,
      },
    ],
    identifier: [
      {
        system: "https://sha.go.ke/members",
        value:
          claim.sha_member_no_at_claim ??
          patient.sha_member_number ??
          "UNKNOWN",
      },
    ],
  };
}

function extractClaimResource(fhirBundle: unknown): Record<string, unknown> | null {
  if (!fhirBundle || typeof fhirBundle !== "object") return null;

  const resource = fhirBundle as Record<string, unknown>;

  if (resource.resourceType === "Claim") {
    return resource;
  }

  if (resource.resourceType === "Bundle" && Array.isArray(resource.entry)) {
    const claimEntry = resource.entry.find((entry) => {
      const e = entry as Record<string, unknown>;
      const r = e.resource as Record<string, unknown> | undefined;
      return r?.resourceType === "Claim";
    }) as Record<string, unknown> | undefined;

    return (claimEntry?.resource as Record<string, unknown>) ?? null;
  }

  return null;
}

function buildMessageHeader(
  mediatorId: string,
  claimId: string,
  organizationId: string,
) {
  return {
    resourceType: "MessageHeader",
    id: `message-header-${mediatorId}`,
    meta: {
      profile: ["http://hl7.org/fhir/StructureDefinition/MessageHeader"],
    },
    eventCoding: {
      system: "https://sha.go.ke/fhir/message-events",
      code: "claim-submit",
      display: "SHA Claim Submission",
    },
    source: {
      name: "AegisCare HMS",
      endpoint: "https://aegiscare-orcin.vercel.app",
    },
    destination: [
      {
        name: "DHA AfyaLink",
        endpoint: "https://afyalink.dha.go.ke",
        receiver: {
          display: "Digital Health Agency",
        },
      },
    ],
    focus: [
      {
        reference: `Claim/${claimId}`,
      },
    ],
    responsible: {
      reference: `Organization/${organizationId}`,
    },
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  if (req.method !== "POST") {
    return jsonResponse(req, { error: "Method not allowed" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse(req, { error: "Missing authorization header" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return jsonResponse(req, { error: "Unauthorized" }, 401);
    }

    const body = (await req.json()) as {
      claim_id?: string;
      queue?: boolean;
    };

    const claimId = body.claim_id;
    const shouldQueue = body.queue !== false;

    if (!claimId) {
      return jsonResponse(req, { error: "claim_id is required" }, 400);
    }

    const { data: claim, error: claimError } = await supabase
      .from("sha_claims")
      .select(
        "id,encounter_id,patient_id,status,claim_number,fund_type,claim_subtype,total_amount,sha_member_no_at_claim,cr_number_at_claim,fhir_bundle",
      )
      .eq("id", claimId)
      .maybeSingle();

    if (claimError) {
      return jsonResponse(
        req,
        { error: "Failed to load claim", detail: claimError.message },
        500,
      );
    }

    if (!claim) {
      return jsonResponse(req, { error: "Claim not found" }, 404);
    }

    let claimResource = extractClaimResource(claim.fhir_bundle);

    if (!claimResource) {
      const { data: rebuiltClaim, error: rebuildError } = await supabase.rpc(
        "build_fhir_claim",
        { p_claim_id: claimId },
      );

      if (rebuildError) {
        return jsonResponse(
          req,
          {
            error: "Failed to build base FHIR Claim",
            detail: rebuildError.message,
          },
          500,
        );
      }

      claimResource = extractClaimResource(rebuiltClaim);
    }

    if (!claimResource) {
      return jsonResponse(
        req,
        { error: "Unable to locate Claim resource after build_fhir_claim()" },
        500,
      );
    }

    const { data: patient, error: patientError } = await supabase
      .from("patients")
      .select(
        "id,file_number,first_name,middle_name,family_name,patient_name,date_of_birth,sex,phone,email,national_id,sha_member_number,cr_number",
      )
      .eq("id", claim.patient_id)
      .maybeSingle();

    if (patientError) {
      return jsonResponse(
        req,
        { error: "Failed to load patient", detail: patientError.message },
        500,
      );
    }

    if (!patient) {
      return jsonResponse(req, { error: "Patient not found" }, 404);
    }

    const { data: settings, error: settingsError } = await supabase
      .from("app_settings")
      .select(
        "facility_name,facility_kmhfl_code,facility_sha_id,facility_sha_provider_no",
      )
      .eq("id", "global")
      .maybeSingle();

    if (settingsError) {
      return jsonResponse(
        req,
        { error: "Failed to load app settings", detail: settingsError.message },
        500,
      );
    }

    const safeSettings = (settings ?? {}) as Record<string, unknown>;
    const facilityCode = String(
      safeSettings.facility_kmhfl_code ?? "UNKNOWN",
    );

    const organization = buildOrganization(safeSettings);
    const organizationId = String(organization.id);
    const patientResource = buildPatient(
      patient as Record<string, unknown>,
      facilityCode,
    );
    const coverage = buildCoverage(
      claim as Record<string, unknown>,
      patient as Record<string, unknown>,
      organizationId,
    );

    const mediatorId = crypto.randomUUID();

    // Ensure Claim references resources inside this message Bundle.
    claimResource = {
      ...claimResource,
      id: String(claim.id),
      patient: {
        reference: `Patient/${patient.id}`,
        display: patient.patient_name ?? "",
      },
      provider: {
        reference: `Organization/${organizationId}`,
        display: safeSettings.facility_name ?? "AegisCare Facility",
      },
      insurance: [
        {
          sequence: 1,
          focal: true,
          coverage: {
            reference: `Coverage/${coverage.id}`,
          },
          identifier: {
            system: "https://sha.go.ke/members",
            value:
              claim.sha_member_no_at_claim ??
              patient.sha_member_number ??
              "UNKNOWN",
          },
        },
      ],
    };

    const messageHeader = buildMessageHeader(
      mediatorId,
      String(claim.id),
      organizationId,
    );

    const bundle = {
      resourceType: "Bundle",
      id: mediatorId,
      meta: {
        profile: [
          "https://ig.eclaims.intellisoftkenya.com/StructureDefinition/ke-claim-bundle",
        ],
        lastUpdated: new Date().toISOString(),
      },
      identifier: {
        system: "https://aegiscare.co.ke/fhir/claim-bundles",
        value: mediatorId,
      },
      type: "message",
      timestamp: new Date().toISOString(),
      entry: [
        {
          fullUrl: `MessageHeader/${messageHeader.id}`,
          resource: messageHeader,
        },
        {
          fullUrl: `Organization/${organization.id}`,
          resource: organization,
        },
        {
          fullUrl: `Patient/${patientResource.id}`,
          resource: patientResource,
        },
        {
          fullUrl: `Coverage/${coverage.id}`,
          resource: coverage,
        },
        {
          fullUrl: `Claim/${claimResource.id}`,
          resource: claimResource,
        },
      ],
    };

    const { error: updateError } = await supabase
      .from("sha_claims")
      .update({
        fhir_bundle: bundle,
        fhir_built_at: new Date().toISOString(),
        last_status_check: new Date().toISOString(),
      })
      .eq("id", claimId);

    if (updateError) {
      return jsonResponse(
        req,
        { error: "Failed to update sha_claims.fhir_bundle", detail: updateError.message },
        500,
      );
    }

    let queueId: string | null = null;

    if (shouldQueue) {
      const { data: queued, error: queueError } = await supabase
        .from("dha_outbound_queue")
        .insert({
          encounter_id: claim.encounter_id,
          patient_id: patient.id,
          queue_type: "sha_claim_bundle",
          insurer_type: claim.fund_type ?? "SHIF",
          payload: bundle,
          status: "pending",
          attempts: 0,
        })
        .select("id")
        .single();

      if (queueError) {
        return jsonResponse(
          req,
          {
            error: "Bundle built but failed to queue",
            detail: queueError.message,
            bundle,
          },
          500,
        );
      }

      queueId = queued?.id ?? null;
    }

    return jsonResponse(
      req,
      {
        success: true,
        claim_id: claimId,
        mediator_id: mediatorId,
        queue_id: queueId,
        resource_count: bundle.entry.length,
        resources: bundle.entry.map((entry) => entry.resource.resourceType),
        bundle,
        note:
          "STUB MODE — SHA Claim message Bundle built and queued locally. Live DHA/AfyaLink submission activates after credentials are configured.",
      },
      200,
      "application/fhir+json",
    );
  } catch (err) {
    console.error("build-claim-bundle error:", err);
    return jsonResponse(
      req,
      {
        error: err instanceof Error ? err.message : "Unknown error",
      },
      500,
    );
  }
});