/**
 * LabTrack — Laboratory Records
 * Copyright (c) 2026 Francis Muhoro. All rights reserved.
 * Author: Francis Muhoro
 */

import { createFileRoute } from "@tanstack/react-router";
import { PermGuard } from "@/lib/require-access";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/lib/supabase-untyped";
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
  sha_fund_type: string | null;
  insurer_type: string | null;
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
  const { user, hasPerm } = useAuth();
  const [rows, setRows] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "unpaid" | "paid" | "waived">("all");
  const [search, setSearch] = useState("");
  const [payOpen, setPayOpen] = useState<Account | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [payRef, setPayRef] = useState("");
  const [saving, setSaving] = useState(false);
  const [creditOpen, setCreditOpen] = useState<Account | null>(null);
  const [creditAmount, setCreditAmount] = useState("");
  const [creditReason, setCreditReason] = useState("");
  const [eodOpen, setEodOpen] = useState(false);
  const [eodData, setEodData] = useState<{ method: string; total: number }[]>([]);
  const [eodLoading, setEodLoading] = useState(false);
  const [chgPmtOpen, setChgPmtOpen] = useState<Account | null>(null);
  const [chgPmtMode, setChgPmtMode] = useState<string>("cash");
  const [chgPmtInsurer, setChgPmtInsurer] = useState<string>("");
  const [chgPmtSaving, setChgPmtSaving] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("patient_registrations")
      .select(
        "id,patient_name,phone,file_number,payment_mode,tests,subtotal,insurance_covered,patient_due,payment_status,amount_paid,payment_method,payment_reference,paid_at,status,created_at,sha_fund_type,insurer_type",
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

  async function submitCreditNote() {
    if (!creditOpen) return;
    const amt = parseFloat(creditAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error("Enter a valid credit amount");
      return;
    }
    if (!creditReason.trim()) {
      toast.error("Enter a reason for the credit note");
      return;
    }
    setSaving(true);
    // Look up invoice for this encounter
    const { data: invRows } = await db
      .from("invoices")
      .select("id")
      .eq("encounter_id", creditOpen.id)
      .order("created_at", { ascending: true })
      .limit(1);
    const inv = (invRows as { id: string }[] | null)?.[0] ?? null;
    if (!inv) {
      toast.error("No invoice found for this encounter");
      setSaving(false);
      return;
    }
    const { error } = await db.from("invoice_line_items").insert({
      invoice_id: inv.id,
      encounter_id: creditOpen.id,
      item_type: "credit_note",
      description: `Credit note: ${creditReason.trim()}`,
      quantity: 1,
      unit_price: -amt,
      amount: -amt,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Credit note issued — invoice total adjusted automatically");
    setCreditOpen(null);
    load();
  }

  async function loadEod() {
    setEodLoading(true);
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await db
      .from("invoice_payments")
      .select("method,amount")
      .gte("paid_at", `${today}T00:00:00`)
      .lte("paid_at", `${today}T23:59:59`);
    setEodLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const grouped = new Map<string, number>();
    for (const row of (data ?? []) as { method: string | null; amount: number }[]) {
      const m = row.method ?? "unknown";
      grouped.set(m, (grouped.get(m) ?? 0) + Number(row.amount ?? 0));
    }
    setEodData(Array.from(grouped.entries()).map(([method, total]) => ({ method, total })));
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

  async function changePaymentMode() {
    if (!chgPmtOpen) return;
    setChgPmtSaving(true);
    const isSha =
      chgPmtMode === "insurance" && (chgPmtInsurer === "sha_shif" || chgPmtInsurer === "sha_phf");
    const updates = {
      payment_mode: chgPmtMode,
      insurer_type: chgPmtMode === "insurance" ? chgPmtInsurer || null : null,
      sha_fund_type: isSha ? chgPmtInsurer.replace("sha_", "") : null,
    };
    const { error: regErr } = await supabase
      .from("patient_registrations")
      .update(updates as never)
      .eq("id", chgPmtOpen.id);
    if (regErr) {
      toast.error(regErr.message);
      setChgPmtSaving(false);
      return;
    }
    // Also update encounters table (same id)
    await supabase
      .from("encounters")
      .update(updates as never)
      .eq("id", chgPmtOpen.id);
    setChgPmtSaving(false);
    setChgPmtOpen(null);
    toast.success("Payment method updated");
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
        <div className="flex gap-2">
          <Button variant="outline" onClick={load}>
            Refresh
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setEodOpen(true);
              loadEod();
            }}
          >
            EOD Reconciliation
          </Button>
        </div>
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
                    <div className="flex flex-col gap-1">
                      <PaymentBadge mode={r.payment_mode} />
                      {r.sha_fund_type && (
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                            r.sha_fund_type === "eccif"
                              ? "bg-red-100 text-red-700 border-red-200"
                              : r.sha_fund_type === "shif"
                                ? "bg-blue-100 text-blue-700 border-blue-200"
                                : "bg-green-100 text-green-700 border-green-200"
                          }`}
                        >
                          {r.sha_fund_type.toUpperCase()}
                        </span>
                      )}
                    </div>
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
                    <div className="flex justify-end gap-2 flex-wrap">
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
                      {!settled &&
                        r.payment_status === "unpaid" &&
                        hasPerm("change_payment_method") && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-blue-300 text-blue-700 hover:bg-blue-50"
                            onClick={() => {
                              setChgPmtOpen(r);
                              setChgPmtMode(r.payment_mode);
                              setChgPmtInsurer(r.insurer_type ?? "");
                            }}
                          >
                            Change payment
                          </Button>
                        )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-amber-300 text-amber-700 hover:bg-amber-50"
                        onClick={() => {
                          setCreditOpen(r);
                          setCreditAmount("");
                          setCreditReason("");
                        }}
                      >
                        Credit note
                      </Button>
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
      {/* Credit Note Dialog */}
      <Dialog open={!!creditOpen} onOpenChange={(o) => !o && setCreditOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Issue Credit Note — {creditOpen?.patient_name}</DialogTitle>
          </DialogHeader>
          {creditOpen && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                <div className="flex justify-between">
                  <span>Current balance</span>
                  <span className="tabular-nums font-semibold">
                    KSh{" "}
                    {Math.max(
                      0,
                      Number(creditOpen.patient_due) - Number(creditOpen.amount_paid),
                    ).toFixed(2)}
                  </span>
                </div>
              </div>
              <div>
                <Label>Credit amount (KSh)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(e.target.value)}
                  placeholder="Amount to credit"
                />
              </div>
              <div>
                <Label>Reason</Label>
                <Input
                  value={creditReason}
                  onChange={(e) => setCreditReason(e.target.value)}
                  placeholder="e.g. Billing error, overcharge correction…"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreditOpen(null)}>
              Cancel
            </Button>
            <Button onClick={submitCreditNote} disabled={saving}>
              {saving ? "Saving…" : "Issue credit note"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Payment Method Dialog */}
      <Dialog open={!!chgPmtOpen} onOpenChange={(o) => !o && setChgPmtOpen(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Change payment method — {chgPmtOpen?.patient_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Payment mode</Label>
              <Select value={chgPmtMode} onValueChange={setChgPmtMode}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="insurance">Insurance</SelectItem>
                  <SelectItem value="free">Free / Waived</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {chgPmtMode === "insurance" && (
              <div>
                <Label>Insurer type</Label>
                <Select value={chgPmtInsurer} onValueChange={setChgPmtInsurer}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select insurer…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sha_shif">SHA — SHIF</SelectItem>
                    <SelectItem value="sha_phf">SHA — PHF</SelectItem>
                    <SelectItem value="private">Private Insurance</SelectItem>
                    <SelectItem value="corporate">Corporate / LPO</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChgPmtOpen(null)}>
              Cancel
            </Button>
            <Button
              disabled={chgPmtSaving || (chgPmtMode === "insurance" && !chgPmtInsurer)}
              onClick={changePaymentMode}
            >
              {chgPmtSaving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* EOD Reconciliation Dialog */}
      <Dialog open={eodOpen} onOpenChange={setEodOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>End-of-Day Cash Reconciliation</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Today's payments — {new Date().toLocaleDateString("en-KE", { dateStyle: "full" })}
          </p>
          {eodLoading ? (
            <div className="py-6 text-center text-sm text-muted-foreground">Loading…</div>
          ) : eodData.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No payments recorded today.
            </div>
          ) : (
            <div className="space-y-2">
              {eodData.map((row) => (
                <div
                  key={row.method}
                  className="flex items-center justify-between rounded-lg border p-3 text-sm"
                >
                  <span className="capitalize font-medium">
                    {row.method?.replace(/_/g, " ") ?? "Unknown"}
                  </span>
                  <span className="tabular-nums font-semibold text-emerald-700">
                    KSh {row.total.toFixed(2)}
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between rounded-lg bg-muted p-3 text-sm font-bold border-t">
                <span>Total</span>
                <span className="tabular-nums text-emerald-700">
                  KSh {eodData.reduce((s, r) => s + r.total, 0).toFixed(2)}
                </span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEodOpen(false)}>
              Close
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
