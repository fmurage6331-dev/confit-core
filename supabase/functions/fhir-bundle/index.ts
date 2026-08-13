// Supabase Edge Function: fhir-bundle
// Builds a FHIR R4 Bundle (type=collection) for DHA SHR submission.
// Bundle contains: Patient, Encounter, EpisodeOfCare, Condition[], MedicationDispense[]
// The bundle id is used as the mediator_id in the DHA HIE outbound queue.
// Currently STUB — builds and queues bundle locally.
// Real SHR submission activated in SHA-10 after DHA credentials obtained.

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

// ─── Helpers ────────────────────────────────────────────────────────────────

function mapGender(sex: string | null): string {
  const m: Record<string, string> = { male: "male", female: "female", m: "male", f: "female" };
  return m[(sex ?? "").toLowerCase()] ?? "unknown";
}

function mapEncounterStatus(status: string | null): string {
  const m: Record<string, string> = {
    waiting: "arrived",
    in_progress: "in-progress",
    done: "finished",
    signed: "finished",
    cancelled: "cancelled",
  };
  return m[status ?? "done"] ?? "unknown";
}

function mapEncounterClass(type: string | null): { code: string; display: string } {
  const m: Record<string, { code: string; display: string }> = {
    outpatient: { code: "AMB", display: "ambulatory" },
    inpatient:  { code: "IMP", display: "inpatient encounter" },
    emergency:  { code: "EMER", display: "emergency" },
  };
  return m[type ?? "outpatient"] ?? { code: "AMB", display: "ambulatory" };
}

function mapVerificationStatus(diagType: string | null): string {
  const m: Record<string, string> = {
    final: "confirmed", working: "provisional",
    differential: "differential", admission: "confirmed",
    discharge: "confirmed", primary: "confirmed", secondary: "confirmed",
  };
  return m[diagType ?? "final"] ?? "confirmed";
}

// ─── Resource Builders ───────────────────────────────────────────────────────

function buildPatient(
  patient: Record<string, unknown>,
  facilityCode: string,
  facilityName: string,
): Record<string, unknown> {
  return {
    resourceType: "Patient",
    id: patient.id,
    meta: { profile: ["http://hl7.org/fhir/StructureDefinition/Patient"] },
    identifier: [
      {
        use: "official",
        system: `https://hiskenya.org/facility/${facilityCode}/patients`,
        value: patient.file_number ?? patient.id,
      },
      ...(patient.national_id ? [{
        use: "usual",
        system: "https://hiskenya.org/national-id",
        value: patient.national_id,
      }] : []),
      ...(patient.sha_member_number ? [{
        use: "secondary",
        system: "https://sha.go.ke/members",
        value: patient.sha_member_number,
      }] : []),
      ...(patient.cr_number ? [{
        use: "secondary",
        system: "https://hiskenya.org/client-registry",
        value: patient.cr_number,
      }] : []),
    ],
    name: [{
      use: "official",
      text: patient.patient_name ?? "",
      family: patient.family_name ?? "",
      given: [patient.first_name ?? "", patient.middle_name ?? ""].filter(Boolean),
    }],
    gender: mapGender(patient.sex as string),
    ...((patient.dob_known && patient.date_of_birth)
      ? { birthDate: patient.date_of_birth } : {}),
    telecom: [
      ...(patient.phone ? [{ system: "phone", value: patient.phone, use: "mobile" }] : []),
      ...(patient.email ? [{ system: "email", value: patient.email }] : []),
    ],
    address: [{
      use: "home",
      line: [patient.address_line1, patient.address_line2].filter(Boolean),
      city: patient.city ?? "",
      district: patient.county ?? "",
      postalCode: patient.postal_code ?? "",
      country: patient.country ?? "KE",
    }],
    managingOrganization: { display: facilityName },
  };
}

function buildEpisodeOfCare(
  episode: Record<string, unknown>,
  patientId: string,
): Record<string, unknown> {
  return {
    resourceType: "EpisodeOfCare",
    id: episode.id,
    meta: { profile: ["http://hl7.org/fhir/StructureDefinition/EpisodeOfCare"] },
    status: episode.status,
    type: [{
      coding: [{
        system: "http://terminology.hl7.org/CodeSystem/episodeofcare-type",
        code: episode.episode_type,
      }],
    }],
    patient: { reference: `Patient/${patientId}` },
    period: {
      start: episode.period_start,
      ...(episode.period_end ? { end: episode.period_end } : {}),
    },
  };
}

