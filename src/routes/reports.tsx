/**
 * LabTrack — Reports
 * Copyright (c) 2026 Francis Muhoro. All rights reserved.
 * Author: Francis Muhoro
 */

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/lib/supabase-untyped";
import { AppShell } from "@/components/app-shell";
import { MohReportsGrid } from "@/components/moh/moh-reports-grid";
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
  FileDown,
  Lock,
  Package,
  Plus,
  Printer,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { PrintHeader } from "@/components/print-header";
import { toast } from "sonner";

type NlmisRow = {
  nlmis_code: string | null;
  item_name: string;
  store_name: string;
  total_consumed: number;
};

type PharmRow = {
  drug_name: string | null;
  medication_name: string | null;
  quantity: number | null;
  unit: string | null;
  dispensed_at: string | null;
  dispensed_by_name: string | null;
  patient_name: string | null;
};

function usePharmacyDispensing(from: string, to: string) {
  return useQuery({
    queryKey: ["pharmacy-dispensing", from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prescriptions")
        .select(
          "drug_name,medication_name,quantity,unit,dispensed_at,dispensed_by_name,patient_registrations(patient_name)",
        )
        .eq("status", "dispensed")
        .gte("dispensed_at", `${from}T00:00:00`)
        .lte("dispensed_at", `${to}T23:59:59`)
        .order("dispensed_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return ((data ?? []) as never[]).map((r: never) => ({
        drug_name: (r as { drug_name: string | null }).drug_name,
        medication_name: (r as { medication_name: string | null }).medication_name,
        quantity: (r as { quantity: number | null }).quantity,
        unit: (r as { unit: string | null }).unit,
        dispensed_at: (r as { dispensed_at: string | null }).dispensed_at,
        dispensed_by_name: (r as { dispensed_by_name: string | null }).dispensed_by_name,
        patient_name:
          (r as { patient_registrations: { patient_name: string | null } | null })
            .patient_registrations?.patient_name ?? null,
      })) as PharmRow[];
    },
    enabled: !!from && !!to,
  });
}

