/**
 * AegisCare — Reusable print header
 * Shows facility logo, name, address, phone, county, level on all printed documents.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

type FacilitySettings = {
  app_name: string | null;
  logo_url: string | null;
  facility_name: string | null;
  facility_address: string | null;
  facility_phone: string | null;
  facility_email: string | null;
  facility_county: string | null;
  facility_level: string | null;
  facility_kmhfl_code: string | null;
};

export function useFacilitySettings() {
  const [settings, setSettings] = useState<FacilitySettings | null>(null);
  useEffect(() => {
    supabase
      .from("app_settings")
      .select(
        "app_name,logo_url,facility_name,facility_address,facility_phone,facility_email,facility_county,facility_level,facility_kmhfl_code",
      )
      .eq("id", "global")
      .maybeSingle()
      .then(({ data }) => {
        if (data) setSettings(data as FacilitySettings);
      });
  }, []);
  return settings;
}

export function PrintHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  const s = useFacilitySettings();
  return (
    <div className="border-b-2 border-black pb-3 mb-4">
      <div className="flex items-start justify-between gap-4">
        {/* Left — logo + facility info */}
        <div className="flex items-center gap-3">
          {s?.logo_url && (
            <img
              src={s.logo_url}
              alt="facility logo"
              className="h-14 w-auto object-contain"
            />
          )}
          <div>
            <div className="text-xl font-bold">
              {s?.facility_name ?? s?.app_name ?? "AegisCare"}
            </div>
            {s?.facility_address && (
              <div className="text-xs text-gray-500">{s.facility_address}</div>
            )}
            {(s?.facility_phone || s?.facility_email) && (
              <div className="text-xs text-gray-500">
                {[s.facility_phone, s.facility_email].filter(Boolean).join(" · ")}
              </div>
            )}
            {(s?.facility_county || s?.facility_level || s?.facility_kmhfl_code) && (
              <div className="text-xs text-gray-500">
                {[
                  s.facility_county,
                  s.facility_level ? `Level ${s.facility_level}` : null,
                  s.facility_kmhfl_code ? `KMHFL: ${s.facility_kmhfl_code}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            )}
          </div>
        </div>
        {/* Right — document type + timestamp */}
        <div className="text-right">
          <div className="text-lg font-semibold">{title}</div>
          {subtitle && (
            <div className="text-xs text-gray-500">{subtitle}</div>
          )}
          <div className="text-xs text-gray-400 mt-1">
            Printed: {format(new Date(), "dd MMM yyyy, HH:mm")}
          </div>
        </div>
      </div>
    </div>
  );
}