function buildEncounter(
  encounter: Record<string, unknown>,
  diagnoses: Record<string, unknown>[],
  episodeId: string,
  settings: Record<string, unknown>,
): Record<string, unknown> {
  const encClass = mapEncounterClass(encounter.encounter_type as string);
  return {
    resourceType: "Encounter",
    id: encounter.id,
    meta: { profile: ["http://hl7.org/fhir/StructureDefinition/Encounter"] },
    status: mapEncounterStatus(encounter.status as string),
    class: {
      system: "http://terminology.hl7.org/CodeSystem/v3-ActCode",
      code: encClass.code,
      display: encClass.display,
    },
    ...(encounter.is_emergency ? {
      priority: {
        coding: [{
          system: "http://terminology.hl7.org/CodeSystem/v3-ActPriority",
          code: "EM",
          display: "emergency",
        }],
      },
    } : {}),
    subject: { reference: `Patient/${encounter.patient_id}` },
    episodeOfCare: [{ reference: `EpisodeOfCare/${episodeId}` }],
    period: {
      start: encounter.created_at,
      ...((encounter.status === "done" || encounter.status === "signed")
        ? { end: encounter.updated_at } : {}),
    },
    diagnosis: diagnoses.map((d) => ({
      condition: { reference: `Condition/${d.id}` },
      use: {
        coding: [{
          system: "http://terminology.hl7.org/CodeSystem/diagnosis-role",
          code: "AD",
          display: "Admission diagnosis",
        }],
      },
      rank: d.sequence ?? 1,
    })),
    serviceProvider: {
      identifier: {
        system: "https://hiskenya.org/facility",
        value: settings.facility_kmhfl_code ?? "unknown",
      },
      display: settings.facility_name ?? "AegisCare",
    },
  };
}

function buildCondition(
  d: Record<string, unknown>,
  patientId: string,
  encounterId: string,
  encCreatedAt: string,
): Record<string, unknown> {
  return {
    resourceType: "Condition",
    id: d.id,
    meta: { profile: ["http://hl7.org/fhir/StructureDefinition/Condition"] },
    verificationStatus: {
      coding: [{
        system: "http://terminology.hl7.org/CodeSystem/condition-ver-status",
        code: mapVerificationStatus(d.diagnosis_type as string),
        display: mapVerificationStatus(d.diagnosis_type as string),
      }],
    },
    code: {
      coding: [{
        system: d.icd11_uri ?? "http://id.who.int/icd/release/11/mms",
        code: d.icd11_code,
        display: d.icd11_title ?? "",
      }],
      text: d.icd11_title ?? d.icd11_code,
    },
    subject: { reference: `Patient/${patientId}` },
    encounter: { reference: `Encounter/${encounterId}` },
    recordedDate: d.created_at ?? encCreatedAt,
    ...(d.notes ? { note: [{ text: d.notes }] } : {}),
  };
}

function buildMedicationDispense(
  p: Record<string, unknown>,
  patientId: string,
  encounterId: string,
): Record<string, unknown> {
  return {
    resourceType: "MedicationDispense",
    id: p.id,
    meta: { profile: ["http://hl7.org/fhir/StructureDefinition/MedicationDispense"] },
    status: p.dispensed_at ? "completed" : "in-progress",
    medicationCodeableConcept: {
      coding: [
        ...(p.nlmis_code ? [{
          system: "https://khis.go.ke/nlmis",
          code: p.nlmis_code,
          display: p.medication_name ?? "",
        }] : []),
        {
          system: "https://aegiscare.co.ke/medications",
          code: p.medication_id ?? p.id,
          display: p.medication_name ?? "",
        },
      ],
      text: p.medication_name ?? "",
    },
    subject: { reference: `Patient/${patientId}` },
    context: { reference: `Encounter/${encounterId}` },
    quantity: {
      value: p.quantity ?? 0,
      unit: p.unit ?? "unit",
    },
    ...(p.dispensed_at ? { whenHandedOver: p.dispensed_at } : {}),
    ...(p.instructions ? {
      dosageInstruction: [{ text: p.instructions }],
    } : {}),
  };
}

