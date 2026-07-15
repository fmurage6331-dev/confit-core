/**
 * LabTrack — Audit log viewer (admin only, read-only).
 */
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/lib/auth-context";
import { AccessDenied } from "@/lib/require-access";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ShieldCheck } from "lucide-react";
import { format } from "date-fns";

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
};

function AuditLogView() {
  const [tableFilter, setTableFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [changedBy, setChangedBy] = useState("");
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
    queryKey: ["audit-rows", tableFilter, actionFilter, from, to, changedBy],
    queryFn: async () => {
      let q = supabase.from("audit_log")
        .select("id,table_name,record_id,action,old_data,new_data,changed_by,changed_at")
        .order("changed_at", { ascending: false })
        .limit(500);
      if (tableFilter !== "all") q = q.eq("table_name", tableFilter);
      if (actionFilter !== "all") q = q.eq("action", actionFilter);
      if (from) q = q.gte("changed_at", new Date(from).toISOString());
      if (to) q = q.lte("changed_at", new Date(to + "T23:59:59").toISOString());
      if (changedBy.trim()) q = q.eq("changed_by", changedBy.trim());
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Audit log</h1>
          <p className="text-sm text-muted-foreground">Read-only change history across the system.</p>
        </div>
      </div>

      <div className="grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-5">
        <div>
          <Label>Table</Label>
          <Select value={tableFilter} onValueChange={setTableFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tables</SelectItem>
              {(tablesQ.data ?? []).map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Action</Label>
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
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
          <Label>Changed by (user id)</Label>
          <Input value={changedBy} onChange={(e) => setChangedBy(e.target.value)} placeholder="uuid…" />
        </div>
      </div>

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
            {rowsQ.isLoading && <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">Loading…</td></tr>}
            {rowsQ.error && <tr><td colSpan={5} className="px-4 py-10 text-center text-rose-600">{(rowsQ.error as Error).message}</td></tr>}
            {!rowsQ.isLoading && (rowsQ.data ?? []).length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">No entries.</td></tr>
            )}
            {(rowsQ.data ?? []).map((r) => (
              <tr key={r.id} className="hover:bg-accent/40 cursor-pointer" onClick={() => setOpen(r)}>
                <td className="px-4 py-3 whitespace-nowrap">{format(new Date(r.changed_at), "dd MMM yyyy, HH:mm:ss")}</td>
                <td className="px-4 py-3 font-mono text-xs">{r.table_name}</td>
                <td className="px-4 py-3"><Badge variant={r.action === "DELETE" ? "destructive" : "outline"}>{r.action}</Badge></td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{r.record_id?.slice(0, 8) ?? "—"}</td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{r.changed_by?.slice(0, 8) ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {open?.action} on {open?.table_name} · {open?.record_id?.slice(0, 8)}
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
                <td className="px-3 py-2 font-mono whitespace-pre-wrap break-all text-rose-700 dark:text-rose-300">{fmtVal((row.old_data ?? {})[k])}</td>
                <td className="px-3 py-2 font-mono whitespace-pre-wrap break-all text-emerald-700 dark:text-emerald-300">{fmtVal((row.new_data ?? {})[k])}</td>
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
  try { return JSON.stringify(v, null, 2); } catch { return String(v); }
}
