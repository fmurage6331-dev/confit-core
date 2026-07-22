/**
 * LabTrack — Laboratory Records
 * Copyright (c) 2026 Francis Muhoro. All rights reserved.
 * Author: Francis Muhoro
 */

import { createFileRoute } from "@tanstack/react-router";
import { PermGuard } from "@/lib/require-access";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { PaymentBadge } from "@/routes/register-patient";
import { CheckCircle2, AlertCircle, CircleSlash, Search } from "lucide-react";

export const Route = createFileRoute("/accounting")({
  component: () => (
    <AppShell>
      <PermGuard perm="accounting">
        <Accounting />
      </PermGuard>
    </AppShell>
  ),
});

type Account = {
  id: string;
  patient_name: string;
  phone: string | null;
  file_number: string | null;
  payment_mode: "cash" | "insurance" | "free";
  tests: { id: string; name: string; price: number }[];
  subtotal: number;
  insurance_covered: number;
  patient_due: number;
  payment_status: "unpaid" | "paid" | "waived" | "partial";
  amount_paid: number;
  payment_method: string | null;
  payment_reference: string | null;
  paid_at: string | null;
  status: string;
  created_at: string;
};

function StatusPill({ s }: { s: Account["payment_status"] }) {
  if (s === "paid")
    return (
      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
        <CheckCircle2 className="mr-1 h-3 w-3" />
        Paid
      </Badge>
    );
  if (s === "waived")
    return (
      <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
        <CircleSlash className="mr-1 h-3 w-3" />
        Waived
      </Badge>
    );
  if (s === "partial")
    return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">Partial</Badge>;
  return (
    <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100">
      <AlertCircle className="mr-1 h-3 w-3" />
      Unpaid
    </Badge>
  );
}

