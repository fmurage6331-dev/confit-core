// Supabase Edge Function: icd11-search
// Proxies live search requests to WHO's ICD-11 API, keeping client secret server-side.
// Deploy this as a function named "icd11-search" in Lovable Cloud / Supabase Edge Functions.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TOKEN_URL = "https://icdaccessmanagement.who.int/connect/token";
const SEARCH_URL = "https://id.who.int/icd/entity/search";

// Simple in-memory token cache (per warm function instance).
// WHO tokens are typically valid for ~1 hour, so we avoid re-authenticating on every search.
let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(clientId: string, clientSecret: string): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now) {
    return cachedToken.value;
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    scope: "icdapi_access",
  });

  const resp = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`WHO token request failed: ${resp.status} ${errText}`);
  }

  const data = await resp.json();
  // expires_in is in seconds; refresh a bit early to be safe.
  cachedToken = {
    value: data.access_token,
    expiresAt: now + (data.expires_in - 60) * 1000,
  };
  return cachedToken.value;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();

    if (!query || typeof query !== "string" || query.trim().length < 2) {
      return new Response(
        JSON.stringify({
          error: "Query must be at least 2 characters",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const clientId = Deno.env.get("ICD_CLIENT_ID");
    const clientSecret = Deno.env.get("ICD_CLIENT_SECRET");

    if (!clientId || !clientSecret) {
      return new Response(
        JSON.stringify({
          error: "ICD API credentials not configured",
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const token = await getAccessToken(clientId, clientSecret);

    const searchUrl = new URL(SEARCH_URL);
    searchUrl.searchParams.set("q", query);
    searchUrl.searchParams.set("useFlexisearch", "true");
    searchUrl.searchParams.set("flatResults", "true");

    const searchResp = await fetch(searchUrl.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Accept-Language": "en",
        "API-Version": "v2",
      },
    });

    if (!searchResp.ok) {
      const errText = await searchResp.text();
      throw new Error(`WHO search request failed: ${searchResp.status} ${errText}`);
    }

    const searchData = await searchResp.json();

    // Normalize WHO's response into { code, title, uri } matching our icd11_codes table.
    const results = (searchData.destinationEntities || [])
      .map((entity: Record<string, unknown>) => ({
        code: (entity.theCode as string) || null,
        title: ((entity.title as string) || "").replace(/<[^>]*>/g, ""), // strip highlight markup
        uri: (entity.id as string) || null,
      }))
      .filter((r: { code: string | null }) => r.code); // only keep entities that actually have a code

    return new Response(JSON.stringify({ results }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (err) {
    console.error("icd11-search error:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Unknown error",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }
});
