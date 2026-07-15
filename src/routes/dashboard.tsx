/**
 * LabTrack — Laboratory Records
 * Copyright (c) 2026 Francis Muhoro. All rights reserved.
 * Author: Francis Muhoro
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { ListPlus, Activity, Users, Calendar } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/dashboard")({
  component: () => <AppShell><Dashboard /></AppShell>,
});

function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const [{ count: total }, { count: todayCount }, { data: recent }] = await Promise.all([
        supabase.from("lab_tests").select("*", { count: "exact", head: true }),
        supabase.from("lab_tests").select("*", { count: "exact", head: true }).gte("test_date", today.toISOString().slice(0, 10)),
        supabase.from("lab_tests").select("id, patient_name, test_name, lab_number, test_date, result").order("created_at", { ascending: false }).limit(8),
      ]);
      const uniquePatients = new Set((recent ?? []).map(r => r.patient_name.toLowerCase())).size;
      return { total: total ?? 0, todayCount: todayCount ?? 0, recent: recent ?? [], uniquePatients };
    },
  });

  const stats = [
    { label: "Total tests", value: data?.total ?? 0, icon: Activity },
    { label: "Today", value: data?.todayCount ?? 0, icon: Calendar },
    { label: "Recent patients", value: data?.uniquePatients ?? 0, icon: Users },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Overview of laboratory activity.</p>
        </div>
        <Button asChild><Link to="/records/new"><ListPlus className="mr-2 h-4 w-4" />New service</Link></Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-xl border bg-card p-5 shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{label}</span>
              <Icon className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-2 text-3xl font-bold">{isLoading ? "—" : value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border bg-card shadow-[var(--shadow-card)]">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="font-semibold">Recent records</h2>
          <Link to="/records" className="text-sm font-medium text-primary hover:underline">View all</Link>
        </div>
        <div className="divide-y">
          {isLoading && <div className="p-5 text-sm text-muted-foreground">Loading…</div>}
          {!isLoading && data?.recent.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">No records yet. Add your first test.</div>
          )}
          {data?.recent.map((r) => (
            <Link key={r.id} to="/records/$id" params={{ id: r.id }}
              className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-accent/30">
              <div className="min-w-0">
                <div className="truncate font-medium">{r.patient_name}</div>
                <div className="truncate text-sm text-muted-foreground">{r.test_name} · Lab #{r.lab_number}</div>
              </div>
              <div className="text-right text-sm text-muted-foreground">
                <div>{format(new Date(r.test_date), "dd MMM yyyy")}</div>
                <div className={`text-xs ${r.result ? "text-success" : "text-muted-foreground"}`}>{r.result ? "Result recorded" : "Pending"}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}