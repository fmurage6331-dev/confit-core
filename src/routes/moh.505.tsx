/**
 * LabTrack — MOH 505 IDSR Weekly Report
 */

import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
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

export const Route = createFileRoute("/moh/505")({
  component: () => (
    <AppShell>
      <Moh505 />
    </AppShell>
  ),
});

type WeeklyAggregateRow = {
  indicator_code: string;
  week_start: string;
  value: number | string;
  computed_at?: string | null;
};

const IDSR_INDICATOR_LABELS: Record<string, string> = {
  IDSR_CHOLERA: "Cholera Cases",
  IDSR_MALARIA: "Malaria Cases Confirmed",
  IDSR_MEASLES: "Measles Cases",
  IDSR_TYPHOID: "Typhoid Cases",
  IDSR_DYSENTERY: "Dysentery Cases",
  IDSR_MENINGITIS: "Meningitis Cases",
  IDSR_HEPATITIS: "Hepatitis Cases",
  IDSR_YELLOW_FEVER: "Yellow Fever Cases",
  IDSR_ANTHRAX: "Anthrax Cases",
  IDSR_RABIES: "Rabies Cases",
  IDSR_TETANUS: "Neonatal Tetanus",
};

const IDSR_INDICATORS = Object.keys(IDSR_INDICATOR_LABELS);

function getCurrentWeekStart() {
  const d = new Date();

  /**
   * Sunday as week start.
   * If you want Monday as week start, replace with:
   *
   * const day = d.getDay();
   * const diff = day === 0 ? -6 : 1 - day;
   * d.setDate(d.getDate() + diff);
   */
  d.setDate(d.getDate() - d.getDay());

  return d.toISOString().split("T")[0];
}

function Moh505() {
  const [weekStart, setWeekStart] = useState(getCurrentWeekStart);

  const {
    data: idsrData,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["moh-505", weekStart],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("moh_weekly_aggregates")
        .select("*")
        .in("indicator_code", IDSR_INDICATORS)
        .eq("week_start", weekStart)
        .order("indicator_code", { ascending: true });

      if (error) throw error;

      return (data ?? []) as WeeklyAggregateRow[];
    },
  });

  const handleRecalculate = async () => {
    try {
      const { error } = await (supabase as any).rpc(
        "refresh_moh_weekly_aggregates",
        {
          target_week_start: weekStart,
        }
      );

      if (error) throw error;

      toast.success("IDSR weekly aggregates refreshed.");
      await refetch();
    } catch (error: any) {
      toast.error(error?.message ?? "Failed to refresh IDSR weekly aggregates.");
    }
  };

  const rows = IDSR_INDICATORS.map((code) => {
    const found = idsrData?.find((row) => row.indicator_code === code);

    return {
      indicator_code: code,
      label: IDSR_INDICATOR_LABELS[code] ?? code,
      value: found?.value ?? 0,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />
            MOH 505 — IDSR Weekly Report
          </h1>
          <p className="text-sm text-muted-foreground">
            Integrated Disease Surveillance and Response, weekly.
          </p>
        </div>

        <div className="flex items-end gap-2 flex-wrap">
          <div>
            <Label htmlFor="week" className="text-xs">
              Week starting
            </Label>
            <Input
              id="week"
              type="date"
              value={weekStart}
              onChange={(e) => setWeekStart(e.target.value)}
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
          <CardTitle>Weekly Disease Surveillance</CardTitle>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Indicator Code</TableHead>
                  <TableHead>Disease / Event</TableHead>
                  <TableHead className="text-right">Cases</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.indicator_code}>
                    <TableCell className="font-mono text-xs">
                      {row.indicator_code}
                    </TableCell>
                    <TableCell>{row.label}</TableCell>
                    <TableCell className="text-right">{row.value}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {!isLoading && !isFetching && rows.every((row) => Number(row.value) === 0) && (
            <p className="text-muted-foreground text-center pt-6">
              No IDSR data found for this week.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
