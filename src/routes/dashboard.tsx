/**
 * LabTrack — Laboratory Records
 * Copyright (c) 2026 Francis Muhoro. All rights reserved.
 * Author: Francis Muhoro
 */

import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/lib/supabase-untyped";
import { AppShell } from "@/components/app-shell";
import { useState } from "react";
import { format } from "date-fns";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  Archive,
  BedDouble,
  HelpCircle,
  FlaskConical,
  Package,
  Radio,
  AlertTriangle,
  Users,
  TrendingUp,
  Banknote,
  ShieldCheck,
  Clock,
  Database,
} from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  component: () => (
    <AppShell>
      <Dashboard />
    </AppShell>
  ),
});

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatKES(value: number) {
  return `KES ${value.toLocaleString("en-KE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// ─── Queries ────────────────────────────────────────────────────────────────

function useTodayEncounters() {
  return useQuery({
    queryKey: ["dashboard-today-encounters"],
    queryFn: async () => {
      const today = todayISO();
      const { data, error } = await supabase
        .from("encounters")
        .select("id, sha_fund_type")
        .gte("created_at", `${today}T00:00:00+00:00`)
        .lte("created_at", `${today}T23:59:59+00:00`);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 60_000,
  });
}

function usePendingLabs() {
  return useQuery({
    queryKey: ["dashboard-pending-labs"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("lab_orders")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      if (error) throw error;
      return count ?? 0;
    },
    refetchInterval: 60_000,
  });
}

function useRevenueToday() {
  return useQuery({
    queryKey: ["dashboard-revenue-today"],
    queryFn: async () => {
      const today = todayISO();
      const { data, error } = await supabase
        .from("invoices")
        .select("amount_paid, insurance_covered, total_due, balance")
        .gte("created_at", `${today}T00:00:00+00:00`)
        .lte("created_at", `${today}T23:59:59+00:00`);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 60_000,
  });
}

function useClaimsQueue() {
  return useQuery({
    queryKey: ["dashboard-claims-queue"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dha_outbound_queue")
        .select("status, queue_type");
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 60_000,
  });
}

function useLowStock() {
  return useQuery({
    queryKey: ["dashboard-low-stock"],
    queryFn: async () => {
      const { data } = await supabase
        .from("stock_items")
        .select("id, current_quantity, reorder_level")
        .gt("reorder_level", 0);
      return (data ?? []).filter((i) => (i.current_quantity ?? 0) <= (i.reorder_level ?? 0)).length;
    },
    refetchInterval: 60_000,
  });
}

type AdmissionRow = { id: string; ward_id: string | null; wards: { name: string } | null };
type BedRow = {
  id: string;
  status: string | null;
  ward_id: string | null;
  wards: { name: string } | null;
};

function useInpatientCensus() {
  return useQuery({
    queryKey: ["dashboard-inpatient-census"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admissions")
        .select("id,ward_id,wards(name)")
        .eq("status", "admitted");
      if (error) throw error;
      return (data ?? []) as AdmissionRow[];
    },
    refetchInterval: 60_000,
  });
}

function useBedCounts() {
  return useQuery({
    queryKey: ["dashboard-bed-counts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("beds").select("id,status,ward_id,wards(name)");
      if (error) throw error;
      return (data ?? []) as BedRow[];
    },
    refetchInterval: 60_000,
  });
}

function useMortuaryCensus() {
  return useQuery({
    queryKey: ["dashboard-mortuary-census"],
    queryFn: async () => {
      const { count, error } = await db
        .from("mortuary_records")
        .select("id", { count: "exact", head: true })
        .eq("status", "stored");
      if (error) throw error;
      return count ?? 0;
    },
    refetchInterval: 60_000,
  });
}

type SystemHealth = {
  lastCronRunAt: string | null;
  lastCronStatus: string | null;
  cronError: string | null;
  postmasterStartedAt: string | null;
  postmasterError: string | null;
  activeAdmissions: number;
  outstandingInvoices: number;
};

type SchemaClient = {
  schema: (schema: string) => {
    from: typeof db.from;
  };
};

function postmasterStartFrom(data: unknown): string | null {
  if (typeof data === "string") return data;
  if (data && typeof data === "object" && "pg_postmaster_start_time" in data) {
    const value = (data as { pg_postmaster_start_time?: unknown }).pg_postmaster_start_time;
    return typeof value === "string" ? value : null;
  }
  return null;
}

function useSystemHealth() {
  return useQuery({
    queryKey: ["dashboard-system-health"],
    queryFn: async (): Promise<SystemHealth> => {
      const health: SystemHealth = {
        lastCronRunAt: null,
        lastCronStatus: null,
        cronError: null,
        postmasterStartedAt: null,
        postmasterError: null,
        activeAdmissions: 0,
        outstandingInvoices: 0,
      };

      const cronClient = (supabase as unknown as SchemaClient).schema("cron");
      const cronResult = await cronClient
        .from<
          {
            start_time: string | null;
            end_time: string | null;
            status: string | null;
          }[]
        >("job_run_details")
        .select("start_time,end_time,status")
        .order("start_time", { ascending: false })
        .limit(1);
      if (cronResult.error) {
        health.cronError = cronResult.error.message;
      } else {
        const lastRun = cronResult.data?.[0];
        health.lastCronRunAt = lastRun?.end_time ?? lastRun?.start_time ?? null;
        health.lastCronStatus = lastRun?.status ?? null;
      }

      const postmasterResult = await db.rpc<unknown>("pg_postmaster_start_time");
      if (postmasterResult.error) {
        health.postmasterError = postmasterResult.error.message;
      } else {
        health.postmasterStartedAt = postmasterStartFrom(postmasterResult.data);
      }

      const { count: activeAdmissions, error: activeAdmissionsError } = await supabase
        .from("admissions")
        .select("id", { count: "exact", head: true })
        .eq("status", "admitted");
      if (activeAdmissionsError) throw activeAdmissionsError;
      health.activeAdmissions = activeAdmissions ?? 0;

      const { count: outstandingInvoices, error: outstandingInvoicesError } = await supabase
        .from("invoices")
        .select("id", { count: "exact", head: true })
        .gt("balance", 0);
      if (outstandingInvoicesError) throw outstandingInvoicesError;
      health.outstandingInvoices = outstandingInvoices ?? 0;

      return health;
    },
    refetchInterval: 60_000,
  });
}

function formatHealthDate(value: string | null) {
  if (!value) return "Unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return format(date, "dd MMM yyyy, HH:mm");
}

// ─── Main component ──────────────────────────────────────────────────────────

function Dashboard() {
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO());

  // Operational queries
  const { data: encounters, isLoading: loadingEncounters } = useTodayEncounters();
  const { data: pendingLabs, isLoading: loadingLabs } = usePendingLabs();
  const { data: invoices, isLoading: loadingRevenue } = useRevenueToday();
  const { data: claimsQueue, isLoading: loadingClaims } = useClaimsQueue();
  const { data: lowStock, isLoading: loadingStock } = useLowStock();
  const { data: admissions, isLoading: loadingAdmissions } = useInpatientCensus();
  const { data: beds, isLoading: loadingBeds } = useBedCounts();
  const { data: mortuaryStored, isLoading: loadingMortuary } = useMortuaryCensus();
  const { data: systemHealth, isLoading: loadingSystemHealth } = useSystemHealth();

  // MOH queries (existing — unchanged)
  const { data: diseases, isLoading: loadingDiseases } = useQuery({
    queryKey: ["dashboard-top-diseases", from, to],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("dashboard_top_diseases", {
        p_start: from,
        p_end: to,
      });
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: opd, isLoading: loadingOpd } = useQuery({
    queryKey: ["dashboard-opd-attendance", from, to],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("dashboard_opd_attendance", {
        p_start: from,
        p_end: to,
      });
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: trend, isLoading: loadingTrend } = useQuery({
    queryKey: ["dashboard-admitted-opd-trend", from, to],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("dashboard_admitted_opd_trend", {
        p_start: from,
        p_end: to,
      });
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: emergencyReferrals, isLoading: loadingEmergencyReferrals } = useQuery({
    queryKey: ["dashboard-emergency-referrals", from, to],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("dashboard_emergency_referrals", {
        p_start: from,
        p_end: to,
      });
      if (error) throw error;
      return data?.[0] ?? { emergency_count: 0, referrals_in: 0, referrals_out: 0 };
    },
  });

  // ── Derived — patient flow ────────────────────────────────────────────────
  const totalToday = (encounters ?? []).length;
  const phfToday = (encounters ?? []).filter((e) => e.sha_fund_type === "phf").length;
  const shifToday = (encounters ?? []).filter((e) => e.sha_fund_type === "shif").length;
  const eccifToday = (encounters ?? []).filter((e) => e.sha_fund_type === "eccif").length;
  const privateToday = (encounters ?? []).filter((e) => e.sha_fund_type === null).length;

  // ── Derived — revenue ─────────────────────────────────────────────────────
  const totalCollected = (invoices ?? []).reduce((s, i) => s + Number(i.amount_paid ?? 0), 0);
  const insuranceCovered = (invoices ?? []).reduce(
    (s, i) => s + Number(i.insurance_covered ?? 0),
    0,
  );
  const cashCollected = (invoices ?? []).reduce(
    (s, i) => s + Number(i.amount_paid ?? 0) - Number(i.insurance_covered ?? 0),
    0,
  );
  const outstanding = (invoices ?? []).reduce((s, i) => s + Number(i.balance ?? 0), 0);

  // ── Derived — claims ──────────────────────────────────────────────────────
  const pendingClaims = (claimsQueue ?? []).filter((q) => q.status === "pending").length;
  const failedClaims = (claimsQueue ?? []).filter((q) => q.status === "failed").length;
  const sentClaims = (claimsQueue ?? []).filter(
    (q) => q.status === "sent" || q.status === "acknowledged",
  ).length;

  // ── Derived — MOH charts ──────────────────────────────────────────────────
  const under5 = (diseases ?? [])
    .filter((d) => d.age_band === "under5")
    .map((d) => ({ name: d.icd11_title, count: Number(d.disease_count) }));
  const over5 = (diseases ?? [])
    .filter((d) => d.age_band === "over5")
    .map((d) => ({ name: d.icd11_title, count: Number(d.disease_count) }));
  const opdUnder5 = Number(opd?.find((o) => o.age_band === "under5")?.attendance_count ?? 0);
  const opdOver5 = Number(opd?.find((o) => o.age_band === "over5")?.attendance_count ?? 0);
  const trendData = (trend ?? []).map((t) => ({
    day: format(new Date(t.day), "dd MMM"),
    Admitted: Number(t.admitted_count),
    OPD: Number(t.opd_count),
  }));

  const loading =
    loadingEncounters || loadingLabs || loadingRevenue || loadingClaims || loadingStock;

  // ── Derived — inpatient census ────────────────────────────────────────────
  const totalInpatients = (admissions ?? []).length;
  const bedsOccupied = (beds ?? []).filter((b) => b.status === "occupied").length;
  const bedsAvailable = (beds ?? []).filter((b) => b.status === "available").length;
  const bedsTotal = (beds ?? []).length;
  const loadingCensus = loadingAdmissions || loadingBeds;

  // ── Derived — ward census breakdown ──────────────────────────────────────
  const wardCensus = (() => {
    const wardMap = new Map<
      string,
      { wardId: string; name: string; inpatients: number; occupied: number; total: number }
    >();
    (beds ?? []).forEach((b) => {
      if (!b.ward_id) return;
      if (!wardMap.has(b.ward_id))
        wardMap.set(b.ward_id, {
          wardId: b.ward_id,
          name: b.wards?.name ?? b.ward_id,
          inpatients: 0,
          occupied: 0,
          total: 0,
        });
      const e = wardMap.get(b.ward_id)!;
      e.total += 1;
      if (b.status === "occupied") e.occupied += 1;
    });
    (admissions ?? []).forEach((a) => {
      if (!a.ward_id) return;
      if (!wardMap.has(a.ward_id))
        wardMap.set(a.ward_id, {
          wardId: a.ward_id,
          name: a.wards?.name ?? a.ward_id,
          inpatients: 0,
          occupied: 0,
          total: 0,
        });
      const e = wardMap.get(a.ward_id)!;
      e.inpatients += 1;
      if (a.wards?.name) e.name = a.wards.name;
    });
    return Array.from(wardMap.values())
      .filter((w) => w.inpatients > 0 || w.total > 0)
      .sort((a, b) => b.inpatients - a.inpatients || a.name.localeCompare(b.name));
  })();

  return (
    <div className="space-y-8">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {format(new Date(), "EEEE, d MMMM yyyy")} — live facility snapshot
        </p>
      </div>

      {/* ── Section 1: Patient Flow Today ───────────────────────────────── */}
      <section className="space-y-3">
        <SectionLabel icon={Users} label="Patient Flow — Today" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <OpCard label="Total Patients" value={loading ? "—" : totalToday} accent="primary" />
          <OpCard
            label="PHF (Outpatient SHA)"
            value={loading ? "—" : phfToday}
            accent="blue"
            sub="Level 2-3 capitation"
          />
          <OpCard
            label="SHIF (Inpatient)"
            value={loading ? "—" : shifToday}
            accent="green"
            sub="Inpatient / specialist"
          />
          <OpCard
            label="ECCIF (Emergency)"
            value={loading ? "—" : eccifToday}
            accent="amber"
            sub="Emergency / ICU"
          />
          <OpCard
            label="Private / Cash"
            value={loading ? "—" : privateToday}
            accent="muted"
            sub="Non-SHA"
          />
        </div>
      </section>

      {/* ── Section 2: Operational Alerts ───────────────────────────────── */}
      <section className="space-y-3">
        <SectionLabel icon={AlertTriangle} label="Operational Alerts" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <AlertCard
            icon={FlaskConical}
            label="Pending Labs"
            value={loadingLabs ? "—" : (pendingLabs ?? 0)}
            severity={(pendingLabs ?? 0) > 10 ? "high" : (pendingLabs ?? 0) > 0 ? "medium" : "ok"}
          />
          <AlertCard
            icon={Package}
            label="Low Stock Items"
            value={loadingStock ? "—" : (lowStock ?? 0)}
            severity={(lowStock ?? 0) > 5 ? "high" : (lowStock ?? 0) > 0 ? "medium" : "ok"}
          />
          <AlertCard
            icon={Clock}
            label="Pending Claims"
            value={loadingClaims ? "—" : pendingClaims}
            severity={pendingClaims > 20 ? "high" : pendingClaims > 0 ? "medium" : "ok"}
          />
          <AlertCard
            icon={AlertTriangle}
            label="Failed Claims"
            value={loadingClaims ? "—" : failedClaims}
            severity={failedClaims > 0 ? "high" : "ok"}
          />
        </div>
      </section>

      {/* ── Section 3: System Health ─────────────────────────────────────── */}
      <section className="space-y-3">
        <SectionLabel icon={Database} label="System Health" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <OpCard
            label="Last Cron Job Run"
            value={
              loadingSystemHealth ? "—" : formatHealthDate(systemHealth?.lastCronRunAt ?? null)
            }
            accent={systemHealth?.cronError ? "amber" : "primary"}
            sub={systemHealth?.cronError ?? systemHealth?.lastCronStatus ?? undefined}
          />
          <OpCard
            label="DB Postmaster Start"
            value={
              loadingSystemHealth
                ? "—"
                : formatHealthDate(systemHealth?.postmasterStartedAt ?? null)
            }
            accent={systemHealth?.postmasterError ? "amber" : "green"}
            sub={systemHealth?.postmasterError ?? "Overnight pause check"}
          />
          <OpCard
            label="Active Admissions"
            value={loadingSystemHealth ? "—" : (systemHealth?.activeAdmissions ?? 0)}
            accent="blue"
          />
          <OpCard
            label="Outstanding Invoices"
            value={loadingSystemHealth ? "—" : (systemHealth?.outstandingInvoices ?? 0)}
            accent={(systemHealth?.outstandingInvoices ?? 0) > 0 ? "amber" : "ok"}
          />
        </div>
      </section>

      {/* ── Section 4: Revenue Today ─────────────────────────────────────── */}
      <section className="space-y-3">
        <SectionLabel icon={TrendingUp} label="Revenue — Today" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <RevenueCard
            label="Total Collected"
            value={loadingRevenue ? "—" : formatKES(totalCollected)}
            icon={Banknote}
            accent="primary"
          />
          <RevenueCard
            label="SHA / Insurance"
            value={loadingRevenue ? "—" : formatKES(insuranceCovered)}
            icon={ShieldCheck}
            accent="green"
          />
          <RevenueCard
            label="Cash Collected"
            value={loadingRevenue ? "—" : formatKES(Math.max(0, cashCollected))}
            icon={Banknote}
            accent="blue"
          />
          <RevenueCard
            label="Outstanding Balance"
            value={loadingRevenue ? "—" : formatKES(outstanding)}
            icon={AlertTriangle}
            accent={outstanding > 0 ? "amber" : "ok"}
          />
        </div>
      </section>

      {/* ── Section 4: Claims Queue Summary ─────────────────────────────── */}
      <section className="space-y-3">
        <SectionLabel icon={Radio} label="Claims Queue" />
        <div className="grid gap-4 sm:grid-cols-3">
          <OpCard label="Pending" value={loadingClaims ? "—" : pendingClaims} accent="amber" />
          <OpCard
            label="Sent / Acknowledged"
            value={loadingClaims ? "—" : sentClaims}
            accent="green"
          />
          <OpCard
            label="Failed"
            value={loadingClaims ? "—" : failedClaims}
            accent={failedClaims > 0 ? "red" : "muted"}
          />
        </div>
      </section>

      {/* ── Section 5: Inpatient Census ─────────────────────────────────── */}
      <section className="space-y-3">
        <SectionLabel icon={BedDouble} label="Inpatient Census — Live" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <OpCard
            label="Total Inpatients"
            value={loadingCensus ? "—" : totalInpatients}
            accent="primary"
          />
          <OpCard
            label="Beds Occupied"
            value={loadingCensus ? "—" : bedsOccupied}
            accent="amber"
            sub={
              bedsTotal > 0
                ? `${Math.round((bedsOccupied / bedsTotal) * 100)}% occupancy`
                : undefined
            }
          />
          <OpCard
            label="Beds Available"
            value={loadingCensus ? "—" : bedsAvailable}
            accent="green"
          />
          <AlertCard
            icon={Archive}
            label="Mortuary — Stored"
            value={loadingMortuary ? "—" : (mortuaryStored ?? 0)}
            severity={(mortuaryStored ?? 0) > 0 ? "medium" : "ok"}
          />
        </div>

        {wardCensus.length > 0 && (
          <div className="overflow-hidden rounded-xl border bg-card">
            <div className="border-b px-4 py-3">
              <h3 className="text-sm font-semibold">Ward Occupancy Breakdown</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2">Ward</th>
                    <th className="px-4 py-2 text-right">Inpatients</th>
                    <th className="px-4 py-2 text-right">Occupied Beds</th>
                    <th className="px-4 py-2 text-right">Total Beds</th>
                    <th className="px-4 py-2 text-right">Occupancy</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {wardCensus.map((w) => (
                    <tr key={w.wardId} className="hover:bg-muted/20">
                      <td className="px-4 py-2 font-medium">{w.name}</td>
                      <td className="px-4 py-2 text-right font-mono">{w.inpatients}</td>
                      <td className="px-4 py-2 text-right font-mono">{w.occupied}</td>
                      <td className="px-4 py-2 text-right font-mono">{w.total}</td>
                      <td className="px-4 py-2 text-right">
                        {w.total > 0 ? (
                          <span
                            className={
                              w.occupied / w.total >= 0.9
                                ? "font-semibold text-red-600"
                                : w.occupied / w.total >= 0.7
                                  ? "text-amber-600"
                                  : "text-emerald-600"
                            }
                          >
                            {Math.round((w.occupied / w.total) * 100)}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* ── Divider ─────────────────────────────────────────────────────── */}
      <div className="border-t pt-2">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-base font-semibold">MOH Analysis</p>
            <p className="text-sm text-muted-foreground">Disease burden and attendance trends</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-md border bg-card px-3 py-2 text-sm"
            />
            <span className="text-muted-foreground">to</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-md border bg-card px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>

      {/* ── Section 5: MOH Charts (unchanged) ───────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <DiseaseChartCard title="Top 10 Diseases under 5" data={under5} loading={loadingDiseases} />
        <DiseaseChartCard title="Top 10 Diseases over 5" data={over5} loading={loadingDiseases} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="General OPD Attendance <5 years" value={loadingOpd ? "—" : opdUnder5} />
        <StatCard label="General OPD Attendance >5 years" value={loadingOpd ? "—" : opdOver5} />
        <StatCard
          label="Number of Emergency Cases Seen"
          value={loadingEmergencyReferrals ? "—" : Number(emergencyReferrals?.emergency_count ?? 0)}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4">
          <StatCard
            label="Total Number of Referrals - IN"
            value={loadingEmergencyReferrals ? "—" : Number(emergencyReferrals?.referrals_in ?? 0)}
          />
          <StatCard
            label="Total Number of Referrals - OUT"
            value={loadingEmergencyReferrals ? "—" : Number(emergencyReferrals?.referrals_out ?? 0)}
          />
        </div>
        <div className="rounded-xl border bg-card p-5 shadow-[var(--shadow-card)] lg:col-span-2">
          <h2 className="mb-3 font-semibold">Admitted/OPD Visits</h2>
          <div className="h-[280px]">
            {loadingTrend ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Loading…
              </div>
            ) : trendData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No visits in this range.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="day" fontSize={12} />
                  <YAxis allowDecimals={false} fontSize={12} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Admitted" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="OPD" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionLabel({ icon: Icon, label }: { icon: typeof Users; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        {label}
      </span>
    </div>
  );
}

type Accent = "primary" | "blue" | "green" | "amber" | "red" | "muted" | "ok";

const accentClasses: Record<Accent, string> = {
  primary: "text-primary",
  blue: "text-blue-600",
  green: "text-emerald-600",
  amber: "text-amber-500",
  red: "text-red-600",
  muted: "text-muted-foreground",
  ok: "text-emerald-600",
};

function OpCard({
  label,
  value,
  accent = "primary",
  sub,
}: {
  label: string;
  value: number | string;
  accent?: Accent;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className={`mt-2 text-3xl font-bold ${accentClasses[accent]}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function AlertCard({
  icon: Icon,
  label,
  value,
  severity,
}: {
  icon: typeof FlaskConical;
  label: string;
  value: number | string;
  severity: "ok" | "medium" | "high";
}) {
  const bg =
    severity === "high"
      ? "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-900"
      : severity === "medium"
        ? "bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900"
        : "bg-card";
  const textColor =
    severity === "high"
      ? "text-red-600"
      : severity === "medium"
        ? "text-amber-600"
        : "text-emerald-600";
  const iconColor =
    severity === "high"
      ? "text-red-500"
      : severity === "medium"
        ? "text-amber-500"
        : "text-emerald-500";
  return (
    <div className={`rounded-xl border p-5 shadow-[var(--shadow-card)] ${bg}`}>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className={`h-4 w-4 ${iconColor}`} />
        {label}
      </div>
      <div className={`mt-2 text-3xl font-bold ${textColor}`}>{value}</div>
    </div>
  );
}

function RevenueCard({
  icon: Icon,
  label,
  value,
  accent = "primary",
}: {
  icon: typeof Banknote;
  label: string;
  value: string;
  accent?: Accent;
}) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <div className={`mt-2 text-2xl font-bold ${accentClasses[accent]}`}>{value}</div>
    </div>
  );
}

function StatCard({
  label,
  value,
  notTracked,
}: {
  label: string;
  value: number | string;
  notTracked?: boolean;
}) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        {label}
        {notTracked && (
          <span title="Not yet tracked — no data source exists for this metric yet">
            <HelpCircle className="h-3.5 w-3.5" />
          </span>
        )}
      </div>
      <div className="mt-2 text-3xl font-bold">{value}</div>
    </div>
  );
}

function DiseaseChartCard({
  title,
  data,
  loading,
}: {
  title: string;
  data: { name: string; count: number }[];
  loading: boolean;
}) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-[var(--shadow-card)]">
      <h2 className="mb-3 font-semibold">{title}</h2>
      <div className="h-[280px]">
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Loading…
          </div>
        ) : data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No diagnoses in this range.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ left: 24 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" allowDecimals={false} fontSize={12} />
              <YAxis type="category" dataKey="name" width={140} fontSize={11} />
              <Tooltip />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
