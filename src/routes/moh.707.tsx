/**
 * LabTrack — MOH 707 Pharmacy Report
 */

import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { MohReportShell } from "@/components/moh/moh-report-shell";
import { MohIndicatorTable } from "@/components/moh/moh-indicator-table";
import { MohMonthPicker, getDefaultMonth } from "@/components/moh/moh-month-picker";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/lib/supabase-untyped";
import { useMemo, useState } from "react";
import { Pill } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/moh/707")({
  component: () => (
    <AppShell>
      <Moh707 />
    </AppShell>
  ),
});

type AggregateRow = {
  indicator_code: string;
  period_month: string;
  value: number | string;
  computed_at?: string | null;
};

const MOH_707_LABELS: Record<string, string> = {
  PHARM_ANTIBIOTICS: "Antibiotics Dispensed",
  PHARM_ANALGESICS: "Analgesics Dispensed",
  PHARM_NSAIDS: "NSAIDs Dispensed",
  PHARM_ANTIMALARIALS: "Antimalarials Dispensed",
  PHARM_ANTIHYPERTENSIVES: "Antihypertensives Dispensed",
  PHARM_ANTIDIABETICS: "Antidiabetics Dispensed",
  PHARM_PPI: "PPIs Dispensed",
  PHARM_REHYDRATION: "Rehydration Solutions Dispensed",
  PHARM_ORS: "ORS Dispensed",
};

const MOH_707_INDICATORS = Object.keys(MOH_707_LABELS);

function Moh707() {
  const [month, setMonth] = useState(getDefaultMonth());
  const monthStart = `${month}-01`;

  const {
    data: pharmacyData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["moh-707", monthStart],
    queryFn: async () => {
      const { data, error } = await db
        .from("moh_monthly_aggregates")
        .select("*")
        .in("indicator_code", MOH_707_INDICATORS)
        .eq("period_month", monthStart)
        .order("indicator_code", { ascending: true });

      if (error) throw new Error(error.message);
      return (data ?? []) as AggregateRow[];
    },
  });

  const rows = useMemo(() => {
    return MOH_707_INDICATORS.map((code) => {
      const found = pharmacyData?.find((row) => row.indicator_code === code);
      return {
        indicator_code: code,
        description: MOH_707_LABELS[code] ?? code,
        value: Number(found?.value ?? 0),
      };
    });
  }, [pharmacyData]);

  const total = useMemo(() => rows.reduce((sum, row) => sum + row.value, 0), [rows]);

  const handleRecalculate = async () => {
    try {
      const { error } = await db.rpc("refresh_moh_aggregates", {
        target_month: monthStart,
      });

      if (error) throw new Error(error.message);

      toast.success("MOH 707 pharmacy aggregates refreshed.");
      await refetch();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to refresh MOH 707 aggregates.");
    }
  };

  return (
    <MohReportShell
      icon={Pill}
      title="MOH 707 — Pharmacy Report"
      description="Pharmaceuticals dispensed summary, monthly. Source: Pharmacy Store dispensing usage and dispensed prescriptions."
      printSubtitle={`Reporting month: ${month}`}
      periodControl={<MohMonthPicker month={month} onChange={setMonth} />}
      onRecalculate={handleRecalculate}
      onRefresh={() => refetch()}
    >
      <MohIndicatorTable
        totalLabel="Total Pharmacy Items Dispensed"
        totalDescription="Total counted pharmacy items for this reporting month."
        total={total}
        tableTitle="Pharmacy Summary"
        isLoading={isLoading}
        rows={rows}
        emptyMessage="No pharmacy dispensing data found for this month. Dispense prescriptions or record Pharmacy Store usage, then click Recalculate."
      />
    </MohReportShell>
  );
}
