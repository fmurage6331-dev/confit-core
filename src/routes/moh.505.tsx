/**
 * LabTrack — MOH 505 IDSR Weekly Report
 */

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
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
import { Printer, RefreshCw, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/moh/505")({
  component: () => (
    <AppShell>
      <Moh505 />
    </AppShell>
  ),
});

function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().slice(0, 10);
}

function Moh505() {
  const [weekStart, setWeekStart] = useState(getWeekStart(new Date()));
  const [cases, setCases] = useState<
    { disease: string; count: number; deaths: number }[]
  >([]);
  const [loading, setLoading] = useState(false);

  async function loadReport() {
    setLoading(true);
    try {
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      const { data, error } = await supabase.rpc("get_moh_505_report", {
        p_start_date: `${weekStart}T00:00:00+03:00`,
        p_end_date: `${weekEnd.toISOString().slice(0, 10)}T23:59:59+03:00`,
      });

      if (error) throw error;
      setCases(data ?? []);
    } catch (err) {
      toast.error("Failed to load report");
      setCases([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalCases = cases.reduce((sum, c) => sum + Number(c.count), 0);
  const totalDeaths = cases.reduce((sum, c) => sum + Number(c.deaths), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <ShieldAlert className="h-6 w-6" />
            MOH 505 — IDSR Weekly Report
          </h1>
          <p className="text-sm text-muted-foreground">
            Integrated Disease Surveillance and Response.
          </p>
        </div>

        <div className="flex items-end gap-2">
          <div>
            <Label htmlFor="week" className="text-xs">
              Week starting
            </Label>
            <Input
              id="week"
              type="date"
              value={weekStart}
              onChange={(e) => setWeekStart(e.target.value)}
              className="w-44"
            />
          </div>

          <Button onClick={loadReport} disabled={loading} variant="outline">
            <RefreshCw
              className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>

          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Cases
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalCases}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Deaths
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{totalDeaths}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Diseases Reported
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{cases.length}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Disease Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : cases.length === 0 ? (
            <p className="text-muted-foreground">
              No disease data found for this week.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Disease</TableHead>
                  <TableHead className="text-right">Cases</TableHead>
                  <TableHead className="text-right">Deaths</TableHead>
                  <TableHead className="text-right">CFR %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cases.map((c) => (
                  <TableRow key={c.disease}>
                    <TableCell className="font-medium">{c.disease}</TableCell>
                    <TableCell className="text-right">{c.count}</TableCell>
                    <TableCell className="text-right">{c.deaths}</TableCell>
                    <TableCell className="text-right">
                      {c.count > 0
                        ? ((Number(c.deaths) / Number(c.count)) * 100).toFixed(1)
                        : "0.0"}
                      %
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
