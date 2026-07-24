/**
 * LabTrack — MOH 642 Laboratory Commodities Report
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
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const monthStart = `${month}-01`;

  const {
    data: commodityData,
    isLoading,
    isFetching,
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
        value: found?.value ?? 0,
      };
    });
  }, [commodityData]);

  const total = useMemo(() => {
    return rows.reduce((sum, row) => sum + Number(row.value ?? 0), 0);
  }, [rows]);

  const handleRecalculate = async () => {
    try {
      const { error } = await db.rpc("refresh_moh_642_monthly_aggregates", {
        target_month: monthStart,
      });

      if (error) throw new Error(error.message);

      toast.success("MOH 642 aggregates refreshed from Lab Store usage.");
      await refetch();
    } catch (error: unknown) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to refresh MOH 642 aggregates.",
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap no-print">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />
            MOH 642 — Laboratory Commodities
          </h1>
          <p className="text-sm text-muted-foreground">
            Laboratory reagents and consumables consumption, monthly.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Source: Laboratory Store manual usage records.
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
        <h1 className="text-2xl font-bold">MOH 642 — Laboratory Commodities</h1>
        <p className="text-sm">Reporting month: {month}</p>
        <p className="text-xs text-muted-foreground">Generated {new Date().toLocaleString()}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Total Lab Commodities Used</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-semibold">{total}</div>
          <p className="text-sm text-muted-foreground">
            Total counted commodities for this reporting month.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lab Commodities Consumption</CardTitle>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Indicator Code</TableHead>
                  <TableHead>Commodity</TableHead>
                  <TableHead className="text-right">Used</TableHead>
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
              <p className="text-muted-foreground text-center pt-6 no-print">
                No Lab Store usage found for this month. Record usage from the
                Stores & Stock page, then click Recalculate.
              </p>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
