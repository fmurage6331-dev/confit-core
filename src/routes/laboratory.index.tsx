/**
 * LabTrack — Laboratory worklist.
 * Order-driven queue (mirrors radiology.index.tsx / radiology.$id.tsx),
 * grouped by patient the way reception/lab techs think about a visit.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { Fragment, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { PermGuard } from "@/lib/require-access";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FlaskConical, Search, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/laboratory/")({
  component: () => (
    <AppShell>
      <PermGuard perm="lab_view">
        <LaboratoryWorklist />
      </PermGuard>
    </AppShell>
  ),
});

type Tab = "ordered" | "in_progress" | "completed" | "declined";

type Row = {
  id: string;
  order_number: string | null;
  status: string | null;
  priority: string | null;
  instructions: string | null;
  ordered_at: string;
  patient_id: string | null;
  encounter_id: string | null;
  patients: {
    patient_name: string | null;
    file_number: string | null;
    sex: string | null;
    estimated_age: number | null;
  } | null;
  lab_test_catalog: { name: string | null; category: string | null } | null;
  rooms: { name: string | null } | null;
};

function StatusBadge({ s }: { s: string | null }) {
  const cls =
    s === "completed"
      ? "bg-emerald-100 text-emerald-700"
      : s === "in_progress"
        ? "bg-blue-100 text-blue-700"
        : s === "declined"
          ? "bg-rose-100 text-rose-700"
          : "bg-amber-100 text-amber-700";
  const label = s === "ordered" ? "Order not picked" : (s ?? "ordered").replace("_", " ");
  return <Badge className={`${cls} hover:${cls}`}>{label}</Badge>;
}

function PriorityBadge({ p }: { p: string | null }) {
  const cls =
    p === "stat"
      ? "bg-rose-100 text-rose-700"
      : p === "urgent"
        ? "bg-orange-100 text-orange-700"
        : "bg-emerald-100 text-emerald-700";
  return (
    <Badge className={`${cls} hover:${cls}`}>
      {p ? p[0].toUpperCase() + p.slice(1) : "Routine"}
    </Badge>
  );
}

function LaboratoryWorklist() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<Tab>("ordered");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [from, setFrom] = useState(new Date().toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));

  const { data, isLoading, error } = useQuery({
    queryKey: ["lab-orders", from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lab_orders")
        .select(
          "id,order_number,status,priority,instructions,ordered_at,patient_id,encounter_id,patients(patient_name,file_number,sex,estimated_age),lab_test_catalog(name,category),rooms(name)",
        )
        .gte("ordered_at", `${from}T00:00:00`)
        .lte("ordered_at", `${to}T23:59:59`)
        .order("ordered_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const decline = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { error } = await supabase
        .from("lab_orders")
        .update({ status: "declined", decline_reason: reason || null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lab request declined");
      qc.invalidateQueries({ queryKey: ["lab-orders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pickUp = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("lab_orders")
        .update({ status: "in_progress" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lab-orders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const counts = useMemo(() => {
    const rows = data ?? [];
    return {
      ordered: rows.filter((r) => r.status === "ordered").length,
      in_progress: rows.filter((r) => r.status === "in_progress").length,
      completed: rows.filter((r) => r.status === "completed").length,
      declined: rows.filter((r) => r.status === "declined").length,
    };
  }, [data]);

  const filtered = useMemo(() => {
    const rows = data ?? [];
    const ql = q.trim().toLowerCase();
    return rows.filter((r) => {
      if ((r.status ?? "ordered") !== tab) return false;
      if (!ql) return true;
      return (
        (r.patients?.patient_name ?? "").toLowerCase().includes(ql) ||
        (r.patients?.file_number ?? "").toLowerCase().includes(ql) ||
        (r.lab_test_catalog?.name ?? "").toLowerCase().includes(ql)
      );
    });
  }, [data, q, tab]);

  const grouped = useMemo(() => {
    const g = new Map<
      string,
      { patient: Row["patients"]; patientId: string | null; rows: Row[] }
    >();
    for (const r of filtered) {
      const key = r.patient_id ?? r.id;
      if (!g.has(key)) g.set(key, { patient: r.patients, patientId: r.patient_id, rows: [] });
      g.get(key)!.rows.push(r);
    }
    return Array.from(g.values());
  }, [filtered]);

  function toggle(key: string) {
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <FlaskConical className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Laboratory</h1>
          <p className="text-sm text-muted-foreground">Test orders from all rooms.</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Tests ordered" sub="Orders" value={(data ?? []).length} tone="amber" />
        <StatCard label="Worklist" sub="In progress" value={counts.in_progress} tone="blue" />
        <StatCard label="Results" sub="Completed" value={counts.completed} tone="emerald" />
      </div>

      <div className="flex flex-wrap items-center gap-1 border-b">
        {(
          [
            { key: "ordered", label: "Tests ordered" },
            { key: "in_progress", label: "In progress" },
            { key: "completed", label: "Completed" },
            { key: "declined", label: "Declined tests" },
          ] as { key: Tab; label: string }[]
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`border-b-2 px-4 py-2 text-sm font-medium transition ${
              tab === t.key
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label} <span className="ml-1 text-xs text-muted-foreground">({counts[t.key]})</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Date range:</span>
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-[150px]"
          />
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-[150px]"
          />
        </div>
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search this list…"
            className="pl-9"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-[var(--shadow-card)]">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="w-10 px-4 py-3" />
              <th className="px-4 py-3 text-left font-medium">Patient</th>
              <th className="px-4 py-3 text-left font-medium">Age</th>
              <th className="px-4 py-3 text-left font-medium">Sex</th>
              <th className="px-4 py-3 text-left font-medium">Total orders</th>
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
            {!isLoading && grouped.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  No lab orders match.
                </td>
              </tr>
            )}
            {grouped.map((g) => {
              const key = g.patientId ?? g.rows[0].id;
              const isOpen = expanded.has(key);
              return (
                <Fragment key={key}>
                  <tr className="cursor-pointer hover:bg-accent/40" onClick={() => toggle(key)}>
                    <td className="px-4 py-3">
                      <Button variant="outline" size="icon" className="h-6 w-6">
                        {isOpen ? (
                          <ChevronUp className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </td>
                    <td className="px-4 py-3 font-medium">{g.patient?.patient_name ?? "—"}</td>
                    <td className="px-4 py-3">{g.patient?.estimated_age ?? "—"}</td>
                    <td className="px-4 py-3">{g.patient?.sex ?? "—"}</td>
                    <td className="px-4 py-3">{g.rows.length}</td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={5} className="bg-muted/20 px-4 py-3">
                        <div className="space-y-3">
                          {g.rows.map((r) => (
                            <OrderCard
                              key={r.id}
                              r={r}
                              onDecline={(reason) => decline.mutate({ id: r.id, reason })}
                              onPickUp={() => pickUp.mutate(r.id)}
                            />
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OrderCard({
  r,
  onDecline,
  onPickUp,
}: {
  r: Row;
  onDecline: (reason: string) => void;
  onPickUp: () => void;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        <Field label="Urgency">
          <PriorityBadge p={r.priority} />
        </Field>
        <Field label="Test ordered">
          <Link to="/laboratory/$id" params={{ id: r.id }} className="text-primary hover:underline">
            {r.lab_test_catalog?.name?.toUpperCase() ?? "—"}
          </Link>
        </Field>
        <Field label="Status">
          <StatusBadge s={r.status} />
        </Field>
        <Field label="Order number">{r.order_number ?? "—"}</Field>
        <Field label="Order date">{format(new Date(r.ordered_at), "dd-MMM-yyyy")}</Field>
        <Field label="Ordered by">{r.rooms?.name ?? "—"}</Field>
        <div className="sm:col-span-2">
          <Field label="Instructions">{r.instructions || "NONE"}</Field>
        </div>
      </div>
      {(r.status === "ordered" || r.status === "in_progress") && (
        <div className="mt-3 flex justify-end gap-2 border-t pt-3">
          <button
            className="text-sm text-rose-600 hover:underline"
            onClick={() => {
              const reason = window.prompt("Reason for declining this lab request?") ?? "";
              if (reason.trim()) onDecline(reason.trim());
            }}
          >
            Reject lab request
          </button>
          {r.status === "ordered" ? (
            <Button size="sm" onClick={onPickUp}>
              Pick up
            </Button>
          ) : (
            <Link to="/laboratory/$id" params={{ id: r.id }}>
              <Button size="sm">Enter result</Button>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b py-1 sm:justify-start">
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-medium">{children}</span>
    </div>
  );
}

function StatCard({
  label,
  sub,
  value,
  tone,
}: {
  label: string;
  sub: string;
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
      <div className="mt-1 text-xs text-muted-foreground">{sub}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}
