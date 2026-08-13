// Supabase Edge Function: fhir-encounter
// Returns a FHIR R4 Encounter resource for a given encounter_id.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
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
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Credentials": "true",
    "Vary": "Origin",
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    const { encounter_id } = await req.json();
    if (!encounter_id) {
      return new Response(JSON.stringify({ error: "encounter_id is required" }), {
        status: 400,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Fetch encounter
    const { data: encounter, error: encError } = await supabase
      .from("encounters")
      .select(
        "id,patient_id,encounter_type,is_emergency,status,created_at,updated_at,payment_mode,insurance_policy_number,insurance_provider_id,referral_direction,referral_out_facility",
      )
      .eq("id", encounter_id)
      .maybeSingle();

    if (encError) throw encError;
    if (!encounter) {
      return new Response(JSON.stringify({ error: "Encounter not found" }), {
        status: 404,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Fetch diagnoses
    const { data: diagnoses } = await supabase
      .from("encounter_diagnoses")
      .select("id,icd11_code,icd11_title,icd11_uri,diagnosis_type,sequence")
      .eq("encounter_id", encounter_id)
      .order("sequence", { ascending: true });

    // Fetch facility
    const { data: settings } = await supabase
      .from("app_settings")
      .select("facility_name,facility_kmhfl_code,facility_sha_id")
      .eq("id", "global")
      .maybeSingle();

    // Map encounter_type to FHIR class code
    const classMap: Record<string, { code: string; display: string }> = {
      outpatient: { code: "AMB", display: "ambulatory" },
      inpatient: { code: "IMP", display: "inpatient encounter" },
      emergency: { code: "EMER", display: "emergency" },
    };
    const encClass = classMap[encounter.encounter_type ?? "outpatient"] ?? {
      code: "AMB",
      display: "ambulatory",
    };

    // Map status to FHIR encounter status
    const statusMap: Record<string, string> = {
      waiting: "arrived",
      in_progress: "in-progress",
      done: "finished",
      cancelled: "cancelled",
    };
    const fhirStatus = statusMap[encounter.status ?? "done"] ?? "unknown";

    // Build FHIR R4 Encounter resource
    const fhirEncounter = {
      resourceType: "Encounter",
      id: encounter.id,
      meta: {
        profile: ["http://hl7.org/fhir/StructureDefinition/Encounter"],
      },
      status: fhirStatus,
      class: {
        system: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
        code: encClass.code,
        display: encClass.display,
      },
      priority: encounter.is_emergency
        ? {
            coding: [
              {
                system: "http://terminology.hl7.org/CodeSystem/v3-ActPriority",
                code: "EM",
                display: "emergency",
              },
            ],
          }
        : undefined,
      subject: {
        reference: `Patient/${encounter.patient_id}`,
      },
      period: {
        start: encounter.created_at,
        ...(encounter.status === "done" ? { end: encounter.updated_at } : {}),
      },
      diagnosis: (diagnoses ?? []).map((d) => ({
        condition: { reference: `Condition/${d.id}` },
        use: {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/diagnosis-role",
              code: "AD",
              display: "Admission diagnosis",
            },
          ],
        },
        rank: d.sequence ?? 1,
      })),
      serviceProvider: {
        identifier: {
          system: "https://hiskenya.org/facility",
          value: settings?.facility_kmhfl_code ?? "unknown",
        },
        display: settings?.facility_name ?? "Aegiscare",
      },
      ...(encounter.referral_direction === "out"
        ? {
            hospitalization: {
              dischargeDisposition: {
                coding: [
                  {
                    system: "http://terminology.hl7.org/CodeSystem/discharge-disposition",
                    code: "other-hcf",
                    display: encounter.referral_out_facility ?? "Other facility",
                  },
                ],
              },
            },
          }
        : {}),
    };

    return new Response(JSON.stringify(fhirEncounter), {
      headers: { ...getCorsHeaders(req), "Content-Type": "application/fhir+json" },
    });
  } catch (err) {
    console.error("fhir-encounter error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
    );
  }
});
