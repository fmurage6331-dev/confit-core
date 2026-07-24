/**
 * LabTrack — MOH Family Planning Report
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
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const monthStart = `${month}-01`;

  const {
    data: fpData,
    isLoading,
    isFetching,
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
