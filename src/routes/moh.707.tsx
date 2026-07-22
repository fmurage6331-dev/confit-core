/**
 * LabTrack — MOH 707 Pharmacy Report
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
import { BarChart3, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/moh/707")({
  component: () => (
    <AppShell>
      <Moh707 />
    </AppShell>
  ),
});

function Moh707() {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const { data: pharmacyData, isLoading, refetch } = useQuery({
    queryKey: ["moh-707", month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("moh_monthly_aggregates")
        .select("*")
        .ilike("indicator_code", "PHARM_%")
        .eq("period_month", `${month}-01`);

      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />
            MOH 707 — Pharmacy Report
          </h1>
          <p className="text-sm text-muted-foreground">
            Pharmaceuticals dispensed summary (monthly).
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <Label htmlFor="month" className="text-xs">Reporting month</Label>
            <Input
              id="month"
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-48"
            />
          </div>
          <Button onClick={() => refetch()} variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pharmacy Summary</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : pharmacyData && pharmacyData.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Indicator</TableHead>
                  <TableHead className="text-right">Count</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pharmacyData.map((row: any) => (
                  <TableRow key={row.indicator_code}>
                    <TableCell className="font-mono text-xs">{row.indicator_code}</TableCell>
                    <TableCell className="text-right">{row.value}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              No pharmacy data for this month.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
