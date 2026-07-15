/**
 * LabTrack — Laboratory Records
 * Copyright (c) 2026 Francis Muhoro. All rights reserved.
 * Author: Francis Muhoro
 */

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Branding { appName: string; logoUrl: string | null; }
interface Ctx extends Branding { loading: boolean; refresh: () => Promise<void>; }

const BrandingContext = createContext<Ctx | undefined>(undefined);

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [appName, setAppName] = useState("Aegiscare");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data } = await supabase.from("app_settings").select("app_name, logo_url").eq("id", "global").maybeSingle();
    if (data) {
      setAppName(data.app_name || "Aegiscare");
      setLogoUrl(data.logo_url || null);
    }
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (typeof document !== "undefined") document.title = appName;
  }, [appName]);

  return (
    <BrandingContext.Provider value={{ appName, logoUrl, loading, refresh }}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  const ctx = useContext(BrandingContext);
  if (!ctx) throw new Error("useBranding must be used inside BrandingProvider");
  return ctx;
}