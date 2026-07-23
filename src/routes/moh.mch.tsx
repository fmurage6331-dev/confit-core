/**
 * LabTrack — MOH MCH Report
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
import { BarChart3, RefreshCw, RotateCcw } from "lucide-react";
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
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const monthStart = `${month}-01`;

  const {
    data: mchData,
    isLoading,
    isFetching,
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
        value: found?.value ?? 0,
      };
    });
  }, [mchData]);

  const total = useMemo(() => {
    return rows.reduce((sum, row) => sum + Number(row.value ?? 0), 0);
  }, [rows]);

  const handleRecalculate = async () => {
    try {
      const { error } = await db.rpc("refresh_moh_monthly_aggregates", {
        target_month: monthStart,
      });

      if (error) throw new Error(error.message);

      toast.success("MOH MCH aggregates refreshed.");
      await refetch();
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to refresh MOH MCH aggregates.",
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />
            MCH — Maternal & Child Health
          </h1>
          <p className="text-sm text-muted-foreground">
            Antenatal care, deliveries, and postnatal services, monthly.
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
              onChange={(e) => setMonth(e.target.value)}
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
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Total MCH Indicators</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-semibold">{total}</div>
          <p className="text-sm text-muted-foreground">
            Total counted MCH indicators for this reporting month.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>MCH Services</CardTitle>
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

          {!isLoading &&
            !isFetching &&
            rows.every((row) => Number(row.value) === 0) && (
              <p className="text-muted-foreground text-center pt-6">
                No MCH data found for this month.
              </p>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
