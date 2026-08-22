import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type FacilityLevel = "1" | "2" | "3A" | "3B" | "4" | "5" | "6" | null;

function toNumeric(level: FacilityLevel): number {
  if (!level) return 99; // null = not configured = testing mode = all enabled
  if (level === "3A") return 3.1;
  if (level === "3B") return 3.5;
  return parseInt(level) || 0;
}

export function useFacilityLevel() {
  const { data: level, isLoading } = useQuery({
    queryKey: ["facility-level"],
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("facility_level")
        .eq("id", "global")
        .maybeSingle();
      // Normalize empty string to null
      const raw = data?.facility_level?.trim() || null;
      return raw as FacilityLevel;
    },
    staleTime: 5 * 60 * 1000,
  });

  // While loading treat as null (all enabled) to avoid flash of hidden content
  const resolvedLevel = isLoading ? null : (level ?? null);
  const numeric = toNumeric(resolvedLevel);

  return {
    level: resolvedLevel,
    numeric,
    // 3A+ = has some inpatient (maternity/observation)
    hasInpatient: numeric >= 3.1,
    // Mortuary from Level 4
    hasMortuary: numeric >= 4,
    // ICU from Level 4
    hasICU: numeric >= 4,
    // Theatre from Level 4
    hasTheatre: numeric >= 4,
    // Maternity ward from Level 3A
    hasMaternity: numeric >= 3.1,
    hasDialysis: numeric >= 4,
    isLoading,
  };
}
