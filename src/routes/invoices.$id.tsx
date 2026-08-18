/**
 * LabTrack — Invoice detail (itemized).
 */
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/app-shell";
import { PermGuard } from "@/lib/require-access";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { ArrowLeft, Printer, Plus, Receipt } from "lucide-react";
import { PrintHeader } from "@/components/print-header";

export const Route = createFileRoute("/invoices/$id")({
  component: () => (
    <AppShell>
      <PermGuard perm="accounting">
        <InvoiceDetail />
      </PermGuard>
    </AppShell>
  ),
});

type Invoice = {
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
  patients: {
    patient_name: string | null;
    file_number: string | null;
    phone: string | null;
  } | null;
};

type LineItem = {
  id: string;
  item_type: string;
  description: string | null;
  quantity: number | null;
  unit_price: number | null;
  amount: number | null;
  insurance_covered_amount: number | null;
};

type Payment = {
  id: string;
  amount: number;
  method: string | null;
  reference: string | null;
  paid_at: string | null;
  received_by: string | null;
};

function InvoiceDetail() {
  const { id } = useParams({ from: "/invoices/$id" });
  const qc = useQueryClient();
  const { user, hasPerm } = useAuth();
  const canEditLines = hasPerm("accounting");
  const [payOpen, setPayOpen] = useState(false);
  const [lineOpen, setLineOpen] = useState(false);
  const [editingLine, setEditingLine] = useState<LineItem | null>(null);

  const invoiceQ = useQuery({
    queryKey: ["invoice", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*, patients(patient_name,file_number,phone)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as Invoice | null;
    },
  });

  const linesQ = useQuery({
    queryKey: ["invoice-lines", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoice_line_items")
        .select("id,item_type,description,quantity,unit_price,amount,insurance_covered_amount")
        .eq("invoice_id", id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as LineItem[];
    },
  });

  const paysQ = useQuery({
    queryKey: ["invoice-payments", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoice_payments")
        .select("id,amount,method,reference,paid_at,received_by")
        .eq("invoice_id", id)
        .order("paid_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Payment[];
    },
  });

  const payM = useMutation({
    mutationFn: async (v: { amount: number; method: string; reference: string }) => {
      const { error } = await supabase.from("invoice_payments").insert({
        invoice_id: id,
        amount: v.amount,
        method: v.method,
        reference: v.reference || null,
        received_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Payment recorded");
      setPayOpen(false);
      qc.invalidateQueries({ queryKey: ["invoice", id] });
      qc.invalidateQueries({ queryKey: ["invoice-payments", id] });
      qc.invalidateQueries({ queryKey: ["invoices-list"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const addLineM = useMutation({
    mutationFn: async (v: {
      description: string;
      item_type: string;
      quantity: number;
      unit_price: number;
      amount: number;
    }) => {
      const { error } = await supabase.from("invoice_line_items").insert({
        invoice_id: id,
        description: v.description,
        item_type: v.item_type,
        quantity: v.quantity,
        unit_price: v.unit_price,
        amount: v.amount,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Line item added");
      setLineOpen(false);
      setEditingLine(null);
      qc.invalidateQueries({ queryKey: ["invoice-lines", id] });
      qc.invalidateQueries({ queryKey: ["invoice", id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const editLineM = useMutation({
    mutationFn: async (v: {
      id: string;
      description: string;
      item_type: string;
      quantity: number;
      unit_price: number;
      amount: number;
    }) => {
      const { error } = await supabase
        .from("invoice_line_items")
        .update({
          description: v.description,
          item_type: v.item_type,
          quantity: v.quantity,
          unit_price: v.unit_price,
          amount: v.amount,
        })
        .eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Line item updated");
      setLineOpen(false);
      setEditingLine(null);
      qc.invalidateQueries({ queryKey: ["invoice-lines", id] });
      qc.invalidateQueries({ queryKey: ["invoice", id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const deleteLineM = useMutation({
    mutationFn: async (lineId: string) => {
      const { error } = await supabase.from("invoice_line_items").delete().eq("id", lineId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Line item removed");
      qc.invalidateQueries({ queryKey: ["invoice-lines", id] });
      qc.invalidateQueries({ queryKey: ["invoice", id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const inv = invoiceQ.data;

  if (invoiceQ.isLoading)
    return <div className="mx-auto max-w-4xl p-6 text-muted-foreground">Loading…</div>;
  if (invoiceQ.error)
    return (
      <div className="mx-auto max-w-4xl p-6 text-destructive">
        {(invoiceQ.error as Error).message}
      </div>
    );
  if (!inv)
    return <div className="mx-auto max-w-4xl p-6 text-muted-foreground">Invoice not found.</div>;

  const lines = linesQ.data ?? [];
  const pays = paysQ.data ?? [];

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-center justify-between gap-3 no-print">
        <Link
          to="/invoices"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> All invoices
        </Link>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" /> Print
          </Button>
          <Button
            size="sm"
            onClick={() => setPayOpen(true)}
            disabled={Number(inv.balance ?? 0) <= 0}
          >
            <Plus className="mr-2 h-4 w-4" /> Record payment
          </Button>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border bg-card p-6 print:border-0 print:p-0">
        <div className="hidden print:block">
          <PrintHeader title="Invoice" subtitle={inv.invoice_number ?? undefined} />
        </div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
              <Receipt className="h-4 w-4" /> Invoice
            </div>
            <h1 className="mt-1 font-mono text-2xl font-bold">
              {inv.invoice_number ?? inv.id.slice(0, 8)}
            </h1>
            <div className="mt-1 text-xs text-muted-foreground">
              {new Date(inv.created_at).toLocaleString()}
            </div>
          </div>
          <StatusBadge s={inv.status} />
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <div className="text-xs uppercase text-muted-foreground">Billed to</div>
            <div className="mt-1 font-medium">{inv.patients?.patient_name ?? "—"}</div>
            <div className="text-sm text-muted-foreground">
              {inv.patients?.file_number}
              {inv.patients?.phone ? ` · ${inv.patients.phone}` : ""}
            </div>
          </div>
          {inv.encounter_id && (
            <div className="text-right">
              <div className="text-xs uppercase text-muted-foreground">Encounter</div>
              <div className="mt-1 font-mono text-xs">{inv.encounter_id.slice(0, 8)}</div>
            </div>
          )}
        </div>

        <div className="mt-6 overflow-hidden rounded-xl border">
          {canEditLines && (
            <div className="flex justify-end border-b bg-muted/30 px-3 py-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditingLine(null);
                  setLineOpen(true);
                }}
              >
                <Plus className="mr-1 h-4 w-4" /> Add item
              </Button>
            </div>
          )}
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Item</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2 text-right">Qty</th>
                <th className="px-3 py-2 text-right">Unit</th>
                <th className="px-3 py-2 text-right">Amount</th>
                {canEditLines && <th className="px-3 py-2" />}
              </tr>
            </thead>
            <tbody className="divide-y">
              {lines.length === 0 && (
                <tr>
                  <td
                    colSpan={canEditLines ? 6 : 5}
                    className="p-4 text-center text-muted-foreground"
                  >
                    No line items.
                  </td>
                </tr>
              )}
              {lines.map((l) => {
                const isInsuranceLocked =
                  l.item_type === "insurance" || Number(l.insurance_covered_amount ?? 0) > 0;
                return (
                  <tr key={l.id}>
                    <td className="px-3 py-2">{l.description ?? "—"}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{l.item_type}</td>
                    <td className="px-3 py-2 text-right">{Number(l.quantity ?? 0)}</td>
                    <td className="px-3 py-2 text-right">{Number(l.unit_price ?? 0).toFixed(2)}</td>
                    <td className="px-3 py-2 text-right font-medium">
                      {Number(l.amount ?? 0).toFixed(2)}
                    </td>
                    {canEditLines && (
                      <td className="px-3 py-2 text-right">
                        {isInsuranceLocked ? (
                          <span className="text-xs text-muted-foreground">🔒 locked</span>
                        ) : (
                          <span className="flex justify-end gap-2">
                            <button
                              className="text-xs text-primary hover:underline"
                              onClick={() => {
                                setEditingLine(l);
                                setLineOpen(true);
                              }}
                            >
                              Edit
                            </button>
                            <button
                              className="text-xs text-destructive hover:underline"
                              onClick={() => {
                                if (window.confirm("Remove this line item?"))
                                  deleteLineM.mutate(l.id);
                              }}
                            >
                              Delete
                            </button>
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-4 ml-auto max-w-xs space-y-1 text-sm">
          <TotalRow label="Subtotal" value={inv.subtotal} />
          <TotalRow label="Discount" value={inv.discount} negative />
          <TotalRow label="Insurance covered" value={inv.insurance_covered} negative />
          <div className="border-t pt-1">
            <TotalRow label="Total due" value={inv.total_due} bold />
          </div>
          <TotalRow label="Paid" value={inv.amount_paid} tone="emerald" />
          <div className="border-t pt-1">
            <TotalRow label="Balance" value={inv.balance} bold tone="rose" />
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border bg-card p-6 no-print">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Payment history
        </h2>
        {pays.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No payments yet.</p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="py-2">Date</th>
                <th className="py-2">Method</th>
                <th className="py-2">Reference</th>
                <th className="py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {pays.map((p) => (
                <tr key={p.id}>
                  <td className="py-2">{p.paid_at ? new Date(p.paid_at).toLocaleString() : "—"}</td>
                  <td className="py-2">{p.method ?? "—"}</td>
                  <td className="py-2 text-muted-foreground">{p.reference ?? ""}</td>
                  <td className="py-2 text-right font-medium">{Number(p.amount).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <LineItemDialog
        open={lineOpen}
        onOpenChange={(o) => {
          setLineOpen(o);
          if (!o) setEditingLine(null);
        }}
        editing={editingLine}
        onSubmit={(v) => {
          if (editingLine) {
            editLineM.mutate({ id: editingLine.id, ...v });
          } else {
            addLineM.mutate(v);
          }
        }}
        pending={addLineM.isPending || editLineM.isPending}
      />
      <PaymentDialog
        open={payOpen}
        onOpenChange={setPayOpen}
        maxAmount={Number(inv.balance ?? 0)}
        onSubmit={(v) => payM.mutate(v)}
        pending={payM.isPending}
      />
    </div>
  );
}

function TotalRow({
  label,
  value,
  negative,
  bold,
  tone,
}: {
  label: string;
  value: number | null;
  negative?: boolean;
  bold?: boolean;
  tone?: "emerald" | "rose";
}) {
  const v = Number(value ?? 0);
  const color = tone === "emerald" ? "text-emerald-700" : tone === "rose" ? "text-rose-700" : "";
  return (
    <div className={`flex justify-between ${bold ? "font-semibold" : ""} ${color}`}>
      <span className="text-muted-foreground">{label}</span>
      <span>
        {negative && v > 0 ? "-" : ""}
        {v.toFixed(2)}
      </span>
    </div>
  );
}

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

function PaymentDialog({
  open,
  onOpenChange,
  maxAmount,
  onSubmit,
  pending,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  maxAmount: number;
  onSubmit: (v: { amount: number; method: string; reference: string }) => void;
  pending: boolean;
}) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");

  function submit() {
    const n = Number(amount);
    if (!n || n <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (n > maxAmount + 0.01) {
      toast.error(`Amount exceeds balance (${maxAmount.toFixed(2)})`);
      return;
    }
    onSubmit({ amount: n, method, reference });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) {
          setAmount("");
          setReference("");
          setMethod("cash");
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Amount</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              max={maxAmount}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`Max ${maxAmount.toFixed(2)}`}
            />
          </div>
          <div>
            <Label>Method</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="mpesa">M-Pesa</SelectItem>
                <SelectItem value="card">Card</SelectItem>
                <SelectItem value="bank">Bank transfer</SelectItem>
                <SelectItem value="insurance">Insurance</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Reference (optional)</Label>
            <Input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="M-Pesa code, receipt #, etc."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Saving…" : "Record"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LineItemDialog({
  open,
  onOpenChange,
  editing,
  onSubmit,
  pending,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: LineItem | null;
  onSubmit: (v: {
    description: string;
    item_type: string;
    quantity: number;
    unit_price: number;
    amount: number;
  }) => void;
  pending: boolean;
}) {
  const [description, setDescription] = useState(editing?.description ?? "");
  const [itemType, setItemType] = useState(editing?.item_type ?? "service");
  const [quantity, setQuantity] = useState(String(editing?.quantity ?? "1"));
  const [unitPrice, setUnitPrice] = useState(String(editing?.unit_price ?? ""));

  const amount = (Number(quantity) || 0) * (Number(unitPrice) || 0);

  function submit() {
    if (!description.trim()) {
      toast.error("Description is required");
      return;
    }
    const qty = Number(quantity);
    const price = Number(unitPrice);
    if (!qty || qty <= 0) {
      toast.error("Enter a valid quantity");
      return;
    }
    if (price < 0) {
      toast.error("Enter a valid unit price");
      return;
    }
    onSubmit({
      description: description.trim(),
      item_type: itemType,
      quantity: qty,
      unit_price: price,
      amount,
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit line item" : "Add line item"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Description *</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Consultation fee"
            />
          </div>
          <div>
            <Label>Type</Label>
            <Select value={itemType} onValueChange={setItemType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="service">Service</SelectItem>
                <SelectItem value="consultation">Consultation</SelectItem>
                <SelectItem value="lab_test">Lab test</SelectItem>
                <SelectItem value="radiology">Radiology</SelectItem>
                <SelectItem value="prescription">Prescription</SelectItem>
                <SelectItem value="bed_charge">Bed charge</SelectItem>
                <SelectItem value="mortuary_storage">Mortuary storage</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Quantity</Label>
              <Input
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
            <div>
              <Label>Unit price (KES)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
              />
            </div>
          </div>
          <div className="rounded-lg bg-muted px-3 py-2 text-sm">
            <span className="text-muted-foreground">Total: </span>
            <span className="font-semibold">KES {amount.toFixed(2)}</span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Saving…" : editing ? "Save changes" : "Add item"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
