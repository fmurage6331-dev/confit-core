/**
 * LabTrack — MOH 706 Laboratory Report
 */

import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { MohReportShell } from "@/components/moh/moh-report-shell";
import { MohIndicatorTable } from "@/components/moh/moh-indicator-table";
import { MohMonthPicker, getDefaultMonth } from "@/components/moh/moh-month-picker";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/lib/supabase-untyped";
import { useMemo, useState } from "react";
import { FlaskConical } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/moh/706")({
  component: () => (
    <AppShell>
      <Moh706 />
    </AppShell>
  ),
});

type AggregateRow = {
  indicator_code: string;
  period_month: string;
  value: number | string;
  computed_at?: string | null;
};

const LAB_LABELS: Record<string, string> = {
  LAB_TB: "TB Screening",
  LAB_SYPHILIS: "Syphilis Test",
  LAB_HEPB: "Hepatitis B Test",
  LAB_HEPC: "Hepatitis C Test",
  LAB_URINALYSIS: "Urinalysis",
  LAB_BLOOD_GROUP: "Blood Grouping",
  LAB_FBC: "Full Blood Count",
  LAB_PREGNANCY: "Pregnancy Test",
  LAB_PARASITOLOGY: "Stool O&P",
  LAB_CD4: "CD4 Count",
  LAB_BGLUCOSE: "Blood Glucose",
  LAB_LIPIDS: "Cholesterol / Lipids",
  LAB_VDRL: "VDRL / RPR Test",
  LAB_WIDAL: "Widal Test",
  LAB_MALARIA_SMEAR: "Malaria Blood Smear",
  LAB_MICROSCOPY: "Gram Stain / Microscopy",
  LAB_CULTURE: "Culture & Sensitivity",
};

const LAB_INDICATORS = Object.keys(LAB_LABELS);

function Moh706() {
  const [month, setMonth] = useState(getDefaultMonth());
  const monthStart = `${month}-01`;

  const {
    data: labData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["moh-706", monthStart],
    queryFn: async () => {
      const { data, error } = await db
        .from("moh_monthly_aggregates")
        .select("*")
        .in("indicator_code", LAB_INDICATORS)
        .eq("period_month", monthStart)
        .order("indicator_code", { ascending: true });

      if (error) throw new Error(error.message);
      return (data ?? []) as AggregateRow[];
    },
  });

  const rows = useMemo(() => {
    return LAB_INDICATORS.map((code) => {
      const found = labData?.find((row) => row.indicator_code === code);
      return {
        indicator_code: code,
        description: LAB_LABELS[code] ?? code,
        value: Number(found?.value ?? 0),
      };
    });
  }, [labData]);

  const total = useMemo(() => rows.reduce((sum, row) => sum + row.value, 0), [rows]);

  const handleRecalculate = async () => {
    try {
      const { error } = await db.rpc("refresh_moh_aggregates", {
        target_month: monthStart,
      });

      if (error) throw new Error(error.message);

      toast.success("MOH 706 laboratory aggregates refreshed.");
      await refetch();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to refresh MOH 706 aggregates.");
    }
  };

  return (
    <MohReportShell
      icon={FlaskConical}
      title="MOH 706 — Laboratory Report"
      description="Laboratory investigations summary, monthly."
      printSubtitle={`Reporting month: ${month}`}
      periodControl={<MohMonthPicker month={month} onChange={setMonth} />}
      onRecalculate={handleRecalculate}
      onRefresh={() => refetch()}
    >
      <MohIndicatorTable
        totalLabel="Total Laboratory Tests"
        totalDescription="Total counted lab indicators for this reporting month."
        total={total}
        tableTitle="Lab Tests Summary"
        isLoading={isLoading}
        rows={rows}
        emptyMessage="No laboratory data found for this month."
      />
    </MohReportShell>
  );
}
