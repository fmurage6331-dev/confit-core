/**
 * LabTrack — Radiology worklist.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { PermGuard } from "@/lib/require-access";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScanLine, Search } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/radiology/")({
  component: () => (
    <AppShell>
      <PermGuard perm="radiology_view">
        <RadiologyWorklist />
      </PermGuard>
    </AppShell>
  ),
});

type Row = {
  id: string;
  status: string | null;
  priority: string | null;
  clinical_indication: string | null;
  ordered_at: string;
  patient_id: string | null;
  encounter_id: string | null;
  patients: { patient_name: string | null; file_number: string | null } | null;
  lab_test_catalog: { name: string | null; category: string | null } | null;
};

function StatusBadge({ s }: { s: string | null }) {
  const cls =
    s === "completed"
      ? "bg-emerald-100 text-emerald-700"
      : s === "in_progress"
        ? "bg-blue-100 text-blue-700"
        : s === "ordered"
          ? "bg-amber-100 text-amber-700"
          : "bg-muted text-muted-foreground";
  return <Badge className={`${cls} hover:${cls}`}>{(s ?? "ordered").replace("_", " ")}</Badge>;
}

function PriorityBadge({ p }: { p: string | null }) {
  if (!p || p === "routine") return <span className="text-xs text-muted-foreground">Routine</span>;
  const cls = p === "stat" ? "bg-rose-100 text-rose-700" : "bg-orange-100 text-orange-700";
  return <Badge className={`${cls} hover:${cls}`}>{p.toUpperCase()}</Badge>;
}

function RadiologyWorklist() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"active" | "all" | "ordered" | "in_progress" | "completed">(
    "active",
  );

  const { data, isLoading, error } = useQuery({
    queryKey: ["radiology-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("radiology_orders")
        .select(
          "id,status,priority,clinical_indication,ordered_at,patient_id,encounter_id,patients(patient_name,file_number),lab_test_catalog(name,category)",
        )
        .order("ordered_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const filtered = useMemo(() => {
    const rows = data ?? [];
    const ql = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (status === "active" && r.status === "completed") return false;
      if (status !== "active" && status !== "all" && r.status !== status) return false;
      if (!ql) return true;
      return (
        (r.patients?.patient_name ?? "").toLowerCase().includes(ql) ||
        (r.patients?.file_number ?? "").toLowerCase().includes(ql) ||
        (r.lab_test_catalog?.name ?? "").toLowerCase().includes(ql)
      );
    });
  }, [data, q, status]);

  const counts = useMemo(() => {
    const rows = data ?? [];
    return {
      ordered: rows.filter((r) => r.status === "ordered").length,
      in_progress: rows.filter((r) => r.status === "in_progress").length,
      completed: rows.filter((r) => r.status === "completed").length,
    };
  }, [data]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <ScanLine className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Radiology worklist</h1>
          <p className="text-sm text-muted-foreground">Imaging orders from all rooms.</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Ordered" value={counts.ordered} tone="amber" />
        <StatCard label="In progress" value={counts.in_progress} tone="blue" />
        <StatCard label="Completed" value={counts.completed} tone="emerald" />
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search patient, file # or scan…"
            className="pl-9"
          />
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active (open)</SelectItem>
            <SelectItem value="ordered">Ordered</SelectItem>
            <SelectItem value="in_progress">In progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-[var(--shadow-card)]">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Ordered</th>
              <th className="px-4 py-3 text-left font-medium">Patient</th>
              <th className="px-4 py-3 text-left font-medium">Scan</th>
              <th className="px-4 py-3 text-left font-medium">Priority</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            )}
            {error && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-rose-600">
                  {(error as Error).message}
                </td>
              </tr>
            )}
            {!isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  No radiology orders match.
                </td>
              </tr>
            )}
            {filtered.map((r) => (
              <tr key={r.id} className="hover:bg-accent/40">
                <td className="px-4 py-3 whitespace-nowrap">
                  <Link
                    to="/radiology/$id"
                    params={{ id: r.id }}
                    className="text-primary hover:underline"
                  >
                    {format(new Date(r.ordered_at), "dd MMM, HH:mm")}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium">{r.patients?.patient_name ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.patients?.file_number ?? ""}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div>{r.lab_test_catalog?.name ?? "—"}</div>
                  {r.clinical_indication && (
                    <div className="text-xs text-muted-foreground line-clamp-1">
                      {r.clinical_indication}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <PriorityBadge p={r.priority} />
                </td>
                <td className="px-4 py-3">
                  <StatusBadge s={r.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "amber" | "blue" | "emerald";
}) {
  const cls =
    tone === "emerald"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : tone === "blue"
        ? "bg-blue-50 text-blue-700 border-blue-200"
        : "bg-amber-50 text-amber-700 border-amber-200";
  return (
    <div className={`rounded-xl border p-4 ${cls}`}>
      <div className="text-xs uppercase tracking-wide">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}
