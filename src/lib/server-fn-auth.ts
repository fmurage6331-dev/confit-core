/**
 * LabTrack — Laboratory Records
 * Copyright (c) 2026 Francis Muhoro. All rights reserved.
 * Author: Francis Muhoro
 */

// Injects the Supabase access token as Authorization: Bearer for
// same-origin server function (/_serverFn/) requests so middleware
// like requireSupabaseAuth can authenticate the caller.
import { supabase } from "@/integrations/supabase/client";

let installed = false;

export function installServerFnAuth() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const url =
        typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url && url.includes("/_serverFn/")) {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (token) {
          const headers = new Headers(
            init?.headers ?? (input instanceof Request ? input.headers : undefined),
          );
          if (!headers.has("authorization")) {
            headers.set("authorization", `Bearer ${token}`);
          }
          init = { ...(init ?? {}), headers };
        }
      }
    } catch {
      // fall through to original fetch
    }
    return originalFetch(input as RequestInfo, init);
  };
}
