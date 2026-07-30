// Supabase Edge Function: fhir-patient
// Returns a FHIR R4 Patient resource for a given patient_id.
// Used for DHA certification and future SHA claims integration.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { patient_id } = await req.json();
    if (!patient_id) {
      return new Response(JSON.stringify({ error: "patient_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Fetch patient
    const { data: patient, error: patientError } = await supabase
      .from("patients")
      .select(
        "id,file_number,first_name,middle_name,family_name,patient_name,date_of_birth,dob_known,estimated_age,sex,phone,email,address_line1,address_line2,city,county,postal_code,country,is_deceased,date_of_death",
      )
      .eq("id", patient_id)
      .maybeSingle();

    if (patientError) throw patientError;
    if (!patient) {
      return new Response(JSON.stringify({ error: "Patient not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch facility details
    const { data: settings } = await supabase
      .from("app_settings")
      .select("facility_name,facility_kmhfl_code")
      .eq("id", "global")
      .maybeSingle();

    // Map sex to FHIR gender
    const genderMap: Record<string, string> = {
      male: "male",
      female: "female",
      m: "male",
      f: "female",
    };
    const gender = genderMap[(patient.sex ?? "").toLowerCase()] ?? "unknown";

    // Build FHIR R4 Patient resource
    const fhirPatient = {
      resourceType: "Patient",
      id: patient.id,
      meta: {
        profile: ["http://hl7.org/fhir/StructureDefinition/Patient"],
      },
      identifier: [
        {
          use: "official",
          system: `https://hiskenya.org/facility/${settings?.facility_kmhfl_code ?? "unknown"}/patients`,
          value: patient.file_number ?? patient.id,
        },
      ],
      name: [
        {
          use: "official",
          text: patient.patient_name ?? "",
          family: patient.family_name ?? "",
          given: [patient.first_name ?? "", patient.middle_name ?? ""].filter(Boolean),
        },
      ],
      gender,
      ...(patient.dob_known && patient.date_of_birth ? { birthDate: patient.date_of_birth } : {}),
      telecom: [
        ...(patient.phone ? [{ system: "phone", value: patient.phone, use: "mobile" }] : []),
        ...(patient.email ? [{ system: "email", value: patient.email }] : []),
      ],
      address: [
        {
          use: "home",
          line: [patient.address_line1, patient.address_line2].filter(Boolean),
          city: patient.city ?? "",
          district: patient.county ?? "",
          postalCode: patient.postal_code ?? "",
          country: patient.country ?? "KE",
        },
      ],
      ...(patient.is_deceased
        ? {
            deceasedBoolean: true,
            ...(patient.date_of_death ? { deceasedDateTime: patient.date_of_death } : {}),
          }
        : { deceasedBoolean: false }),
      managingOrganization: {
        display: settings?.facility_name ?? "Aegiscare",
      },
    };

    return new Response(JSON.stringify(fhirPatient), {
      headers: { ...corsHeaders, "Content-Type": "application/fhir+json" },
    });
  } catch (err) {
    console.error("fhir-patient error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
