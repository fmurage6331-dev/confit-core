/**
 * LabTrack — MOH 706 Laboratory Report
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
import { toast } from "sonner";

export const Route = createFileRoute("/moh/706")({
  component: () => (
    <AppShell>
      <Moh706 />
    </AppShell>
  ),
});

function Moh706() {
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay());
    return d.toISOString().split("T")[0];
  });

  const { data: labData, isLoading, refetch } = useQuery({
    queryKey: ["moh-706", weekStart],
    queryFn: async () => {
      const start = new Date(weekStart);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);

      const { data, error } = await supabase
        .from("moh_monthly_aggregates")
        .select("*")
        .eq("indicator_code", "LIKE", "LAB_%")
        .gte("period_month", start.toISOString().split("T")[0])
        .lt("period_month", end.toISOString().split("T")[0]);

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
            MOH 706 — Laboratory Report
          </h1>
          <p className="text-sm text-muted-foreground">
            Laboratory investigations summary (weekly).
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <Label htmlFor="week" className="text-xs">Week starting</Label>
            <Input
              id="week"
              type="date"
              value={weekStart}
              onChange={(e) => setWeekStart(e.target.value)}
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
          <CardTitle>Lab Tests Summary</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : labData && labData.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Indicator</TableHead>
                  <TableHead className="text-right">Count</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {labData.map((row: any) => (
                  <TableRow key={row.indicator_code}>
                    <TableCell className="font-mono text-xs">{row.indicator_code}</TableCell>
                    <TableCell className="text-right">{row.value}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              No laboratory data for this week.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
