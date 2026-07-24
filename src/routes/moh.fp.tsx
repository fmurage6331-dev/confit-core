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
    },
  });

  const rows = useMemo(() => {
    return FP_INDICATORS.map((code) => {
      const found = fpData?.find((row) => row.indicator_code === code);

      return {
        indicator_code: code,
        description: FP_LABELS[code] ?? code,
        value: found?.value ?? 0,
      };
    });
  }, [fpData]);

  const total = useMemo(() => {
    return rows.reduce((sum, row) => sum + Number(row.value ?? 0), 0);
  }, [rows]);

  const handleRecalculate = async () => {
    try {
      const { error } = await db.rpc("refresh_moh_monthly_aggregates", {
        target_month: monthStart,
      });

      if (error) throw new Error(error.message);

      toast.success("MOH FP aggregates refreshed.");
      await refetch();
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to refresh MOH FP aggregates.",
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap no-print">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />
            MOH FP — Family Planning Report
          </h1>
          <p className="text-sm text-muted-foreground">
            Family planning services summary, monthly.
          </p>
        </div>

        <div className="flex items-end gap-2 flex-wrap">
          <div>
            <Label htmlFor="month" className="text-xs">
              Reporting month
            </Label>
            <Input
              id="month"
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              className="w-48"
            />
          </div>

          <Button onClick={handleRecalculate} variant="default">
            <RotateCcw className="mr-2 h-4 w-4" />
            Recalculate
          </Button>

          <Button onClick={() => refetch()} variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>

          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
        </div>
      </div>

      <div className="hidden print:block text-center mb-6">
        <h1 className="text-2xl font-bold">MOH FP — Family Planning Report</h1>
        <p className="text-sm">Reporting month: {month}</p>
        <p className="text-xs text-muted-foreground">
          Generated {new Date().toLocaleString()}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Total FP Indicators</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-semibold">{total}</div>
          <p className="text-sm text-muted-foreground">
            Total counted family planning indicators for this reporting month.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Family Planning Indicators</CardTitle>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Indicator Code</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Count</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.indicator_code}>
                    <TableCell className="font-mono text-xs">
                      {row.indicator_code}
                    </TableCell>
                    <TableCell>{row.description}</TableCell>
                    <TableCell className="text-right">{row.value}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {!isLoading && !isFetching && rows.every((row) => Number(row.value) === 0) && (
            <p className="text-muted-foreground text-center pt-6 no-print">
              No family planning data found for this month.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
