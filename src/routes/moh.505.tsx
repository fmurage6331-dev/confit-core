/**
 * LabTrack — MOH 505 IDSR Weekly Report
 *
 * Reads from moh_weekly_aggregates (weekly cadence), refreshed via
 * refresh_moh_weekly_aggregates(target_week_start). See project notes:
 * this table/function must exist in the backend for this page to return
 * data — it is not yet present in supabase/migrations as of this change.
 */

import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { MohReportShell } from "@/components/moh/moh-report-shell";
import { MohIndicatorTable } from "@/components/moh/moh-indicator-table";
import { MohWeekPicker, getWeekStart } from "@/components/moh/moh-week-picker";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/lib/supabase-untyped";
import { useMemo, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/moh/505")({
  component: () => (
    <AppShell>
      <Moh505 />
    </AppShell>
  ),
});

type WeeklyAggregateRow = {
  indicator_code: string;
  period_week_start: string;
  value: number | string;
  computed_at?: string | null;
};

const IDSR_LABELS: Record<string, string> = {
  IDSR_MEASLES: "Measles (suspected)",
  IDSR_CHOLERA: "Acute Watery Diarrhoea / Cholera",
  IDSR_AFP: "Acute Flaccid Paralysis",
  IDSR_NEONATAL_TETANUS: "Neonatal Tetanus",
  IDSR_BLOODY_DIARRHOEA: "Bloody Diarrhoea (Dysentery)",
  IDSR_MENINGITIS: "Meningitis (suspected)",
  IDSR_VHF: "Viral Haemorrhagic Fever (suspected)",
  IDSR_PLAGUE: "Plague (suspected)",
  IDSR_RABIES: "Animal Bites / Suspected Rabies",
  IDSR_MALARIA: "Malaria (confirmed)",
  IDSR_TYPHOID: "Typhoid Fever",
  IDSR_SARI: "Severe Acute Respiratory Infection",
};

const IDSR_INDICATORS = Object.keys(IDSR_LABELS);

function Moh505() {
  const [weekStart, setWeekStart] = useState(getWeekStart(new Date()));

  const {
    data: weeklyData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["moh-505", weekStart],
    queryFn: async () => {
      const { data, error } = await db
        .from("moh_weekly_aggregates")
        .select("*")
        .in("indicator_code", IDSR_INDICATORS)
        .eq("period_week_start", weekStart)
        .order("indicator_code", { ascending: true });

      if (error) throw new Error(error.message);
      return (data ?? []) as WeeklyAggregateRow[];
    },
  });

  const rows = useMemo(() => {
    return IDSR_INDICATORS.map((code) => {
      const found = weeklyData?.find((row) => row.indicator_code === code);
      return {
        indicator_code: code,
        description: IDSR_LABELS[code] ?? code,
        value: Number(found?.value ?? 0),
      };
    });
  }, [weeklyData]);

  const total = useMemo(() => rows.reduce((sum, row) => sum + row.value, 0), [rows]);

  const handleRecalculate = async () => {
    try {
      const { error } = await db.rpc("refresh_moh_weekly_aggregates", {
        target_week_start: weekStart,
      });

      if (error) throw new Error(error.message);

      toast.success("MOH 505 IDSR aggregates refreshed.");
      await refetch();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to refresh MOH 505 aggregates.");
    }
  };

  return (
    <MohReportShell
      icon={ShieldAlert}
      title="MOH 505 — IDSR Weekly Report"
      description="Integrated Disease Surveillance and Response, reported weekly."
      printSubtitle={`Week starting: ${weekStart}`}
      periodControl={<MohWeekPicker weekStart={weekStart} onChange={setWeekStart} />}
      onRecalculate={handleRecalculate}
      onRefresh={() => refetch()}
    >
      <MohIndicatorTable
        totalLabel="Total IDSR Cases This Week"
        totalDescription="Total counted priority-disease indicators for this reporting week."
        total={total}
        tableTitle="Disease Breakdown"
        isLoading={isLoading}
        rows={rows}
        emptyMessage="No IDSR data found for this week."
      />
    </MohReportShell>
  );
}
