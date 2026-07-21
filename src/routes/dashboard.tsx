/**
 * LabTrack — Laboratory Records
 * Copyright (c) 2026 Francis Muhoro. All rights reserved.
 * Author: Francis Muhoro
 */

import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { useState } from "react";
import { format } from "date-fns";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { HelpCircle } from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  component: () => <AppShell><Dashboard /></AppShell>,
});

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function Dashboard() {
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO());

  const { data: diseases, isLoading: loadingDiseases } = useQuery({
    queryKey: ["dashboard-top-diseases", from, to],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("dashboard_top_diseases", { p_start: from, p_end: to });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: opd, isLoading: loadingOpd } = useQuery({
    queryKey: ["dashboard-opd-attendance", from, to],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("dashboard_opd_attendance", { p_start: from, p_end: to });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: trend, isLoading: loadingTrend } = useQuery({
    queryKey: ["dashboard-admitted-opd-trend", from, to],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("dashboard_admitted_opd_trend", { p_start: from, p_end: to });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: emergencyReferrals, isLoading: loadingEmergencyReferrals } = useQuery({
    queryKey: ["dashboard-emergency-referrals", from, to],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("dashboard_emergency_referrals", { p_start: from, p_end: to });
      if (error) throw error;
      return data?.[0] ?? { emergency_count: 0, referrals_in: 0, referrals_out: 0 };
    },
  });

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

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Facility activity overview.</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="rounded-md border bg-card px-3 py-2 text-sm" />
          <span className="text-muted-foreground">to</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="rounded-md border bg-card px-3 py-2 text-sm" />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <DiseaseChartCard title="Top 10 Diseases under 5" data={under5} loading={loadingDiseases} />
        <DiseaseChartCard title="Top 10 Diseases over 5" data={over5} loading={loadingDiseases} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="General OPD Attendance <5 years" value={loadingOpd ? "—" : opdUnder5} />
        <StatCard label="General OPD Attendance >5 years" value={loadingOpd ? "—" : opdOver5} />
        <StatCard label="Number of Emergency Cases Seen" value={loadingEmergencyReferrals ? "—" : Number(emergencyReferrals?.emergency_count ?? 0)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4">
          <StatCard label="Total Number of Referrals - IN" value={loadingEmergencyReferrals ? "—" : Number(emergencyReferrals?.referrals_in ?? 0)} />
          <StatCard label="Total Number of Referrals - OUT" value={loadingEmergencyReferrals ? "—" : Number(emergencyReferrals?.referrals_out ?? 0)} />
        </div>
        <div className="rounded-xl border bg-card p-5 shadow-[var(--shadow-card)] lg:col-span-2">
          <h2 className="mb-3 font-semibold">Admitted/OPD Visits</h2>
          <div className="h-[280px]">
            {loadingTrend ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading…</div>
            ) : trendData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No visits in this range.</div>
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

function StatCard({ label, value, notTracked }: { label: string; value: number | string; notTracked?: boolean }) {
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

function DiseaseChartCard({ title, data, loading }: { title: string; data: { name: string; count: number }[]; loading: boolean }) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-[var(--shadow-card)]">
      <h2 className="mb-3 font-semibold">{title}</h2>
      <div className="h-[280px]">
        {loading ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading…</div>
        ) : data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No diagnoses in this range.</div>
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
