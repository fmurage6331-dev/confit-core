/**
 * LabTrack — MOH Family Planning Report
 */

import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { MohReportShell } from "@/components/moh/moh-report-shell";
import { MohIndicatorTable } from "@/components/moh/moh-indicator-table";
import { MohMonthPicker, getDefaultMonth } from "@/components/moh/moh-month-picker";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/lib/supabase-untyped";
import { useMemo, useState } from "react";
import { Users } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/moh/fp")({
  component: () => (
    <AppShell>
      <MohFP />
    </AppShell>
  ),
});

type AggregateRow = {
  indicator_code: string;
  period_month: string;
  value: number | string;
  computed_at?: string | null;
};

const FP_LABELS: Record<string, string> = {
  FP_NEW: "New FP Acceptors",
  FP_REVISIT: "FP Revisits",
  FP_CONSULTATION: "FP Consultations",
  FP_PILLS: "Oral Contraceptive Pills",
  FP_POP: "Progestin Pills",
  FP_ECP: "Emergency Contraception",
  FP_INJECTABLE: "Injectable Contraceptives",
  FP_IMPLANT: "Implant Contraceptives",
  FP_IUCD: "IUCD",
  FP_CONDOMS: "Condoms",
};

const FP_INDICATORS = Object.keys(FP_LABELS);

function MohFP() {
  const [month, setMonth] = useState(getDefaultMonth());
  const monthStart = `${month}-01`;

  const {
    data: fpData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["moh-fp", monthStart],
    queryFn: async () => {
      const { data, error } = await db
        .from("moh_monthly_aggregates")
        .select("*")
        .in("indicator_code", FP_INDICATORS)
        .eq("period_month", monthStart)
        .order("indicator_code", { ascending: true });

      if (error) throw new Error(error.message);
      return (data ?? []) as AggregateRow[];
    },
  });

  const rows = useMemo(() => {
    return FP_INDICATORS.map((code) => {
      const found = fpData?.find((row) => row.indicator_code === code);
      return {
        indicator_code: code,
        description: FP_LABELS[code] ?? code,
        value: Number(found?.value ?? 0),
      };
    });
  }, [fpData]);

  const total = useMemo(() => rows.reduce((sum, row) => sum + row.value, 0), [rows]);

  const handleRecalculate = async () => {
    try {
      const { error } = await db.rpc("refresh_moh_aggregates", {
        target_month: monthStart,
      });

      if (error) throw new Error(error.message);

      toast.success("MOH FP aggregates refreshed.");
      await refetch();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to refresh MOH FP aggregates.");
    }
  };

  return (
    <MohReportShell
      icon={Users}
      title="MOH FP — Family Planning Report"
      description="Family planning services summary, monthly."
      printSubtitle={`Reporting month: ${month}`}
      periodControl={<MohMonthPicker month={month} onChange={setMonth} />}
      onRecalculate={handleRecalculate}
      onRefresh={() => refetch()}
    >
      <MohIndicatorTable
        totalLabel="Total FP Indicators"
        totalDescription="Total counted family planning indicators for this reporting month."
        total={total}
        tableTitle="Family Planning Indicators"
        isLoading={isLoading}
        rows={rows}
        emptyMessage="No family planning data found for this month."
      />
    </MohReportShell>
  );
}
