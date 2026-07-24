/**
 * LabTrack — Laboratory Records
 * Copyright (c) 2026 Francis Muhoro. All rights reserved.
 * Author: Francis Muhoro
 */

import { createFileRoute } from "@tanstack/react-router";
import { PermGuard } from "@/lib/require-access";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { db } from "@/lib/supabase-untyped";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PackageCheck, Plus, Printer, Truck, Warehouse } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/deliveries")({
  component: () => (
    <AppShell>
      <PermGuard perm="deliveries">
        <DeliveriesPage />
      </PermGuard>
    </AppShell>
  ),
});

type StockItemOption = {
  id: string;
  name: string;
  unit: string | null;
};

type DeliveryRow = {
  id: string;
  delivery_date: string;
  supplier: string | null;
  item_name: string;
  stock_item_id: string | null;
  quantity: number | string;
  unit: string | null;
  batch_number: string | null;
  expiry_date: string | null;
  invoice_number: string | null;
  received_by: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function getFormNumber(formData: FormData, key: string) {
  const value = Number(formData.get(key) || 0);
  return Number.isFinite(value) ? value : 0;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return format(new Date(value), "dd MMM yyyy");
}

function DeliveriesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: items } = useQuery({
    queryKey: ["stock_items_min"],
    queryFn: async () => {
      const { data, error } = await db
        .from("stock_items")
        .select("id, name, unit")
        .order("name", { ascending: true });

      if (error) throw new Error(error.message);
      return (data ?? []) as StockItemOption[];
    },
  });

  const { data: deliveries, isLoading } = useQuery({
    queryKey: ["deliveries"],
    queryFn: async () => {
      const { data, error } = await db
        .from("deliveries")
        .select("*")
        .order("delivery_date", { ascending: false })
        .limit(500);

      if (error) throw new Error(error.message);
      return (data ?? []) as DeliveryRow[];
    },
  });

  const add = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { error } = await db.from("deliveries").insert(payload);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Delivery recorded. Linked stock was received into Main Store.");
      qc.invalidateQueries({ queryKey: ["deliveries"] });
      qc.invalidateQueries({ queryKey: ["stock-store-balances"] });
      qc.invalidateQueries({ queryKey: ["stock-items"] });
      setOpen(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 no-print">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Truck className="h-7 w-7 text-primary" />
            Deliveries
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Log incoming supplies. Linked stock items are received into Main Store
            automatically.
          </p>
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <Warehouse className="h-3.5 w-3.5" />
            Flow: Supplier delivery → Main Store → department store transfer.
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Record delivery
              </Button>
            </DialogTrigger>

            <DialogContent>
              <DialogHeader>
                <DialogTitle>Record delivery</DialogTitle>
              </DialogHeader>

              <form
                onSubmit={(event) => {
                  event.preventDefault();

                  const formData = new FormData(event.currentTarget);
                  const stockItemId = getFormString(formData, "stock_item_id");
                  const quantity = getFormNumber(formData, "quantity");

                  add.mutate({
                    delivery_date: getFormString(formData, "delivery_date"),
                    supplier: getFormString(formData, "supplier"),
                    item_name: getFormString(formData, "item_name"),
                    stock_item_id: stockItemId || null,
                    quantity,
                    unit: getFormString(formData, "unit"),
                    batch_number: getFormString(formData, "batch_number"),
                    expiry_date: getFormString(formData, "expiry_date") || null,
                    invoice_number: getFormString(formData, "invoice_number"),
                    received_by: getFormString(formData, "received_by"),
                    notes: getFormString(formData, "notes"),
                  });
                }}
                className="space-y-3 max-h-[70vh] overflow-y-auto"
              >
                <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
                  <div className="flex items-start gap-2">
                    <PackageCheck className="mt-0.5 h-4 w-4 text-primary" />
                    <div>
                      <p className="font-medium text-foreground">Main Store receiving</p>
                      <p>
                        If you link this delivery to a stock item, the quantity will
                        automatically increase the Main Store balance.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Date *</Label>
                    <Input
                      type="date"
                      name="delivery_date"
                      required
                      defaultValue={new Date().toISOString().slice(0, 10)}
                    />
                  </div>

                  <div>
                    <Label>Supplier</Label>
                    <Input name="supplier" />
                  </div>
                </div>

                <div>
                  <Label>Item name *</Label>
                  <Input name="item_name" required />
                </div>

                <div>
                  <Label>Link to stock item</Label>
                  <Select name="stock_item_id">
                    <SelectTrigger>
                      <SelectValue placeholder="None — will not affect Main Store" />
                    </SelectTrigger>
                    <SelectContent>
                      {(items ?? []).map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Select a stock item if this delivery should update Main Store
                    inventory.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Quantity *</Label>
                    <Input type="number" step="0.01" name="quantity" required />
                  </div>

                  <div>
                    <Label>Unit</Label>
                    <Input name="unit" placeholder="pcs, box, ml…" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Batch #</Label>
                    <Input name="batch_number" />
                  </div>

                  <div>
                    <Label>Expiry</Label>
                    <Input type="date" name="expiry_date" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Invoice #</Label>
                    <Input name="invoice_number" />
                  </div>

                  <div>
                    <Label>Received by</Label>
                    <Input name="received_by" />
                  </div>
                </div>

                <div>
                  <Label>Notes</Label>
                  <Textarea name="notes" />
                </div>

                <DialogFooter>
                  <Button type="submit" disabled={add.isPending}>
                    Save delivery
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="hidden print:block mb-4">
        <h2 className="text-xl font-bold">LabTrack — Deliveries Report</h2>
        <p className="text-sm">Generated {format(new Date(), "dd MMM yyyy HH:mm")}</p>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Item</th>
              <th className="px-4 py-2">Qty</th>
              <th className="px-4 py-2">Inventory</th>
              <th className="px-4 py-2">Supplier</th>
              <th className="px-4 py-2">Batch</th>
              <th className="px-4 py-2">Expiry</th>
              <th className="px-4 py-2">Invoice</th>
              <th className="px-4 py-2">Received by</th>
            </tr>
          </thead>

          <tbody className="divide-y">
            {isLoading && (
              <tr>
                <td colSpan={9} className="p-6 text-center text-muted-foreground">
                  Loading deliveries…
                </td>
              </tr>
            )}

            {!isLoading &&
              (deliveries ?? []).map((delivery) => (
                <tr key={delivery.id}>
                  <td className="px-4 py-2">{formatDate(delivery.delivery_date)}</td>
                  <td className="px-4 py-2 font-medium">{delivery.item_name}</td>
                  <td className="px-4 py-2">
                    {delivery.quantity} {delivery.unit}
                  </td>
                  <td className="px-4 py-2">
                    {delivery.stock_item_id ? (
                      <span className="inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        Main Store
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        Not linked
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2">{delivery.supplier ?? "—"}</td>
                  <td className="px-4 py-2">{delivery.batch_number ?? "—"}</td>
                  <td className="px-4 py-2">{formatDate(delivery.expiry_date)}</td>
                  <td className="px-4 py-2 font-mono text-xs">
                    {delivery.invoice_number ?? "—"}
                  </td>
                  <td className="px-4 py-2">{delivery.received_by ?? "—"}</td>
                </tr>
              ))}

            {!isLoading && (deliveries ?? []).length === 0 && (
              <tr>
                <td colSpan={9} className="p-6 text-center text-muted-foreground">
                  No deliveries recorded.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
