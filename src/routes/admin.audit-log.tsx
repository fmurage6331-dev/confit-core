/**
 * LabTrack — Audit log viewer (admin only, read-only).
 */
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/lib/supabase-untyped";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/lib/auth-context";
import { AccessDenied } from "@/lib/require-access";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ShieldCheck, Printer } from "lucide-react";
import { format } from "date-fns";
import { PrintHeader } from "@/components/print-header";

export const Route = createFileRoute("/admin/audit-log")({
  component: () => (
    <AppShell>
      <AuditGate />
    </AppShell>
  ),
});

function AuditGate() {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <AccessDenied message="Only admins can view the audit log." />;
  return <AuditLogView />;
}

type Row = {
  id: string;
  table_name: string;
  record_id: string | null;
  action: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  changed_by: string | null;
  changed_at: string;
  display_name?: string;
};

function AuditLogView() {
  const [tableFilter, setTableFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [nameFilter, setNameFilter] = useState("");
  const [open, setOpen] = useState<Row | null>(null);

  const tablesQ = useQuery({
    queryKey: ["audit-tables"],
    queryFn: async () => {
      const { data, error } = await supabase.from("audit_log").select("table_name").limit(1000);
      if (error) throw error;
      return Array.from(new Set((data ?? []).map((r) => r.table_name as string))).sort();
    },
  });

  const rowsQ = useQuery({
    queryKey: ["audit-rows", tableFilter, actionFilter, from, to],
    queryFn: async () => {
      let q = supabase
        .from("audit_log")
        .select("id,table_name,record_id,action,old_data,new_data,changed_by,changed_at")
        .order("changed_at", { ascending: false })
        .limit(500);
      if (tableFilter !== "all") q = q.eq("table_name", tableFilter);
      if (actionFilter !== "all") q = q.eq("action", actionFilter);
      if (from) q = q.gte("changed_at", new Date(from).toISOString());
      if (to) q = q.lte("changed_at", new Date(to + "T23:59:59").toISOString());
      const { data, error } = await q;
      if (error) throw error;

      // Resolve display names for unique user IDs
      const rows = (data ?? []) as unknown as Row[];
      const uniqueIds = Array.from(
        new Set(rows.map((r) => r.changed_by).filter(Boolean) as string[]),
      );

      if (uniqueIds.length > 0) {
        const { data: profiles } = await db
          .from<{ id: string; first_name: string; last_name: string; username: string }>("profiles")
          .select("id,first_name,last_name,username")
          .in("id", uniqueIds);

        const nameMap = new Map<string, string>();
        (Array.isArray(profiles) ? profiles : profiles ? [profiles] : []).forEach((p) => {
          nameMap.set(p.id, `${p.first_name} ${p.last_name} (@${p.username})`);
        });

        return rows.map((r) => ({
          ...r,
          display_name: r.changed_by
            ? (nameMap.get(r.changed_by) ?? r.changed_by.slice(0, 8))
            : "—",
        }));
      }

      return rows.map((r) => ({
        ...r,
        display_name: r.changed_by ? r.changed_by.slice(0, 8) : "—",
      }));
    },
  });

  // Client-side filter by name
  const filtered = useMemo(() => {
    const rows = rowsQ.data ?? [];
    if (!nameFilter.trim()) return rows;
    const q = nameFilter.toLowerCase();
    return rows.filter((r) => r.display_name?.toLowerCase().includes(q));
  }, [rowsQ.data, nameFilter]);

  function handlePrint() {
    window.print();
  }

  return (
    <div className="space-y-6">
      {/* Screen header */}
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Audit log</h1>
            <p className="text-sm text-muted-foreground">
              Read-only change history across the system.
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={handlePrint}>
          <Printer className="mr-2 h-4 w-4" />
          Print report
        </Button>
      </div>

      {/* Print header */}
      <div className="hidden print:block mb-4">
        <PrintHeader
          title="Audit Log Report"
          subtitle={
            [
              tableFilter !== "all" ? `Table: ${tableFilter}` : null,
              actionFilter !== "all" ? `Action: ${actionFilter}` : null,
              from ? `From: ${from}` : null,
              to ? `To: ${to}` : null,
              nameFilter ? `User: ${nameFilter}` : null,
            ]
              .filter(Boolean)
              .join(" · ") || undefined
          }
        />
      </div>

      {/* Filters */}
      <div className="grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-5 print:hidden">
        <div>
          <Label>Table</Label>
          <Select value={tableFilter} onValueChange={setTableFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tables</SelectItem>
              {(tablesQ.data ?? []).map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Action</Label>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="INSERT">INSERT</SelectItem>
              <SelectItem value="UPDATE">UPDATE</SelectItem>
              <SelectItem value="DELETE">DELETE</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>From</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <Label>To</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div>
          <Label>Changed by (name)</Label>
          <Input
            value={nameFilter}
            onChange={(e) => setNameFilter(e.target.value)}
            placeholder="Search by name…"
          />
        </div>
      </div>

      {/* Results count */}
      {!rowsQ.isLoading && (
        <p className="text-xs text-muted-foreground print:hidden">
          Showing {filtered.length} of {rowsQ.data?.length ?? 0} entries
        </p>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border bg-card shadow-[var(--shadow-card)]">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-medium">When</th>
              <th className="px-4 py-3 text-left font-medium">Table</th>
              <th className="px-4 py-3 text-left font-medium">Action</th>
              <th className="px-4 py-3 text-left font-medium">Record</th>
              <th className="px-4 py-3 text-left font-medium">Changed by</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rowsQ.isLoading && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            )}
            {rowsQ.error && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-rose-600">
                  {(rowsQ.error as Error).message}
                </td>
              </tr>
            )}
            {!rowsQ.isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  No entries.
                </td>
              </tr>
            )}
            {filtered.map((r) => (
              <tr
                key={r.id}
                className="hover:bg-accent/40 cursor-pointer print:cursor-default"
                onClick={() => setOpen(r)}
              >
                <td className="px-4 py-3 whitespace-nowrap text-xs">
                  {format(new Date(r.changed_at), "dd MMM yyyy, HH:mm:ss")}
                </td>
                <td className="px-4 py-3 font-mono text-xs">{r.table_name}</td>
                <td className="px-4 py-3">
                  <Badge
                    variant={
                      r.action === "DELETE"
                        ? "destructive"
                        : r.action === "INSERT"
                          ? "default"
                          : "outline"
                    }
                  >
                    {r.action}
                  </Badge>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                  {r.record_id?.slice(0, 8) ?? "—"}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{r.display_name ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Diff dialog — screen only */}
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col print:hidden">
          <DialogHeader>
            <DialogTitle>
              {open?.action} on {open?.table_name} · {open?.record_id?.slice(0, 8)}
              <span className="ml-3 text-sm font-normal text-muted-foreground">
                by {open?.display_name} ·{" "}
                {open && format(new Date(open.changed_at), "dd MMM yyyy, HH:mm:ss")}
              </span>
            </DialogTitle>
          </DialogHeader>
          {open && <DiffView row={open} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DiffView({ row }: { row: Row }) {
  const keys = useMemo(() => {
    const s = new Set<string>();
    Object.keys(row.old_data ?? {}).forEach((k) => s.add(k));
    Object.keys(row.new_data ?? {}).forEach((k) => s.add(k));
    return Array.from(s).sort();
  }, [row]);

  const changed = (k: string) =>
    JSON.stringify((row.old_data ?? {})[k]) !== JSON.stringify((row.new_data ?? {})[k]);

  return (
    <div className="flex-1 overflow-y-auto rounded-md border">
      <table className="w-full text-xs">
        <thead className="bg-muted/50 text-left uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Field</th>
            <th className="px-3 py-2 font-medium">Old</th>
            <th className="px-3 py-2 font-medium">New</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {keys.map((k) => {
            const isDiff = changed(k);
            return (
              <tr key={k} className={isDiff ? "bg-amber-50/50 dark:bg-amber-900/10" : ""}>
                <td className="px-3 py-2 font-mono">{k}</td>
                <td className="px-3 py-2 font-mono whitespace-pre-wrap break-all text-rose-700 dark:text-rose-300">
                  {fmtVal((row.old_data ?? {})[k])}
                </td>
                <td className="px-3 py-2 font-mono whitespace-pre-wrap break-all text-emerald-700 dark:text-emerald-300">
                  {fmtVal((row.new_data ?? {})[k])}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function fmtVal(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}
