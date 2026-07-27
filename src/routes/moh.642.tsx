/**
 * LabTrack — MOH 642 Laboratory Commodities Report
 */

import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { MohReportShell } from "@/components/moh/moh-report-shell";
import { MohIndicatorTable } from "@/components/moh/moh-indicator-table";
import { MohMonthPicker, getDefaultMonth } from "@/components/moh/moh-month-picker";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/lib/supabase-untyped";
import { useMemo, useState } from "react";
import { Package } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/moh/642")({
  component: () => (
    <AppShell>
      <Moh642 />
    </AppShell>
  ),
});

type AggregateRow = {
  indicator_code: string;
  period_month: string;
  value: number | string;
  computed_at?: string | null;
};

const MOH_642_LABELS: Record<string, string> = {
  LAB_HIV_KITS: "HIV Test Kits Used",
  LAB_MALARIA_RDT: "Malaria RDTs Used",
  LAB_SYPHILIS_RDT: "Syphilis RDTs Used",
  LAB_GLUCOSE_STRIPS: "Glucose Strips Used",
  LAB_URINE_STRIPS: "Urine Strips Used",
  LAB_SLIDES: "Microscope Slides Used",
  LAB_BLOOD_TUBES: "Blood Tubes / EDTA Tubes Used",
};

const MOH_642_INDICATORS = Object.keys(MOH_642_LABELS);

function Moh642() {
  const [month, setMonth] = useState(getDefaultMonth());
  const monthStart = `${month}-01`;

  const {
    data: commodityData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["moh-642", monthStart],
    queryFn: async () => {
      const { data, error } = await db
        .from("moh_monthly_aggregates")
        .select("*")
        .in("indicator_code", MOH_642_INDICATORS)
        .eq("period_month", monthStart)
        .order("indicator_code", { ascending: true });

      if (error) throw new Error(error.message);
      return (data ?? []) as AggregateRow[];
    },
  });

  const rows = useMemo(() => {
    return MOH_642_INDICATORS.map((code) => {
      const found = commodityData?.find((row) => row.indicator_code === code);
      return {
        indicator_code: code,
        description: MOH_642_LABELS[code] ?? code,
        value: Number(found?.value ?? 0),
      };
    });
  }, [commodityData]);

  const total = useMemo(() => rows.reduce((sum, row) => sum + row.value, 0), [rows]);

  const handleRecalculate = async () => {
    try {
      const { error } = await db.rpc("refresh_moh_aggregates", {
        target_month: monthStart,
      });

      if (error) throw new Error(error.message);

      toast.success("MOH 642 aggregates refreshed from Lab Store usage.");
      await refetch();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to refresh MOH 642 aggregates.");
    }
  };

  return (
    <MohReportShell
      icon={Package}
      title="MOH 642 — Laboratory Commodities"
      description="Laboratory reagents and consumables consumption, monthly. Source: Laboratory Store manual usage records."
      printSubtitle={`Reporting month: ${month}`}
      periodControl={<MohMonthPicker month={month} onChange={setMonth} />}
      onRecalculate={handleRecalculate}
      onRefresh={() => refetch()}
    >
      <MohIndicatorTable
        totalLabel="Total Lab Commodities Used"
        totalDescription="Total counted commodities for this reporting month."
        total={total}
        tableTitle="Lab Commodities Consumption"
        isLoading={isLoading}
        rows={rows}
        emptyMessage="No Lab Store usage found for this month. Record usage from the Stores & Stock page, then click Recalculate."
      />
    </MohReportShell>
  );
}
