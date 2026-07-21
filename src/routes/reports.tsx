/**
 * LabTrack — Laboratory Records
 * Copyright (c) 2026 Francis Muhoro. All rights reserved.
 * Author: Francis Muhoro
 */

import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { AccessDenied } from "@/lib/require-access";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { BarChart3, Printer, FileDown, Plus, Lock } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/reports")({
  component: () => (
    <AppShell>
      <ReportsPage />
    </AppShell>
  ),
});

const QUARTERS = [
  { v: 1, label: "Q1 (Jan – Mar)", months: [0, 1, 2] },
  { v: 2, label: "Q2 (Apr – Jun)", months: [3, 4, 5] },
  { v: 3, label: "Q3 (Jul – Sep)", months: [6, 7, 8] },
  { v: 4, label: "Q4 (Oct – Dec)", months: [9, 10, 11] },
];
const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function ReportsPage() {
  const { hasPerm } = useAuth();
  const canTests = hasPerm("reports.tests");
  const canFinance = hasPerm("reports.finance");
  const canRegistrations = hasPerm("reports.registrations");
  const canStock = hasPerm("reports.stock");
  const canAny = canTests || canFinance || canRegistrations || canStock;

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [quarter, setQuarter] = useState(Math.floor(now.getMonth() / 3) + 1);
  const [openFund, setOpenFund] = useState(false);
  const qc = useQueryClient();

  const q = QUARTERS.find((x) => x.v === quarter)!;
  const startDate = new Date(year, q.months[0], 1).toISOString().slice(0, 10);
  const endDate = new Date(year, q.months[2] + 1, 0).toISOString().slice(0, 10);

  const { data: tests } = useQuery({
    queryKey: ["report_tests", year, quarter],
    enabled: canTests,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lab_tests")
        .select("test_name, test_date, is_positive, is_medical_camp")
        .gte("test_date", startDate)
        .lte("test_date", endDate);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: funds } = useQuery({
    queryKey: ["report_funds", year, quarter],
    enabled: canFinance,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fund_utilizations")
        .select("*")
        .gte("util_date", startDate)
        .lte("util_date", endDate)
        .order("util_date");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: registrations } = useQuery({
    queryKey: ["report_registrations", year, quarter],
    enabled: canRegistrations,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patient_registrations")
        .select("payment_mode,from_room,created_at,patient_due,amount_paid,payment_status")
        .gte("created_at", `${startDate}T00:00:00`)
        .lte("created_at", `${endDate}T23:59:59`);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: stockMoves } = useQuery({
    queryKey: ["report_stock", year, quarter],
    enabled: canStock,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deliveries")
        .select("item_name,quantity,unit,delivery_date,supplier")
        .gte("delivery_date", startDate)
        .lte("delivery_date", endDate)
        .order("delivery_date");
      if (error) throw error;
      return data ?? [];
    },
  });

  const addFund = useMutation({
    mutationFn: async (f: {
      util_date: FormDataEntryValue | null;
      category: FormDataEntryValue | null;
      amount: number;
      notes: FormDataEntryValue | null;
    }) => {
      const { error } = await supabase.from("fund_utilizations").insert(f as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["report_funds"] });
      setOpenFund(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Aggregate per test type per month
  const summary = useMemo(() => {
    if (!tests)
      return { rows: [] as any[], totals: { total: 0, positive: 0, camp: 0, monthly: [0, 0, 0] } };
    const byTest: Record<
      string,
      { total: number; positive: number; camp: number; monthly: [number, number, number] }
    > = {};
    const totals = {
      total: 0,
      positive: 0,
      camp: 0,
      monthly: [0, 0, 0] as [number, number, number],
    };
    for (const t of tests) {
      const m = new Date(t.test_date).getMonth();
      const idx = q.months.indexOf(m);
      if (idx < 0) continue;
      if (!byTest[t.test_name])
        byTest[t.test_name] = { total: 0, positive: 0, camp: 0, monthly: [0, 0, 0] };
      byTest[t.test_name].total += 1;
      byTest[t.test_name].monthly[idx] += 1;
      if (t.is_positive) byTest[t.test_name].positive += 1;
      if (t.is_medical_camp) byTest[t.test_name].camp += 1;
      totals.total += 1;
      totals.monthly[idx] += 1;
      if (t.is_positive) totals.positive += 1;
      if (t.is_medical_camp) totals.camp += 1;
    }
    const rows = Object.entries(byTest)
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.total - a.total);
    return { rows, totals };
  }, [tests, q]);

  const totalFunds = (funds ?? []).reduce((s, f) => s + Number(f.amount || 0), 0);

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    const header = [
      "Test",
      MONTH_NAMES[q.months[0]],
      MONTH_NAMES[q.months[1]],
      MONTH_NAMES[q.months[2]],
      "Total",
      "Positive",
      "Medical camp",
    ];
    const sheetData = [
      [`LabTrack Quarterly Report — ${q.label} ${year}`],
      [],
      header,
      ...summary.rows.map((r) => [
        r.name,
        r.monthly[0],
        r.monthly[1],
        r.monthly[2],
        r.total,
        r.positive,
        r.camp,
      ]),
      [
        "TOTAL",
        summary.totals.monthly[0],
        summary.totals.monthly[1],
        summary.totals.monthly[2],
        summary.totals.total,
        summary.totals.positive,
        summary.totals.camp,
      ],
    ];
    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    ws["!cols"] = [
      { wch: 36 },
      { wch: 10 },
      { wch: 10 },
      { wch: 10 },
      { wch: 10 },
      { wch: 10 },
      { wch: 14 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, "Tests Summary");

    const fundsData = [
      [`Fund Utilizations — ${q.label} ${year}`],
      [],
      ["Date", "Category", "Amount", "Notes"],
      ...(funds ?? []).map((f) => [f.util_date, f.category, Number(f.amount), f.notes ?? ""]),
      ["", "TOTAL", totalFunds, ""],
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(fundsData);
    ws2["!cols"] = [{ wch: 14 }, { wch: 28 }, { wch: 14 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, ws2, "Fund Utilizations");

    XLSX.writeFile(wb, `LabTrack_${q.label.replace(/[^A-Z0-9]/gi, "_")}_${year}.xlsx`);
  };

  // Registrations aggregates (records officer report)
  const regAgg = useMemo(() => {
    const rows = registrations ?? [];
    const byRoom: Record<string, number> = {};
    const byMode: Record<string, number> = { cash: 0, insurance: 0, free: 0 };
    let billed = 0,
      collected = 0,
      outstanding = 0;
    for (const r of rows) {
      const room = (r.from_room as string | null) || "Unspecified";
      byRoom[room] = (byRoom[room] ?? 0) + 1;
      const m = r.payment_mode as string;
      if (m in byMode) byMode[m] += 1;
      const due = Number(r.patient_due ?? 0);
      const paid = Number(r.amount_paid ?? 0);
      billed += due;
      collected += paid;
      if (r.payment_status !== "paid" && r.payment_status !== "waived") {
        outstanding += Math.max(0, due - paid);
      }
    }
    return { total: rows.length, byRoom, byMode, billed, collected, outstanding };
  }, [registrations]);

  if (!canAny) {
    return (
      <AccessDenied message="You don't have any reports assigned to your department. Ask an administrator to grant you the report permissions you need." />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap no-print">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <BarChart3 className="h-7 w-7 text-primary" />
            Quarterly Reports
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Reports limited to your department. Print or export.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-end">
          <div>
            <Label className="text-xs">Year</Label>
            <Input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-24"
            />
          </div>
          <div className="w-44">
            <Label className="text-xs">Quarter</Label>
            <Select value={String(quarter)} onValueChange={(v) => setQuarter(Number(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {QUARTERS.map((qq) => (
                  <SelectItem key={qq.v} value={String(qq.v)}>
                    {qq.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
          {(canTests || canFinance) && (
            <Button onClick={exportExcel}>
              <FileDown className="mr-2 h-4 w-4" />
              Export Excel
            </Button>
          )}
        </div>
      </div>

      <div className="hidden print:block text-center mb-6">
        <h1 className="text-2xl font-bold">LabTrack Quarterly Report</h1>
        <p className="text-sm">
          {q.label} — {year}
        </p>
        <p className="text-xs text-muted-foreground">Generated {new Date().toLocaleString()}</p>
      </div>

      {/* Patient registrations report — records officer */}
      {canRegistrations && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b font-semibold">
            Patient registrations — {q.label} {year}
          </div>
          <div className="grid gap-3 p-4 sm:grid-cols-4">
            <Stat label="Total patients" value={String(regAgg.total)} />
            <Stat label="Billed" value={`KSh ${regAgg.billed.toFixed(2)}`} />
            <Stat label="Collected" value={`KSh ${regAgg.collected.toFixed(2)}`} tone="emerald" />
            <Stat label="Outstanding" value={`KSh ${regAgg.outstanding.toFixed(2)}`} tone="rose" />
          </div>
          <div className="grid gap-4 p-4 pt-0 md:grid-cols-2">
            <MiniTable
              title="By room / department"
              rows={Object.entries(regAgg.byRoom).sort((a, b) => b[1] - a[1])}
            />
            <MiniTable title="By payment mode" rows={Object.entries(regAgg.byMode)} />
          </div>
        </div>
      )}

      {/* Tests report — lab tech */}
      {canTests && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b font-semibold">
            Tests summary — {q.label} {year}
          </div>
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Test</th>
                {q.months.map((m) => (
                  <th key={m} className="px-4 py-2 text-right">
                    {MONTH_NAMES[m]}
                  </th>
                ))}
                <th className="px-4 py-2 text-right">Total</th>
                <th className="px-4 py-2 text-right">Positive</th>
                <th className="px-4 py-2 text-right">Med. camp</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {summary.rows.map((r) => (
                <tr key={r.name}>
                  <td className="px-4 py-2 font-medium">{r.name}</td>
                  <td className="px-4 py-2 text-right">{r.monthly[0]}</td>
                  <td className="px-4 py-2 text-right">{r.monthly[1]}</td>
                  <td className="px-4 py-2 text-right">{r.monthly[2]}</td>
                  <td className="px-4 py-2 text-right font-semibold">{r.total}</td>
                  <td className="px-4 py-2 text-right">{r.positive}</td>
                  <td className="px-4 py-2 text-right">{r.camp}</td>
                </tr>
              ))}
              {summary.rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-muted-foreground">
                    No tests in this quarter.
                  </td>
                </tr>
              )}
            </tbody>
            {summary.rows.length > 0 && (
              <tfoot className="bg-muted/30 font-semibold">
                <tr>
                  <td className="px-4 py-2">TOTAL</td>
                  <td className="px-4 py-2 text-right">{summary.totals.monthly[0]}</td>
                  <td className="px-4 py-2 text-right">{summary.totals.monthly[1]}</td>
                  <td className="px-4 py-2 text-right">{summary.totals.monthly[2]}</td>
                  <td className="px-4 py-2 text-right">{summary.totals.total}</td>
                  <td className="px-4 py-2 text-right">{summary.totals.positive}</td>
                  <td className="px-4 py-2 text-right">{summary.totals.camp}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {/* Finance report — accountant */}
      {canFinance && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <span className="font-semibold">Fund utilizations</span>
            <Dialog open={openFund} onOpenChange={setOpenFund}>
              <DialogTrigger asChild>
                <Button size="sm" className="no-print">
                  <Plus className="mr-1 h-3 w-3" />
                  Add entry
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Fund utilization</DialogTitle>
                </DialogHeader>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    addFund.mutate({
                      util_date: f.get("util_date"),
                      category: f.get("category"),
                      amount: Number(f.get("amount")),
                      notes: f.get("notes"),
                    });
                  }}
                  className="space-y-3"
                >
                  <div>
                    <Label>Date *</Label>
                    <Input
                      type="date"
                      name="util_date"
                      required
                      defaultValue={new Date().toISOString().slice(0, 10)}
                    />
                  </div>
                  <div>
                    <Label>Category *</Label>
                    <Input name="category" required placeholder="Reagents, Equipment, Salaries…" />
                  </div>
                  <div>
                    <Label>Amount *</Label>
                    <Input type="number" step="0.01" name="amount" required />
                  </div>
                  <div>
                    <Label>Notes</Label>
                    <Textarea name="notes" />
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={addFund.isPending}>
                      Save
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Date</th>
                <th className="px-4 py-2 text-left">Category</th>
                <th className="px-4 py-2 text-right">Amount</th>
                <th className="px-4 py-2 text-left">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {funds?.map((f) => (
                <tr key={f.id}>
                  <td className="px-4 py-2">{f.util_date}</td>
                  <td className="px-4 py-2">{f.category}</td>
                  <td className="px-4 py-2 text-right font-mono">{Number(f.amount).toFixed(2)}</td>
                  <td className="px-4 py-2 text-muted-foreground">{f.notes}</td>
                </tr>
              ))}
              {funds?.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-muted-foreground">
                    No entries.
                  </td>
                </tr>
              )}
            </tbody>
            {(funds?.length ?? 0) > 0 && (
              <tfoot className="bg-muted/30 font-semibold">
                <tr>
                  <td className="px-4 py-2" colSpan={2}>
                    TOTAL
                  </td>
                  <td className="px-4 py-2 text-right font-mono">{totalFunds.toFixed(2)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {/* Stock / deliveries report — lab tech */}
      {canStock && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b font-semibold">
            Deliveries — {q.label} {year}
          </div>
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Date</th>
                <th className="px-4 py-2 text-left">Item</th>
                <th className="px-4 py-2 text-right">Qty</th>
                <th className="px-4 py-2 text-left">Supplier</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(stockMoves ?? []).map((d, i) => (
                <tr key={i}>
                  <td className="px-4 py-2">{d.delivery_date}</td>
                  <td className="px-4 py-2">{d.item_name}</td>
                  <td className="px-4 py-2 text-right">
                    {Number(d.quantity)} {d.unit ?? ""}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{d.supplier}</td>
                </tr>
              ))}
              {(stockMoves?.length ?? 0) === 0 && (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-muted-foreground">
                    No deliveries in this quarter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="rounded-md border border-dashed bg-muted/20 p-3 text-xs text-muted-foreground flex items-center gap-2 no-print">
        <Lock className="h-3.5 w-3.5" />
        Only the reports your department has access to are shown. Admins can change this in
        Permissions.
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "emerald" | "rose" }) {
  const c =
    tone === "emerald" ? "text-emerald-600" : tone === "rose" ? "text-rose-600" : "text-foreground";
  return (
    <div className="rounded-lg border bg-background p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 text-xl font-semibold tabular-nums ${c}`}>{value}</div>
    </div>
  );
}

function MiniTable({ title, rows }: { title: string; rows: [string, number][] }) {
  return (
    <div className="rounded-lg border">
      <div className="border-b bg-muted/40 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      <table className="w-full text-sm">
        <tbody className="divide-y">
          {rows.length === 0 && (
            <tr>
              <td className="px-3 py-2 text-muted-foreground">No data.</td>
            </tr>
          )}
          {rows.map(([k, v]) => (
            <tr key={k}>
              <td className="px-3 py-2">{k}</td>
              <td className="px-3 py-2 text-right font-semibold tabular-nums">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
