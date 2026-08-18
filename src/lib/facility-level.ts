import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type FacilityLevel = "1" | "2" | "3A" | "3B" | "4" | "5" | "6" | null;

export function useFacilityLevel() {
  const { data: level } = useQuery({
    queryKey: ["facility-level"],
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("facility_level")
        .eq("id", "global")
        .maybeSingle();
      return (data?.facility_level ?? null) as FacilityLevel;
    },
    staleTime: 5 * 60 * 1000,
  });

  const numeric = level ? parseInt(level.replace(/[^0-9]/g, "")) || 0 : 99;

  const hasFeature = (minLevel: number) => numeric >= minLevel || level === null;

  return {
    level,
    numeric,
    hasInpatient: hasFeature(3),
    hasMortuary: hasFeature(4),
    hasICU: hasFeature(4),
    hasTheatre: hasFeature(4),
    hasMaternity: hasFeature(3),
    isLoading: level === undefined,
  };
}
