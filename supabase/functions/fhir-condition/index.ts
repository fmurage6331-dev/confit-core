// Supabase Edge Function: fhir-condition
// Returns an array of FHIR R4 Condition resources for a given encounter_id.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Map diagnosis_type to FHIR verificationStatus
function verificationStatus(diagType: string | null) {
  const map: Record<string, string> = {
    final: "confirmed",
    working: "provisional",
    differential: "differential",
    admission: "confirmed",
    discharge: "confirmed",
    primary: "confirmed",
    secondary: "confirmed",
  };
  return map[diagType ?? "final"] ?? "confirmed";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { encounter_id } = await req.json();
    if (!encounter_id) {
      return new Response(JSON.stringify({ error: "encounter_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Fetch encounter for patient reference
    const { data: encounter, error: encError } = await supabase
      .from("encounters")
      .select("id,patient_id,created_at")
      .eq("id", encounter_id)
      .maybeSingle();

    if (encError) throw encError;
    if (!encounter) {
      return new Response(JSON.stringify({ error: "Encounter not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch diagnoses
    const { data: diagnoses, error: diagError } = await supabase
      .from("encounter_diagnoses")
      .select("id,icd11_code,icd11_title,icd11_uri,diagnosis_type,sequence,notes,created_at")
      .eq("encounter_id", encounter_id)
      .order("sequence", { ascending: true });

    if (diagError) throw diagError;

    if (!diagnoses || diagnoses.length === 0) {
      return new Response(JSON.stringify([]), {
        headers: { ...corsHeaders, "Content-Type": "application/fhir+json" },
      });
    }

    // Build FHIR R4 Condition resources
    const fhirConditions = diagnoses.map((d) => ({
      resourceType: "Condition",
      id: d.id,
      meta: {
        profile: ["http://hl7.org/fhir/StructureDefinition/Condition"],
      },
      verificationStatus: {
        coding: [
          {
            system: "http://terminology.hl7.org/CodeSystem/condition-ver-status",
            code: verificationStatus(d.diagnosis_type),
            display: verificationStatus(d.diagnosis_type),
          },
        ],
      },
      code: {
        coding: [
          {
            system: d.icd11_uri ?? "http://id.who.int/icd/release/11/mms",
            code: d.icd11_code,
            display: d.icd11_title ?? "",
          },
        ],
        text: d.icd11_title ?? d.icd11_code,
      },
      subject: {
        reference: `Patient/${encounter.patient_id}`,
      },
      encounter: {
        reference: `Encounter/${encounter_id}`,
      },
      recordedDate: d.created_at ?? encounter.created_at,
      ...(d.notes ? { note: [{ text: d.notes }] } : {}),
      extension: [
        {
          url: "http://aegiscare.co.ke/fhir/StructureDefinition/diagnosis-sequence",
          valueInteger: d.sequence ?? 1,
        },
      ],
    }));

    return new Response(JSON.stringify(fhirConditions), {
      headers: { ...corsHeaders, "Content-Type": "application/fhir+json" },
    });
  } catch (err) {
    console.error("fhir-condition error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
