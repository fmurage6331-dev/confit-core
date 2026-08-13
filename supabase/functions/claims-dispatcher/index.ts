// Supabase Edge Function: claims-dispatcher
// Routes claims to the correct handler based on insurer_type.
// Currently STUB — logs to dha_outbound_queue only.
// Real API calls added in Phase 3 after credentials obtained.

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

type QueueType = "fhir_sync" | "sha_claim" | "private_claim" | "cash_receipt";

type DispatchRequest = {
  encounter_id: string;
  patient_id: string;
  insurer_type?: "sha_shif" | "private" | "corporate" | "cash" | null;
  trigger: "encounter_closed" | "claim_submit" | "fhir_sync" | "manual";
};

type DispatchResult = {
  queue_type: QueueType;
  handler: string;
  status: "queued" | "skipped";
  queue_id: string | null;
  message: string;
};

async function ShaClaimsHandler(
  supabase: ReturnType<typeof createClient>,
  req: DispatchRequest,
  payload: Record<string, unknown>,
): Promise<DispatchResult> {
  // Find the draft sha_claim for this encounter
  const { data: claim } = await supabase
    .from("sha_claims")
    .select("id, fhir_bundle")
    .eq("encounter_id", req.encounter_id)
    .eq("status", "draft")
    .maybeSingle();

  // If claim exists but fhir_bundle not yet built — build it now
  if (claim && !claim.fhir_bundle) {
    const { data: built } = await supabase
      .rpc("build_fhir_claim", { p_claim_id: claim.id });
    if (built) {
      await supabase
        .from("sha_claims")
        .update({
          fhir_bundle:   built,
          fhir_built_at: new Date().toISOString(),
        })
        .eq("id", claim.id);
    }
  }

  // Queue to dha_outbound_queue with FHIR bundle as payload
  const { data, error } = await supabase
    .from("dha_outbound_queue")
    .insert({
      encounter_id: req.encounter_id,
      patient_id:   req.patient_id,
      queue_type:   "sha_claim",
      insurer_type: "sha_shif",
      payload:      claim?.fhir_bundle ?? payload,
      status:       "pending",
      attempts:     0,
    })
    .select("id")
    .single();
  if (error) throw new Error(`SHA queue insert failed: ${error.message}`);
  return {
    queue_type: "sha_claim",
    handler:    "ShaClaimsHandler",
    status:     "queued",
    queue_id:   data.id,
    message:    "SHA FHIR Claim queued. Pending API credentials — Phase 3.",
  };
}

async function PrivateClaimsHandler(
  supabase: ReturnType<typeof createClient>,
  req: DispatchRequest,
  payload: Record<string, unknown>,
): Promise<DispatchResult> {
  const { data, error } = await supabase
    .from("dha_outbound_queue")
    .insert({
      encounter_id: req.encounter_id,
      patient_id: req.patient_id,
      queue_type: "private_claim",
      insurer_type: req.insurer_type,
      payload,
      status: "pending",
      attempts: 0,
    })
    .select("id")
    .single();
  if (error) throw new Error(`Private claim queue insert failed: ${error.message}`);
  return {
    queue_type: "private_claim",
    handler: "PrivateClaimsHandler",
    status: "queued",
    queue_id: data.id,
    message: "Private insurance claim queued. Pending insurer API — Phase 3.",
  };
}

async function CashReceiptHandler(
  supabase: ReturnType<typeof createClient>,
  req: DispatchRequest,
  payload: Record<string, unknown>,
): Promise<DispatchResult> {
  const { data, error } = await supabase
    .from("dha_outbound_queue")
    .insert({
      encounter_id: req.encounter_id,
      patient_id: req.patient_id,
      queue_type: "cash_receipt",
      insurer_type: null,
      payload,
      status: "skipped",
      attempts: 0,
      error_message: "Cash receipts handled internally — M-Pesa integration pending.",
    })
    .select("id")
    .single();
  if (error) throw new Error(`Cash receipt queue insert failed: ${error.message}`);
  return {
    queue_type: "cash_receipt",
    handler: "CashReceiptHandler",
    status: "skipped",
    queue_id: data.id,
    message: "Cash payment recorded internally. M-Pesa integration in Phase 3.",
  };
}

async function FhirSyncHandler(
  supabase: ReturnType<typeof createClient>,
  req: DispatchRequest,
  payload: Record<string, unknown>,
): Promise<DispatchResult> {
  const { data: consent } = await supabase
    .from("patient_consents")
    .select("hie_data_sharing_consented")
    .eq("patient_id", req.patient_id)
    .eq("consent_type", "hie_data_sharing")
    .eq("consented", true)
    .maybeSingle();

  if (!consent?.hie_data_sharing_consented) {
    const { data } = await supabase
      .from("dha_outbound_queue")
      .insert({
        encounter_id: req.encounter_id,
        patient_id: req.patient_id,
        queue_type: "fhir_sync",
        insurer_type: null,
        payload,
        status: "skipped",
        attempts: 0,
        error_message: "Patient has not consented to HIE data sharing. Skipped.",
      })
      .select("id")
      .single();
    return {
      queue_type: "fhir_sync",
      handler: "FhirSyncHandler",
      status: "skipped",
      queue_id: data?.id ?? null,
      message: "Skipped — patient HIE data sharing consent not recorded.",
    };
  }

  const { data, error } = await supabase
    .from("dha_outbound_queue")
    .insert({
      encounter_id: req.encounter_id,
      patient_id: req.patient_id,
      queue_type: "fhir_sync",
      insurer_type: null,
      payload,
      status: "pending",
      attempts: 0,
    })
    .select("id")
    .single();
  if (error) throw new Error(`FHIR sync queue insert failed: ${error.message}`);
  return {
    queue_type: "fhir_sync",
    handler: "FhirSyncHandler",
    status: "queued",
    queue_id: data.id,
    message: "FHIR sync queued. Pending DHA AfyaLink credentials — Phase 3.",
  };
}

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

    const body = (await req.json()) as DispatchRequest;
    const { encounter_id, patient_id, insurer_type, trigger } = body;

    if (!encounter_id || !patient_id) {
      return new Response(
        JSON.stringify({ error: "encounter_id and patient_id are required" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
      );
    }

    const payload = {
      encounter_id,
      patient_id,
      insurer_type,
      trigger,
      dispatched_at: new Date().toISOString(),
      dispatched_by: user.id,
    };

    const results: DispatchResult[] = [];

    results.push(await FhirSyncHandler(supabase, body, payload));

    if (insurer_type === "sha_shif") {
      results.push(await ShaClaimsHandler(supabase, body, payload));
    } else if (insurer_type === "private" || insurer_type === "corporate") {
      results.push(await PrivateClaimsHandler(supabase, body, payload));
    } else {
      results.push(await CashReceiptHandler(supabase, body, payload));
    }

    return new Response(
      JSON.stringify({
        success: true,
        encounter_id,
        results,
        note: "STUB MODE — All submissions queued locally. External API calls activated in Phase 3.",
      }),
      { headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("claims-dispatcher error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } },
    );
  }
});