function useNlmisReport(from: string, to: string) {
  return useQuery({
    queryKey: ["nlmis-report", from, to],
    queryFn: async () => {
      const { data, error } = await db
        .from("stock_usage")
        .select("quantity,reason,used_at,stock_items(name,nlmis_code),stock_locations(name)")
        .eq("reason", "dispensed")
        .gte("used_at", `${from}T00:00:00`)
        .lte("used_at", `${to}T23:59:59`);
      if (error) throw error;
      const map = new Map<string, NlmisRow>();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const row of (data ?? []) as any[]) {
        const item = row.stock_items as { name: string; nlmis_code: string | null } | null;
        const loc = row.stock_locations as { name: string } | null;
        if (!item) continue;
        const key = `${item.nlmis_code ?? ""}__${item.name}__${loc?.name ?? ""}`;
        const existing = map.get(key);
        if (existing) {
          existing.total_consumed += Number(row.quantity ?? 0);
        } else {
          map.set(key, {
            nlmis_code: item.nlmis_code ?? null,
            item_name: item.name,
            store_name: loc?.name ?? "—",
            total_consumed: Number(row.quantity ?? 0),
          });
        }
      }
      return Array.from(map.values()).sort(
        (a, b) =>
          (a.nlmis_code ?? "").localeCompare(b.nlmis_code ?? "") ||
          a.item_name.localeCompare(b.item_name),
      );
    },
    refetchInterval: 60_000,
  });
}

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
  const navigate = useNavigate();

  const canTests = hasPerm("reports.tests");
  const canFinance = hasPerm("reports.finance");
  const canRegistrations = hasPerm("reports.registrations");
  const canStock = hasPerm("reports.stock");
  const canPharm = hasPerm("reports.stock") || hasPerm("pharmacy_view");
  const canAny = canTests || canFinance || canRegistrations || canStock || canPharm;

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [quarter, setQuarter] = useState(Math.floor(now.getMonth() / 3) + 1);
  const [pharmFrom, setPharmFrom] = useState(now.toISOString().slice(0, 8) + "01");
  const [pharmTo, setPharmTo] = useState(now.toISOString().slice(0, 10));
  const { data: pharmData, isLoading: pharmLoading } = usePharmacyDispensing(pharmFrom, pharmTo);
  const [openFund, setOpenFund] = useState(false);
  const [selectedMohPrintReport, setSelectedMohPrintReport] = useState("/moh/705");
  const [censusFrom, setCensusFrom] = useState(
    new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10),
  );
  const [censusTo, setCensusTo] = useState(now.toISOString().slice(0, 10));

  const qc = useQueryClient();

  const q = QUARTERS.find((item) => item.v === quarter) ?? QUARTERS[0];
  const startDate = new Date(year, q.months[0], 1).toISOString().slice(0, 10);
  const endDate = new Date(year, q.months[2] + 1, 0).toISOString().slice(0, 10);
  const hasValidCensusRange = censusFrom <= censusTo;

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

  const { data: census, isLoading: censusLoading } = useQuery({
    queryKey: ["report_census", censusFrom, censusTo],
    enabled: canRegistrations && hasValidCensusRange,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_patient_census" as never)
        .select("*")
        .gte("visit_date", censusFrom)
        .lte("visit_date", censusTo)
        .order("visit_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as {
        visit_date: string;
        room_name: string | null;
        room_kind: string | null;
        patient_count: number;
        emergency_count: number;
        insurance_count: number;
        cash_count: number;
        free_count: number;
      }[];
    },
  });

  const censusTotals = useMemo(() => {
    const rows = census ?? [];
    return {
      total: rows.reduce((s, r) => s + Number(r.patient_count), 0),
      emergency: rows.reduce((s, r) => s + Number(r.emergency_count), 0),
      insurance: rows.reduce((s, r) => s + Number(r.insurance_count), 0),
      cash: rows.reduce((s, r) => s + Number(r.cash_count), 0),
      free: rows.reduce((s, r) => s + Number(r.free_count), 0),
    };
  }, [census]);

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

  // NLMIS
  const [nlmisMonth, setNlmisMonth] = useState(() => String(now.getMonth() + 1).padStart(2, "0"));
  const [nlmisYear, setNlmisYear] = useState(() => String(now.getFullYear()));
  const [nlmisChecklist, setNlmisChecklist] = useState({
    downloaded: false,
    loggedin: false,
    uploaded: false,
    confirmed: false,
  });

  // Derive from/to from month+year for the query
  const nlmisFrom = `${nlmisYear}-${nlmisMonth}-01`;
  const nlmisTo = new Date(Number(nlmisYear), Number(nlmisMonth), 0).toISOString().slice(0, 10);

  const { data: nlmisData, isLoading: nlmisLoading } = useNlmisReport(nlmisFrom, nlmisTo);

  // Fetch facility KMHFL code for filename
  const { data: facilitySettings } = useQuery({
    queryKey: ["app-settings-nlmis"],
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("facility_kmhfl_code")
        .eq("id", "global")
        .maybeSingle();
      return data;
    },
  });

  const exportNlmisCsv = () => {
    if (!nlmisData || nlmisData.length === 0) return;
    const kmhfl = facilitySettings?.facility_kmhfl_code ?? "FACILITY";
    const header = ["NLMIS Code", "Item Name", "Store", "Qty Dispensed"];
    const rows = nlmisData.map((r) => [
      r.nlmis_code ?? "",
      r.item_name,
      r.store_name,
      Number(r.total_consumed),
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `NLMIS_${kmhfl}_${nlmisYear}_${nlmisMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setNlmisChecklist((prev) => ({ ...prev, downloaded: true }));
  };

  const exportExcel = () => {
    const toCSV = (rows: (string | number)[][]): string =>
      rows
        .map((row) =>
          row
            .map((cell) => {
              const s = String(cell ?? "");
              return s.includes(",") || s.includes('"') || s.includes("\n")
                ? `"${s.replace(/"/g, '""')}"`
                : s;
            })
            .join(","),
        )
        .join("\r\n");

    const downloadCSV = (content: string, filename: string) => {
      const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    };

    const slug = q.label.replace(/[^A-Z0-9]/gi, "_");

    const summaryRows: (string | number)[][] = [
      [`LabTrack Quarterly Report — ${q.label} ${year}`],
      [],
      [
        "Test",
        MONTH_NAMES[q.months[0]],
        MONTH_NAMES[q.months[1]],
        MONTH_NAMES[q.months[2]],
        "Total",
        "Positive",
        "Medical camp",
      ],
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

    const fundsRows: (string | number)[][] = [
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

    downloadCSV(toCSV(summaryRows), `LabTrack_${slug}_${year}_Tests.csv`);
    downloadCSV(toCSV(fundsRows), `LabTrack_${slug}_${year}_Funds.csv`);
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

      if (registration.payment_status !== "paid" && registration.payment_status !== "waived") {
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

          <div className="w-56">
            <Label className="text-xs">Print MOH report</Label>
            <Select value={selectedMohPrintReport} onValueChange={setSelectedMohPrintReport}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="/moh/705">MOH 705 — Outpatient</SelectItem>
                <SelectItem value="/moh/706">MOH 706 — Laboratory</SelectItem>
                <SelectItem value="/moh/707">MOH 707 — Pharmacy</SelectItem>
                <SelectItem value="/moh/505">MOH 505 — IDSR Weekly</SelectItem>
                <SelectItem value="/moh/642">MOH 642 — Lab Commodities</SelectItem>
                <SelectItem value="/moh/fp">MOH FP — Family Planning</SelectItem>
                <SelectItem value="/moh/mch">MOH MCH — Maternal & Child</SelectItem>
                <SelectItem value="/moh/717">MOH 717 — Monthly Summary</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            variant="outline"
            onClick={() => navigate({ to: selectedMohPrintReport as "/moh/705" })}
          >
            <Printer className="mr-2 h-4 w-4" />
            Open MOH Report
          </Button>

          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            Print Page
          </Button>

          {(canTests || canFinance) && (
            <Button onClick={exportExcel}>
              <FileDown className="mr-2 h-4 w-4" />
              Export Excel
            </Button>
          )}
        </div>
      </div>

      <div className="hidden print:block mb-6">
        <PrintHeader title="Reports" subtitle={`${q.label} — ${year}`} />
      </div>

      <section className="space-y-3 no-print">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-xl font-semibold">MOH Reports</h2>
            <p className="text-sm text-muted-foreground">
              Open Ministry of Health reporting tools from one place.
            </p>
          </div>
          <Link to="/moh">
            <Button variant="outline" size="sm">
              <Activity className="mr-2 h-4 w-4" />
              MOH Dashboard
            </Button>
          </Link>
        </div>

        <MohReportsGrid />
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

      {/* ── NLMIS Consumption Report ─────────────────────────────────────── */}
      <section className="space-y-4 no-print">
        {/* Header + controls */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-xl font-semibold">NLMIS Consumption Report</h2>
            <p className="text-sm text-muted-foreground">
              Pharmacy dispensing by NLMIS commodity code — for KEMSA/MOH KHIS submission.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Label className="text-xs">Month</Label>
              <Select value={nlmisMonth} onValueChange={setNlmisMonth}>
                <SelectTrigger className="w-32 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"].map(
                    (m) => (
                      <SelectItem key={m} value={m}>
                        {new Date(2000, Number(m) - 1).toLocaleString("default", { month: "long" })}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs">Year</Label>
              <Select value={nlmisYear} onValueChange={setNlmisYear}>
                <SelectTrigger className="w-24 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2024, 2025, 2026, 2027].map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              disabled={!nlmisData || nlmisData.length === 0}
              onClick={exportNlmisCsv}
            >
              <FileDown className="mr-2 h-4 w-4" />
              Export NLMIS CSV
            </Button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border bg-card p-4 text-center">
            <div className="text-2xl font-bold text-primary">{nlmisData?.length ?? 0}</div>
            <div className="text-xs text-muted-foreground mt-1">Items in Report</div>
          </div>
          <div className="rounded-xl border bg-card p-4 text-center">
            <div className="text-2xl font-bold text-green-600">
              {nlmisData?.filter((r) => r.nlmis_code).length ?? 0}
            </div>
            <div className="text-xs text-muted-foreground mt-1">NLMIS Tagged</div>
          </div>
          <div className="rounded-xl border bg-card p-4 text-center">
            <div className="text-2xl font-bold text-amber-500">
              {nlmisData?.filter((r) => !r.nlmis_code).length ?? 0}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Untagged</div>
          </div>
          <div className="rounded-xl border bg-card p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">
              {nlmisData?.reduce((s, r) => s + Number(r.total_consumed), 0).toLocaleString() ?? 0}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Total Units</div>
          </div>
        </div>

        {/* Data table */}
        <div className="overflow-hidden rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2">NLMIS Code</th>
                <th className="px-4 py-2">Item</th>
                <th className="px-4 py-2">Store</th>
                <th className="px-4 py-2 text-right">Qty Dispensed</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {nlmisLoading && (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              )}
              {!nlmisLoading && (!nlmisData || nlmisData.length === 0) && (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-muted-foreground">
                    No dispensing records with NLMIS codes for this period.
                  </td>
                </tr>
              )}
              {(nlmisData ?? []).map((row, i) => (
                <tr key={i} className="hover:bg-muted/20">
                  <td className="px-4 py-2 font-mono text-xs">
                    {row.nlmis_code ? (
                      <span className="text-green-700 font-semibold">{row.nlmis_code}</span>
                    ) : (
                      <span className="text-amber-500 italic">Untagged</span>
                    )}
                  </td>
                  <td className="px-4 py-2 font-medium">{row.item_name}</td>
                  <td className="px-4 py-2 text-muted-foreground">{row.store_name}</td>
                  <td className="px-4 py-2 text-right font-mono">
                    {Number(row.total_consumed).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* KHIS Submission Checklist */}
        {nlmisData && nlmisData.length > 0 && (
          <div className="rounded-xl border bg-blue-50 dark:bg-blue-950/20 p-4 space-y-3">
            <h3 className="font-semibold text-sm text-blue-800 dark:text-blue-300">
              📋 KHIS Submission Checklist —{" "}
              {new Date(Number(nlmisYear), Number(nlmisMonth) - 1).toLocaleString("default", {
                month: "long",
              })}{" "}
              {nlmisYear}
            </h3>
            <div className="space-y-2">
              {[
                { key: "downloaded", label: "CSV exported and saved to computer" },
                { key: "loggedin", label: "Logged into KHIS portal (khis.go.ke)" },
                { key: "uploaded", label: "CSV uploaded to KHIS NLMIS module" },
                { key: "confirmed", label: "Submission confirmed in KHIS portal" },
              ].map(({ key, label }) => (
                <label key={key} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={nlmisChecklist[key as keyof typeof nlmisChecklist]}
                    onChange={(e) =>
                      setNlmisChecklist((prev) => ({ ...prev, [key]: e.target.checked }))
                    }
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <span
                    className={`text-sm ${nlmisChecklist[key as keyof typeof nlmisChecklist] ? "line-through text-muted-foreground" : ""}`}
                  >
                    {label}
                  </span>
                </label>
              ))}
            </div>
            {Object.values(nlmisChecklist).every(Boolean) && (
              <div className="rounded-lg bg-green-100 dark:bg-green-900/30 p-3 text-sm text-green-800 dark:text-green-300 font-medium">
                ✅ All steps complete — NLMIS submission done for{" "}
                {new Date(Number(nlmisYear), Number(nlmisMonth) - 1).toLocaleString("default", {
                  month: "long",
                })}{" "}
                {nlmisYear}
              </div>
            )}
          </div>
        )}
      </section>

      {canPharm && (
        <section className="space-y-4 no-print">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-xl font-semibold">Pharmacy Dispensing Report</h2>
              <p className="text-sm text-muted-foreground">
                All dispensed prescriptions for the selected date range.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Label className="text-xs">From</Label>
              <Input
                type="date"
                value={pharmFrom}
                onChange={(e) => setPharmFrom(e.target.value)}
                className="w-36 h-8 text-sm"
              />
              <Label className="text-xs">To</Label>
              <Input
                type="date"
                value={pharmTo}
                onChange={(e) => setPharmTo(e.target.value)}
                className="w-36 h-8 text-sm"
              />
              <Button
                variant="outline"
                size="sm"
                disabled={!pharmData || pharmData.length === 0}
                onClick={() => {
                  const rows = pharmData ?? [];
                  const csv = [
                    ["Date", "Patient", "Drug", "Qty", "Unit", "Dispensed By"].join(","),
                    ...rows.map((r) =>
                      [
                        r.dispensed_at ? new Date(r.dispensed_at).toLocaleDateString() : "",
                        `"${r.patient_name ?? ""}"`,
                        `"${r.drug_name ?? ""}"`,
                        r.quantity ?? 0,
                        r.unit ?? "",
                        `"${r.dispensed_by_name ?? ""}"`,
                      ].join(","),
                    ),
                  ].join("\n");
                  const blob = new Blob([csv], { type: "text/csv" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `pharmacy-dispensing-${pharmFrom}-${pharmTo}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                <FileDown className="mr-2 h-4 w-4" /> Export CSV
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border bg-card p-4 text-center">
              <div className="text-2xl font-bold text-primary">{pharmData?.length ?? 0}</div>
              <div className="text-xs text-muted-foreground mt-1">Prescriptions Dispensed</div>
            </div>
            <div className="rounded-xl border bg-card p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">
                {pharmData?.reduce((s, r) => s + Number(r.quantity ?? 0), 0).toLocaleString() ?? 0}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Total Units</div>
            </div>
            <div className="rounded-xl border bg-card p-4 text-center">
              <div className="text-2xl font-bold text-emerald-600">
                {new Set(pharmData?.map((r) => r.patient_name)).size ?? 0}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Unique Patients</div>
            </div>
            <div className="rounded-xl border bg-card p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">
                {new Set(pharmData?.map((r) => r.drug_name)).size ?? 0}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Unique Drugs</div>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Patient</th>
                  <th className="px-4 py-2">Drug</th>
                  <th className="px-4 py-2 text-right">Qty</th>
                  <th className="px-4 py-2">Unit</th>
                  <th className="px-4 py-2">Dispensed by</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {pharmLoading && (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-muted-foreground">
                      Loading…
                    </td>
                  </tr>
                )}
                {!pharmLoading && (pharmData ?? []).length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-muted-foreground">
                      No dispensing records for this period.
                    </td>
                  </tr>
                )}
                {(pharmData ?? []).map((r, i) => (
                  <tr key={i} className="hover:bg-muted/20">
                    <td className="px-4 py-2 text-muted-foreground">
                      {r.dispensed_at ? new Date(r.dispensed_at).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-2 font-medium">{r.patient_name ?? "—"}</td>
                    <td className="px-4 py-2">{r.drug_name ?? r.medication_name ?? "—"}</td>
                    <td className="px-4 py-2 text-right font-mono">{Number(r.quantity ?? 0)}</td>
                    <td className="px-4 py-2 text-muted-foreground">{r.unit ?? "—"}</td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {r.dispensed_by_name ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

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
                  onSubmit={(event: FormEvent<HTMLFormElement>) => {
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

      {canRegistrations && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Daily Patient Census
            </h2>
            {!hasValidCensusRange && (
              <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-1 text-xs text-rose-700">
                Please choose a valid date range.
              </div>
            )}
            <div className="flex items-center gap-2">
              <Label className="text-xs">From</Label>
              <Input
                type="date"
                value={censusFrom}
                onChange={(e) => setCensusFrom(e.target.value)}
                className="w-36 h-8 text-sm"
              />
              <Label className="text-xs">To</Label>
              <Input
                type="date"
                value={censusTo}
                onChange={(e) => setCensusTo(e.target.value)}
                className="w-36 h-8 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Stat label="Total visits" value={String(censusTotals.total)} />
            <Stat label="Emergency" value={String(censusTotals.emergency)} tone="rose" />
            <Stat label="Cash" value={String(censusTotals.cash)} />
            <Stat label="Insurance" value={String(censusTotals.insurance)} />
            <Stat label="Free / Waived" value={String(censusTotals.free)} />
          </div>

          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Room</th>
                  <th className="px-4 py-2">Kind</th>
                  <th className="px-4 py-2 text-right">Patients</th>
                  <th className="px-4 py-2 text-right">Emergency</th>
                  <th className="px-4 py-2 text-right">Cash</th>
                  <th className="px-4 py-2 text-right">Insurance</th>
                  <th className="px-4 py-2 text-right">Free</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {censusLoading && (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-muted-foreground">
                      Loading…
                    </td>
                  </tr>
                )}
                {!censusLoading && (census ?? []).length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-muted-foreground">
                      No data for selected date range.
                    </td>
                  </tr>
                )}
                {(census ?? []).map((row, i) => (
                  <tr key={i} className="hover:bg-muted/40">
                    <td className="px-4 py-2 font-medium">{row.visit_date}</td>
                    <td className="px-4 py-2">{row.room_name ?? "—"}</td>
                    <td className="px-4 py-2 text-muted-foreground capitalize">
                      {row.room_kind ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-right font-mono font-semibold">
                      {row.patient_count}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-rose-600">
                      {row.emergency_count || "—"}
                    </td>
                    <td className="px-4 py-2 text-right font-mono">{row.cash_count || "—"}</td>
                    <td className="px-4 py-2 text-right font-mono">{row.insurance_count || "—"}</td>
                    <td className="px-4 py-2 text-right font-mono">{row.free_count || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
  icon: LucideIcon;
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

function Stat({ label, value, tone }: { label: string; value: string; tone?: "emerald" | "rose" }) {
  const color =
    tone === "emerald" ? "text-emerald-600" : tone === "rose" ? "text-rose-600" : "text-foreground";

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
