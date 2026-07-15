/**
 * LabTrack — MOH Reporting Dashboard
 */

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export const Route = createFileRoute("/moh")({
  component: () => <AppShell><MohDashboard /></AppShell>,
});

type AggRow = { indicator_code: string; value: number; period_month: string; computed_at: string | null };

type Category = "OPD" | "LAB" | "PHARM" | "FP" | "OTHER";

function categoryOf(code: string): Category {
  const c = code.toUpperCase();
  if (c.startsWith("LAB_")) return "LAB";
  if (c.startsWith("PHARM_")) return "PHARM";
  if (c.startsWith("FP_") || c === "MCH_FP") return "FP";
  if (c.startsWith("OPD_") || c.startsWith("A3_") || c.startsWith("MCH_") || c.startsWith("DENTAL_")) return "OPD";
  return "OTHER";
}

const CATEGORY_META: { key: Category; label: string; color: string }[] = [
  { key: "OPD", label: "Outpatient (OPD)", color: "hsl(var(--primary))" },
  { key: "LAB", label: "Laboratory (LAB)", color: "hsl(220 70% 50%)" },
  { key: "PHARM", label: "Pharmacy (PHARM)", color: "hsl(160 60% 45%)" },
  { key: "FP", label: "Family Planning (FP)", color: "hsl(340 70% 55%)" },
];

function firstOfMonth(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}`;
}

function MohDashboard() {
  const [month, setMonth] = useState<string>(firstOfMonth());
  const [rows, setRows] = useState<AggRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  async function load(targetMonth: string) {
    setLoading(true);
    try {
      const period = `${targetMonth}-01`;
      const { data, error } = await supabase
        .from("moh_monthly_aggregates")
        .select("indicator_code, value, period_month, computed_at")
        .eq("period_month", period)
        .order("indicator_code");
      if (error) throw error;
      setRows((data ?? []) as AggRow[]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load aggregates");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(month); }, [month]);

  async function onRefresh() {
    setRefreshing(true);
    const t = toast.loading("Calculating MOH totals…");
    try {
      const { error } = await supabase.rpc("refresh_moh_aggregates", { target_month: `${month}-01` });
      if (error) throw error;
      await load(month);
      toast.success("MOH aggregates refreshed", { id: t });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Refresh failed", { id: t });
    } finally {
      setRefreshing(false);
    }
  }

  const grouped = useMemo(() => {
    const g: Record<Category, AggRow[]> = { OPD: [], LAB: [], PHARM: [], FP: [], OTHER: [] };
    for (const r of rows) g[categoryOf(r.indicator_code)].push(r);
    return g;
  }, [rows]);

  const chartData = useMemo(
    () => CATEGORY_META.map((c) => ({
      name: c.key,
      total: grouped[c.key].reduce((s, r) => s + Number(r.value || 0), 0),
      color: c.color,
    })),
    [grouped],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">MOH Reporting Dashboard</h1>
          <p className="text-sm text-muted-foreground">Monthly indicator aggregates by category.</p>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <Label htmlFor="month" className="text-xs">Reporting month</Label>
            <Input id="month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-48" />
          </div>
          <Button onClick={onRefresh} disabled={refreshing || loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Calculating MOH totals…" : "Refresh Data"}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4" /> Category totals
          </CardTitle>
        </CardHeader>
        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {CATEGORY_META.map((c) => {
          const items = grouped[c.key];
          const total = items.reduce((s, r) => s + Number(r.value || 0), 0);
          return (
            <Card key={c.key}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-base">
                  <span>{c.label}</span>
                  <span className="text-sm font-normal text-muted-foreground">Total: {total}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <p className="text-sm text-muted-foreground">Loading…</p>
                ) : items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No data for this month. Click "Refresh Data" to compute.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Indicator</TableHead>
                        <TableHead className="text-right">Value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((r) => (
                        <TableRow key={r.indicator_code}>
                          <TableCell className="font-mono text-xs">{r.indicator_code}</TableCell>
                          <TableCell className="text-right">{r.value}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {grouped.OTHER.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Other</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Indicator</TableHead><TableHead className="text-right">Value</TableHead></TableRow></TableHeader>
              <TableBody>
                {grouped.OTHER.map((r) => (
                  <TableRow key={r.indicator_code}>
                    <TableCell className="font-mono text-xs">{r.indicator_code}</TableCell>
                    <TableCell className="text-right">{r.value}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