// ─── Main Handler ────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    const { encounter_id } = await req.json();
    if (!encounter_id) {
      return new Response(
        JSON.stringify({ error: "encounter_id is required" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    // ── Fetch all data in parallel ──────────────────────────────────────────
    const [
      { data: encounter, error: encError },
      { data: episode },
      { data: diagnoses },
      { data: prescriptions },
      { data: settings },
    ] = await Promise.all([
      supabase.from("encounters")
        .select("id,patient_id,encounter_type,is_emergency,status,created_at,updated_at,sha_fund_type")
        .eq("id", encounter_id)
        .maybeSingle(),
      supabase.from("episode_of_care")
        .select("id,status,episode_type,period_start,period_end")
        .eq("encounter_id", encounter_id)
        .maybeSingle(),
      supabase.from("encounter_diagnoses")
        .select("id,icd11_code,icd11_title,icd11_uri,diagnosis_type,sequence,notes,created_at")
        .eq("encounter_id", encounter_id)
        .order("sequence", { ascending: true }),
      supabase.from("prescriptions")
        .select("id,medication_id,medication_name,quantity,unit,instructions,dispensed_at,nlmis_code")
        .eq("encounter_id", encounter_id),
      supabase.from("app_settings")
        .select("facility_name,facility_kmhfl_code,facility_sha_id,facility_sha_provider_no")
        .eq("id", "global")
        .maybeSingle(),
    ]);

    if (encError || !encounter) {
      return new Response(
        JSON.stringify({ error: "Encounter not found" }),
        { status: 404, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    // Fetch patient using patient_id from encounter
    const { data: patient } = await supabase
      .from("patients")
      .select("id,file_number,first_name,middle_name,family_name,patient_name,date_of_birth,dob_known,sex,phone,email,address_line1,address_line2,city,county,postal_code,country,national_id,sha_member_number,cr_number,is_deceased,date_of_death")
      .eq("id", encounter.patient_id)
      .maybeSingle();

    if (!patient) {
      return new Response(
        JSON.stringify({ error: "Patient not found" }),
        { status: 404, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    const facilityCode = (settings?.facility_kmhfl_code as string) ?? "unknown";
    const facilityName = (settings?.facility_name as string) ?? "AegisCare";
    const mediatorId   = crypto.randomUUID();

    // ── Build bundle entries ────────────────────────────────────────────────
    const entries: Record<string, unknown>[] = [];

    // 1. Patient
    entries.push({
      fullUrl: `Patient/${patient.id}`,
      resource: buildPatient(
        patient as Record<string, unknown>,
        facilityCode,
        facilityName,
      ),
    });

    // 2. EpisodeOfCare
    if (episode) {
      entries.push({
        fullUrl: `EpisodeOfCare/${episode.id}`,
        resource: buildEpisodeOfCare(
          episode as Record<string, unknown>,
          patient.id as string,
        ),
      });
    }

    // 3. Encounter
    entries.push({
      fullUrl: `Encounter/${encounter.id}`,
      resource: buildEncounter(
        encounter as Record<string, unknown>,
        (diagnoses ?? []) as Record<string, unknown>[],
        episode?.id as string ?? "",
        settings as Record<string, unknown> ?? {},
      ),
    });

    // 4. Conditions
    for (const d of diagnoses ?? []) {
      entries.push({
        fullUrl: `Condition/${d.id}`,
        resource: buildCondition(
          d as Record<string, unknown>,
          patient.id as string,
          encounter.id as string,
          encounter.created_at as string,
        ),
      });
    }

    // 5. MedicationDispenses (dispensed only)
    for (const p of (prescriptions ?? []).filter((x) => x.dispensed_at)) {
      entries.push({
        fullUrl: `MedicationDispense/${p.id}`,
        resource: buildMedicationDispense(
          p as Record<string, unknown>,
          patient.id as string,
          encounter.id as string,
        ),
      });
    }

    // ── Assemble FHIR Bundle ────────────────────────────────────────────────
    const bundle = {
      resourceType: "Bundle",
      id: mediatorId,
      meta: {
        profile: ["http://hl7.org/fhir/StructureDefinition/Bundle"],
        lastUpdated: new Date().toISOString(),
      },
      type: "collection",
      timestamp: new Date().toISOString(),
      entry: entries,
    };

    // ── Queue bundle to dha_outbound_queue ──────────────────────────────────
    const { data: queued, error: queueError } = await supabase
      .from("dha_outbound_queue")
      .insert({
        encounter_id,
        patient_id: patient.id,
        queue_type: "fhir_sync",
        insurer_type: null,
        payload: bundle,
        status: "pending",
        attempts: 0,
      })
      .select("id")
      .single();

    if (queueError) {
      console.error("fhir-bundle queue error:", queueError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        mediator_id: mediatorId,
        encounter_id,
        queue_id: queued?.id ?? null,
        resource_count: entries.length,
        resources: entries.map((e) => (e.resource as Record<string, unknown>).resourceType),
        bundle,
        note: "STUB MODE — Bundle built and queued locally. SHR submission activated in SHA-10 after DHA credentials obtained.",
      }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/fhir+json" } },
    );

  } catch (err) {
    console.error("fhir-bundle error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
    );
  }
});