function Accounting() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unpaid" | "paid" | "waived">("all");
  const [search, setSearch] = useState("");
  const [payOpen, setPayOpen] = useState<Account | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [payRef, setPayRef] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("patient_registrations")
      .select(
        "id,patient_name,phone,file_number,payment_mode,tests,subtotal,insurance_covered,patient_due,payment_status,amount_paid,payment_method,payment_reference,paid_at,status,created_at",
      )
      .order("created_at", { ascending: false })
      .limit(500);
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setRows((data ?? []) as unknown as Account[]);
  }
  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        if (filter !== "all" && r.payment_status !== filter) return false;
        if (search) {
          const q = search.toLowerCase();
          return (
            r.patient_name.toLowerCase().includes(q) ||
            (r.phone ?? "").toLowerCase().includes(q) ||
            (r.file_number ?? "").toLowerCase().includes(q)
          );
        }
        return true;
      }),
    [rows, filter, search],
  );

  const totals = useMemo(() => {
    const sum = (k: keyof Account) => filtered.reduce((a, r) => a + Number(r[k] ?? 0), 0);
    const due = filtered.reduce((a, r) => a + (Number(r.patient_due) - Number(r.amount_paid)), 0);
    return {
      subtotal: sum("subtotal"),
      collected: sum("amount_paid"),
      outstanding: Math.max(0, due),
    };
  }, [filtered]);

  function openPay(r: Account) {
    setPayOpen(r);
    setPayAmount((Number(r.patient_due) - Number(r.amount_paid)).toFixed(2));
    setPayMethod(r.payment_mode === "insurance" ? "insurance" : "cash");
    setPayRef("");
  }

  async function submitPayment() {
    if (!payOpen) return;
    const amt = Number(payAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    const remaining = Number(payOpen.patient_due) - Number(payOpen.amount_paid);
    if (amt > remaining + 0.001) {
      toast.error(`Amount exceeds remaining KSh ${remaining.toFixed(2)}`);
      return;
    }
    setSaving(true);
    const newPaid = Number(payOpen.amount_paid) + amt;
    const fullyPaid = newPaid + 0.001 >= Number(payOpen.patient_due);
    const { error } = await supabase
      .from("patient_registrations")
      .update({
        amount_paid: newPaid,
        payment_status: fullyPaid ? "paid" : "partial",
        payment_method: payMethod,
        payment_reference: payRef || null,
        paid_at: fullyPaid ? new Date().toISOString() : payOpen.paid_at,
        paid_by: user?.id ?? null,
      } as never)
      .eq("id", payOpen.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(
      fullyPaid ? "Payment completed — patient can now proceed" : "Partial payment recorded",
    );
    setPayOpen(null);
    load();
  }

  async function waive(r: Account) {
    if (!confirm(`Waive remaining balance for ${r.patient_name}?`)) return;
    const { error } = await supabase
      .from("patient_registrations")
      .update({
        payment_status: "waived",
        paid_at: new Date().toISOString(),
        paid_by: user?.id ?? null,
      } as never)
      .eq("id", r.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Marked as waived");
    load();
  }

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Accounting</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            All patient accounts. Patients can only proceed after payment is settled.
          </p>
        </div>
        <Button variant="outline" onClick={load}>
          Refresh
        </Button>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Card label="Billed" value={`KSh ${totals.subtotal.toFixed(2)}`} tone="muted" />
        <Card label="Collected" value={`KSh ${totals.collected.toFixed(2)}`} tone="emerald" />
        <Card label="Outstanding" value={`KSh ${totals.outstanding.toFixed(2)}`} tone="rose" />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search patient, phone, file…"
            className="pl-9"
          />
        </div>
        <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All accounts</SelectItem>
            <SelectItem value="unpaid">Unpaid</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="waived">Waived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Patient</th>
              <th className="px-4 py-3">Mode</th>
              <th className="px-4 py-3 text-right">Due</th>
              <th className="px-4 py-3 text-right">Paid</th>
              <th className="px-4 py-3 text-right">Balance</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  No accounts.
                </td>
              </tr>
            )}
            {filtered.map((r) => {
              const balance = Math.max(0, Number(r.patient_due) - Number(r.amount_paid));
              const settled = r.payment_status === "paid" || r.payment_status === "waived";
              return (
                <tr key={r.id} className="border-t">
                  <td className="px-4 py-3">
                    <div className="font-medium">{r.patient_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.file_number && <>#{r.file_number} · </>}
                      {r.phone || "—"}
                      <span className="ml-2">{new Date(r.created_at).toLocaleDateString()}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <PaymentBadge mode={r.payment_mode} />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    KSh {Number(r.patient_due).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    KSh {Number(r.amount_paid).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">
                    KSh {balance.toFixed(2)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill s={r.payment_status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      {!settled && balance > 0 && (
                        <Button size="sm" onClick={() => openPay(r)}>
                          Record payment
                        </Button>
                      )}
                      {!settled && (
                        <Button size="sm" variant="outline" onClick={() => waive(r)}>
                          Waive
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={!!payOpen} onOpenChange={(o) => !o && setPayOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record payment — {payOpen?.patient_name}</DialogTitle>
          </DialogHeader>
          {payOpen && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                <div className="flex justify-between">
                  <span>Patient due</span>
                  <span className="tabular-nums">KSh {Number(payOpen.patient_due).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Already paid</span>
                  <span className="tabular-nums">KSh {Number(payOpen.amount_paid).toFixed(2)}</span>
                </div>
                <div className="mt-1 flex justify-between border-t pt-1 font-semibold">
                  <span>Balance</span>
                  <span className="tabular-nums">
                    KSh {(Number(payOpen.patient_due) - Number(payOpen.amount_paid)).toFixed(2)}
                  </span>
                </div>
              </div>
              <div>
                <Label>Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                />
              </div>
              <div>
                <Label>Method</Label>
                <Select value={payMethod} onValueChange={setPayMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="mobile_money">Mobile money</SelectItem>
                    <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                    <SelectItem value="insurance">Insurance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Reference (optional)</Label>
                <Input
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                  placeholder="Receipt # / Txn ID"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(null)}>
              Cancel
            </Button>
            <Button onClick={submitPayment} disabled={saving}>
              {saving ? "Saving…" : "Save payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Card({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "muted" | "emerald" | "rose";
}) {
  const c =
    tone === "emerald" ? "text-emerald-600" : tone === "rose" ? "text-rose-600" : "text-foreground";
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${c}`}>{value}</div>
    </div>
  );
}
