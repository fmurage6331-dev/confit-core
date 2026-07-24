/**
 * LabTrack — Reports
 * Copyright (c) 2026 Francis Muhoro. All rights reserved.
 * Author: Francis Muhoro
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Activity,
  BarChart3,
  CalendarDays,
  FileDown,
  FlaskConical,
  HeartPulse,
  Lock,
  Package,
  Pill,
  Plus,
  Printer,
  ShieldAlert,
  Stethoscope,
  Truck,
  Users,
} from "lucide-react";
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

const MOH_REPORTS = [
  {
    title: "MOH Dashboard",
    subtitle: "All MOH reports",
    description: "Open the central MOH reporting dashboard.",
    href: "/moh",
    icon: Activity,
    period: "Monthly / Weekly",
  },
  {
    title: "MOH 705",
    subtitle: "Outpatient Report",
    description: "Monthly outpatient attendance by age and sex.",
    href: "/moh/705",
    icon: Stethoscope,
    period: "Monthly",
  },
  {
    title: "MOH 706",
    subtitle: "Laboratory Report",
    description: "Monthly laboratory investigations and tests.",
    href: "/moh/706",
    icon: FlaskConical,
    period: "Monthly",
  },
  {
    title: "MOH 707",
    subtitle: "Pharmacy Report",
    description: "Monthly pharmaceuticals dispensed summary.",
    href: "/moh/707",
    icon: Pill,
    period: "Monthly",
  },
  {
    title: "MOH 505",
    subtitle: "IDSR Weekly",
    description: "Integrated Disease Surveillance and Response.",
    href: "/moh/505",
    icon: ShieldAlert,
    period: "Weekly",
  },
  {
    title: "MOH 642",
    subtitle: "Lab Commodities",
    description: "Laboratory reagents and consumables usage.",
    href: "/moh/642",
    icon: Package,
    period: "Monthly",
  },
  {
    title: "MOH FP",
    subtitle: "Family Planning",
    description: "Family planning services and methods summary.",
    href: "/moh/fp",
    icon: Users,
    period: "Monthly",
  },
  {
    title: "MOH MCH",
    subtitle: "Maternal & Child Health",
    description: "ANC, delivery, PNC and maternal-child indicators.",
    href: "/moh/mch",
    icon: HeartPulse,
    period: "Monthly",
  },
  {
    title: "MOH 717",
    subtitle: "Monthly Summary",
    description: "Summary across monthly MOH aggregate indicators.",
    href: "/moh/717",
    icon: CalendarDays,
    period: "Monthly",
  },
];

type TestReportRow = {
  test_name: string;
  test_date: string;
  is_positive: boolean | null;
  is_medical_camp: boolean | null;
};

type FundRow = {
  id: string;
  util_date: string;
  category: string;
  amount: number | string;
  notes: string | null;
};

type RegistrationReportRow = {
  payment_mode: string | null;
  from_room: string | null;
  created_at: string | null;
  patient_due: number | string | null;
  amount_paid: number | string | null;
  payment_status: string | null;
};

type DeliveryReportRow = {
  item_name: string;
  quantity: number | string;
  unit: string | null;
  delivery_date: string;
  supplier: string | null;
};

type SummaryRow = {
  name: string;
  total: number;
  positive: number;
  camp: number;
  monthly: [number, number, number];
};

type SummaryTotals = {
  total: number;
  positive: number;
  camp: number;
  monthly: [number, number, number];
};

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

  const q = QUARTERS.find((item) => item.v === quarter) ?? QUARTERS[0];
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
      return (data ?? []) as TestReportRow[];
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
      return (data ?? []) as FundRow[];
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
      return (data ?? []) as RegistrationReportRow[];
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
      return (data ?? []) as DeliveryReportRow[];
    },
  });

  const addFund = useMutation({
    mutationFn: async (entry: {
      util_date: FormDataEntryValue | null;
      category: FormDataEntryValue | null;
      amount: number;
      notes: FormDataEntryValue | null;
    }) => {
      const { error } = await supabase.from("fund_utilizations").insert(entry as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["report_funds"] });
      setOpenFund(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const summary = useMemo(() => {
    const byTest: Record<string, SummaryRow> = {};
    const totals: SummaryTotals = {
      total: 0,
      positive: 0,
      camp: 0,
      monthly: [0, 0, 0],
    };

    for (const test of tests ?? []) {
      const month = new Date(test.test_date).getMonth();
      const monthIndex = q.months.indexOf(month);

      if (monthIndex < 0) continue;

      if (!byTest[test.test_name]) {
        byTest[test.test_name] = {
          name: test.test_name,
          total: 0,
          positive: 0,
          camp: 0,
          monthly: [0, 0, 0],
        };
      }

      byTest[test.test_name].total += 1;
      byTest[test.test_name].monthly[monthIndex] += 1;

      if (test.is_positive) byTest[test.test_name].positive += 1;
      if (test.is_medical_camp) byTest[test.test_name].camp += 1;

      totals.total += 1;
      totals.monthly[monthIndex] += 1;

      if (test.is_positive) totals.positive += 1;
      if (test.is_medical_camp) totals.camp += 1;
    }

    const rows = Object.values(byTest).sort((a, b) => b.total - a.total);

    return { rows, totals };
  }, [tests, q]);

  const totalFunds = (funds ?? []).reduce((sum, fund) => sum + Number(fund.amount || 0), 0);

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
      ...summary.rows.map((row) => [
        row.name,
        row.monthly[0],
        row.monthly[1],
        row.monthly[2],
        row.total,
        row.positive,
        row.camp,
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
      ...(funds ?? []).map((fund) => [
        fund.util_date,
        fund.category,
        Number(fund.amount),
        fund.notes ?? "",
      ]),
      ["", "TOTAL", totalFunds, ""],
    ];

    const ws2 = XLSX.utils.aoa_to_sheet(fundsData);
    ws2["!cols"] = [{ wch: 14 }, { wch: 28 }, { wch: 14 }, { wch: 40 }];

    XLSX.utils.book_append_sheet(wb, ws2, "Fund Utilizations");

    XLSX.writeFile(wb, `LabTrack_${q.label.replace(/[^A-Z0-9]/gi, "_")}_${year}.xlsx`);
  };

  const regAgg = useMemo(() => {
    const rows = registrations ?? [];
    const byRoom: Record<string, number> = {};
    const byMode: Record<string, number> = { cash: 0, insurance: 0, free: 0 };
    let billed = 0;
    let collected = 0;
    let outstanding = 0;

    for (const registration of rows) {
      const room = registration.from_room || "Unspecified";
      byRoom[room] = (byRoom[room] ?? 0) + 1;

      const paymentMode = registration.payment_mode ?? "unknown";
      if (paymentMode in byMode) byMode[paymentMode] += 1;

      const due = Number(registration.patient_due ?? 0);
      const paid = Number(registration.amount_paid ?? 0);

      billed += due;
      collected += paid;

      if (
        registration.payment_status !== "paid" &&
        registration.payment_status !== "waived"
      ) {
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
            Reports
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            General reports, department reports, stock reports, finance reports and MOH reports.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 items-end">
          <div>
            <Label className="text-xs">Year</Label>
            <Input
              type="number"
              value={year}
              onChange={(event) => setYear(Number(event.target.value))}
              className="w-24"
            />
          </div>

          <div className="w-44">
            <Label className="text-xs">Quarter</Label>
            <Select value={String(quarter)} onValueChange={(value) => setQuarter(Number(value))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {QUARTERS.map((item) => (
                  <SelectItem key={item.v} value={String(item.v)}>
                    {item.label}
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
        <h1 className="text-2xl font-bold">LabTrack Reports</h1>
        <p className="text-sm">
          {q.label} — {year}
        </p>
        <p className="text-xs text-muted-foreground">Generated {new Date().toLocaleString()}</p>
      </div>

      <section className="space-y-3 no-print">
        <div>
          <h2 className="text-xl font-semibold">MOH Reports</h2>
          <p className="text-sm text-muted-foreground">
            Open Ministry of Health reporting tools from one place.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {MOH_REPORTS.map(({ title, subtitle, description, href, icon: Icon, period }) => (
            <Link key={href} to={href as "/reports"}>
              <div className="h-full rounded-xl border bg-card p-5 transition-colors hover:border-primary/50 hover:bg-muted/30">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{title}</h3>
                    <p className="text-sm text-muted-foreground">{subtitle}</p>
                  </div>
                  <span className="rounded-lg bg-primary/10 p-2 text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                </div>

                <p className="mt-3 text-sm text-muted-foreground">{description}</p>

                <span className="mt-3 inline-flex rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {period}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-3 no-print">
        <div>
          <h2 className="text-xl font-semibold">Store & Inventory Reports</h2>
          <p className="text-sm text-muted-foreground">
            Quick links to stock, deliveries and equipment-related reports.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <ReportLinkCard
            title="Stores & Stock"
            subtitle="Store balances and usage"
            description="View Main Store, department stores, transfers and usage records."
            href="/stock"
            icon={Package}
          />
          <ReportLinkCard
            title="Deliveries"
            subtitle="Incoming supplies"
            description="View delivered items and Main Store receiving records."
            href="/deliveries"
            icon={Truck}
          />
        </div>
      </section>

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

      {canTests && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b font-semibold">
            Tests summary — {q.label} {year}
          </div>

          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Test</th>
                {q.months.map((month) => (
                  <th key={month} className="px-4 py-2 text-right">
                    {MONTH_NAMES[month]}
                  </th>
                ))}
                <th className="px-4 py-2 text-right">Total</th>
                <th className="px-4 py-2 text-right">Positive</th>
                <th className="px-4 py-2 text-right">Med. camp</th>
              </tr>
            </thead>

            <tbody className="divide-y">
              {summary.rows.map((row) => (
                <tr key={row.name}>
                  <td className="px-4 py-2 font-medium">{row.name}</td>
                  <td className="px-4 py-2 text-right">{row.monthly[0]}</td>
                  <td className="px-4 py-2 text-right">{row.monthly[1]}</td>
                  <td className="px-4 py-2 text-right">{row.monthly[2]}</td>
                  <td className="px-4 py-2 text-right font-semibold">{row.total}</td>
                  <td className="px-4 py-2 text-right">{row.positive}</td>
                  <td className="px-4 py-2 text-right">{row.camp}</td>
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
                  onSubmit={(event) => {
                    event.preventDefault();

                    const formData = new FormData(event.currentTarget);

                    addFund.mutate({
                      util_date: formData.get("util_date"),
                      category: formData.get("category"),
                      amount: Number(formData.get("amount")),
                      notes: formData.get("notes"),
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
              {(funds ?? []).map((fund) => (
                <tr key={fund.id}>
                  <td className="px-4 py-2">{fund.util_date}</td>
                  <td className="px-4 py-2">{fund.category}</td>
                  <td className="px-4 py-2 text-right font-mono">
                    {Number(fund.amount).toFixed(2)}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{fund.notes}</td>
                </tr>
              ))}

              {(funds ?? []).length === 0 && (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-muted-foreground">
                    No entries.
                  </td>
                </tr>
              )}
            </tbody>

            {(funds ?? []).length > 0 && (
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
              {(stockMoves ?? []).map((delivery, index) => (
                <tr key={`${delivery.item_name}-${delivery.delivery_date}-${index}`}>
                  <td className="px-4 py-2">{delivery.delivery_date}</td>
                  <td className="px-4 py-2">{delivery.item_name}</td>
                  <td className="px-4 py-2 text-right">
                    {Number(delivery.quantity)} {delivery.unit ?? ""}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{delivery.supplier}</td>
                </tr>
              ))}

              {(stockMoves ?? []).length === 0 && (
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

function ReportLinkCard({
  title,
  subtitle,
  description,
  href,
  icon: Icon,
}: {
  title: string;
  subtitle: string;
  description: string;
  href: string;
  icon: typeof Package;
}) {
  return (
    <Link to={href as "/reports"}>
      <div className="h-full rounded-xl border bg-card p-5 transition-colors hover:border-primary/50 hover:bg-muted/30">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold">{title}</h3>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
          <span className="rounded-lg bg-primary/10 p-2 text-primary">
            <Icon className="h-4 w-4" />
          </span>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{description}</p>
      </div>
    </Link>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "emerald" | "rose";
}) {
  const color =
    tone === "emerald"
      ? "text-emerald-600"
      : tone === "rose"
        ? "text-rose-600"
        : "text-foreground";

  return (
    <div className="rounded-lg border bg-background p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 text-xl font-semibold tabular-nums ${color}`}>{value}</div>
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

          {rows.map(([label, value]) => (
            <tr key={label}>
              <td className="px-3 py-2">{label}</td>
              <td className="px-3 py-2 text-right font-semibold tabular-nums">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
