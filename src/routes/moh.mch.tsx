/**
 * LabTrack — MOH MCH Report
 */

import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { MohReportShell } from "@/components/moh/moh-report-shell";
import { MohIndicatorTable } from "@/components/moh/moh-indicator-table";
import { MohMonthPicker, getDefaultMonth } from "@/components/moh/moh-month-picker";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/lib/supabase-untyped";
import { useMemo, useState } from "react";
import { HeartPulse } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/moh/mch")({
  component: () => (
    <AppShell>
      <MohMCH />
    </AppShell>
  ),
});

type AggregateRow = {
  indicator_code: string;
  period_month: string;
  value: number | string;
  computed_at?: string | null;
};

const MCH_LABELS: Record<string, string> = {
  MCH_ANC1: "First ANC Visits",
  MCH_ANC4: "ANC Visits 4th+",
  MCH_DELIVERY: "Deliveries Conducted",
  MCH_PNC: "Postnatal Visits",
  MCH_DELIVERY_SBA: "Deliveries by Skilled Attendant",
  MCH_LBW: "Low Birth Weight Babies",
  MCH_MMR: "Maternal Deaths",
  MCH_KANGAROO: "Kangaroo Care",
};

const MCH_INDICATORS = Object.keys(MCH_LABELS);

function MohMCH() {
  const [month, setMonth] = useState(getDefaultMonth());
  const monthStart = `${month}-01`;

  const {
    data: mchData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["moh-mch", monthStart],
    queryFn: async () => {
      const { data, error } = await db
        .from("moh_monthly_aggregates")
        .select("*")
        .in("indicator_code", MCH_INDICATORS)
        .eq("period_month", monthStart)
        .order("indicator_code", { ascending: true });

      if (error) throw new Error(error.message);
      return (data ?? []) as AggregateRow[];
    },
  });

  const rows = useMemo(() => {
    return MCH_INDICATORS.map((code) => {
      const found = mchData?.find((row) => row.indicator_code === code);
      return {
        indicator_code: code,
        description: MCH_LABELS[code] ?? code,
        value: Number(found?.value ?? 0),
      };
    });
  }, [mchData]);

  const total = useMemo(() => rows.reduce((sum, row) => sum + row.value, 0), [rows]);

  const handleRecalculate = async () => {
    try {
      const { error } = await db.rpc("refresh_moh_aggregates", {
        target_month: monthStart,
      });

      if (error) throw new Error(error.message);

      toast.success("MOH MCH aggregates refreshed.");
      await refetch();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to refresh MOH MCH aggregates.");
    }
  };

  return (
    <MohReportShell
      icon={HeartPulse}
      title="MOH MCH — Maternal & Child Health"
      description="ANC, delivery, PNC and maternal-child health indicators, monthly."
      printSubtitle={`Reporting month: ${month}`}
      periodControl={<MohMonthPicker month={month} onChange={setMonth} />}
      onRecalculate={handleRecalculate}
      onRefresh={() => refetch()}
    >
      <MohIndicatorTable
        totalLabel="Total MCH Indicators"
        totalDescription="Total counted maternal & child health indicators for this reporting month."
        total={total}
        tableTitle="Maternal & Child Health Indicators"
        isLoading={isLoading}
        rows={rows}
        emptyMessage="No MCH data found for this month."
      />
    </MohReportShell>
  );
}
