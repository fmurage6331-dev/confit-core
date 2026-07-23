/**
 * LabTrack — MOH 707 Pharmacy Report
 */

import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const monthStart = `${month}-01`;

  const {
    data: pharmacyData,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["moh-707", monthStart],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("moh_monthly_aggregates")
        .select("*")
        .in("indicator_code", MOH_707_INDICATORS)
        .eq("period_month", monthStart)
        .order("indicator_code", { ascending: true });

      if (error) throw error;
      return (data ?? []) as AggregateRow[];
    },
  });

  const rows = useMemo(() => {
    return MOH_707_INDICATORS.map((code) => {
      const found = pharmacyData?.find((row) => row.indicator_code === code);

      return {
        indicator_code: code,
        description: MOH_707_LABELS[code] ?? code,
        value: found?.value ?? 0,
      };
    });
  }, [pharmacyData]);

  const total = useMemo(() => {
    return rows.reduce((sum, row) => sum + Number(row.value ?? 0), 0);
  }, [rows]);

  const handleRecalculate = async () => {
    try {
      const { error } = await (supabase as any).rpc(
        "refresh_moh_707_monthly_aggregates",
        {
          target_month: monthStart,
        }
      );

      if (error) throw error;

      toast.success("MOH 707 pharmacy aggregates refreshed.");
      await refetch();
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to refresh MOH 707 aggregates.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />
            MOH 707 — Pharmacy Report
          </h1>
          <p className="text-sm text-muted-foreground">
            Pharmaceuticals dispensed summary, monthly.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Source: Pharmacy Store dispensing usage and dispensed prescriptions.
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
          <CardTitle>Total Pharmacy Items Dispensed</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-semibold">{total}</div>
          <p className="text-sm text-muted-foreground">
            Total counted pharmacy items for this reporting month.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pharmacy Summary</CardTitle>
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
                No pharmacy dispensing data found for this month. Dispense
                prescriptions or record Pharmacy Store usage, then click
                Recalculate.
              </p>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
