/**
 * LabTrack — MOH 706 Laboratory Report
 */

import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/lib/supabase-untyped";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BarChart3, Printer, RefreshCw, RotateCcw } from "lucide-react";
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
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const monthStart = `${month}-01`;

  const {
    data: labData,
    isLoading,
    isFetching,
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
        value: found?.value ?? 0,
      };
    });
  }, [labData]);

  const total = useMemo(() => {
    return rows.reduce((sum, row) => sum + Number(row.value ?? 0), 0);
  }, [rows]);

  const handleRecalculate = async () => {
    try {
      const { error } = await db.rpc("refresh_moh_monthly_aggregates", {
        target_month: monthStart,
      });

      if (error) throw new Error(error.message);

      toast.success("MOH 706 laboratory aggregates refreshed.");
      await refetch();
    } catch (error: unknown) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to refresh MOH 706 aggregates.",
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap no-print">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />
            MOH 706 — Laboratory Report
          </h1>
          <p className="text-sm text-muted-foreground">
            Laboratory investigations summary, monthly.
          </p>
        </div>

        <div className="flex items-end gap-2 flex-wrap">
          <div>
            <Label htmlFor="month" className="text-xs">
