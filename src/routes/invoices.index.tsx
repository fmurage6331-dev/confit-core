/**
 * LabTrack — Itemized invoices list.
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
import { FileText, Search } from "lucide-react";

export const Route = createFileRoute("/invoices/")({
  component: () => (
    <AppShell>
      <PermGuard perm="accounting">
        <InvoicesList />
      </PermGuard>
    </AppShell>
  ),
});

type Row = {
  id: string;
  invoice_number: string | null;
  status: string | null;
  subtotal: number | null;
  discount: number | null;
  insurance_covered: number | null;
  total_due: number | null;
  amount_paid: number | null;
  balance: number | null;
  created_at: string;
  patient_id: string | null;
  encounter_id: string | null;
  patients: { patient_name: string | null; file_number: string | null } | null;
};

function StatusBadge({ s }: { s: string | null }) {
  const cls =
    s === "paid"
      ? "bg-emerald-100 text-emerald-700"
      : s === "partial"
        ? "bg-blue-100 text-blue-700"
        : s === "unpaid"
          ? "bg-rose-100 text-rose-700"
          : "bg-muted text-muted-foreground";
  return <Badge className={`${cls} hover:${cls}`}>{s ?? "draft"}</Badge>;
}

function InvoicesList() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | "unpaid" | "partial" | "paid" | "draft">("all");

  const { data, isLoading, error } = useQuery({
    queryKey: ["invoices-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select(
          "id,invoice_number,status,subtotal,discount,insurance_covered,total_due,amount_paid,balance,created_at,patient_id,encounter_id,patients(patient_name,file_number)",
        )
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const rows = data ?? [];
  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (status !== "all" && (r.status ?? "draft") !== status) return false;
      if (!q.trim()) return true;
      const needle = q.toLowerCase();
      return (
        (r.invoice_number ?? "").toLowerCase().includes(needle) ||
        (r.patients?.patient_name ?? "").toLowerCase().includes(needle) ||
        (r.patients?.file_number ?? "").toLowerCase().includes(needle)
      );
    });
  }, [rows, q, status]);

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, r) => {
        acc.total += Number(r.total_due ?? 0);
        acc.paid += Number(r.amount_paid ?? 0);
        acc.balance += Number(r.balance ?? 0);
        return acc;
      },
      { total: 0, paid: 0, balance: 0 },
    );
  }, [filtered]);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <FileText className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Invoices</h1>
          <p className="text-sm text-muted-foreground">
            Itemized billing with line items and payment history.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Total billed" value={totals.total} />
        <SummaryCard label="Total paid" value={totals.paid} tone="emerald" />
        <SummaryCard label="Outstanding" value={totals.balance} tone="rose" />
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search invoice #, patient name, or file #"
            className="pl-9"
          />
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="unpaid">Unpaid</SelectItem>
            <SelectItem value="partial">Partial</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Invoice #</th>
              <th className="px-4 py-3">Patient</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-right">Paid</th>
              <th className="px-4 py-3 text-right">Balance</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && error && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-destructive">
                  {error instanceof Error ? error.message : "Failed to load"}
                </td>
              </tr>
            )}
            {!isLoading && !error && filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-muted-foreground">
                  No invoices match.
                </td>
              </tr>
            )}
            {filtered.map((r) => (
              <tr key={r.id} className="hover:bg-accent/40">
                <td className="px-4 py-3 font-mono text-xs">
                  <Link
                    to="/invoices/$id"
                    params={{ id: r.id }}
                    className="text-primary hover:underline"
                  >
                    {r.invoice_number ?? r.id.slice(0, 8)}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium">{r.patients?.patient_name ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.patients?.file_number ?? ""}
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(r.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-right">{Number(r.total_due ?? 0).toFixed(2)}</td>
                <td className="px-4 py-3 text-right text-emerald-700">
                  {Number(r.amount_paid ?? 0).toFixed(2)}
                </td>
                <td className="px-4 py-3 text-right font-medium">
                  {Number(r.balance ?? 0).toFixed(2)}
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

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "emerald" | "rose";
}) {
  const color =
    tone === "emerald" ? "text-emerald-700" : tone === "rose" ? "text-rose-700" : "text-foreground";
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${color}`}>{value.toFixed(2)}</div>
    </div>
  );
}
