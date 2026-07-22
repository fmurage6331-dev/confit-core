/**
 * LabTrack — Laboratory Records
 * Copyright (c) 2026 Francis Muhoro. All rights reserved.
 * Author: Francis Muhoro
 */

import { createFileRoute } from "@tanstack/react-router";
import { PermGuard } from "@/lib/require-access";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Truck, Printer } from "lucide-react";
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

function DeliveriesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: items } = useQuery({
    queryKey: ["stock_items_min"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_items")
        .select("id, name, unit")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: deliveries } = useQuery({
    queryKey: ["deliveries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deliveries")
        .select("*")
        .order("delivery_date", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const add = useMutation({
    mutationFn: async (d: Record<string, unknown>) => {
      const { error } = await supabase.from("deliveries").insert(d as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Delivery recorded");
      qc.invalidateQueries({ queryKey: ["deliveries"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
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
            Log incoming supplies. Linking a stock item updates inventory automatically.
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
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  const stock_item_id = f.get("stock_item_id") as string;
                  add.mutate({
                    delivery_date: f.get("delivery_date"),
                    supplier: f.get("supplier"),
                    item_name: f.get("item_name"),
                    stock_item_id: stock_item_id || null,
                    quantity: Number(f.get("quantity")),
                    unit: f.get("unit"),
                    batch_number: f.get("batch_number"),
                    expiry_date: f.get("expiry_date") || null,
                    invoice_number: f.get("invoice_number"),
                    received_by: f.get("received_by"),
                    notes: f.get("notes"),
                  });
                }}
                className="space-y-3 max-h-[70vh] overflow-y-auto"
              >
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
                  <Label>Link to stock item (optional)</Label>
                  <Select name="stock_item_id">
                    <SelectTrigger>
                      <SelectValue placeholder="None — will not affect inventory" />
                    </SelectTrigger>
                    <SelectContent>
                      {items?.map((i) => (
                        <SelectItem key={i.id} value={i.id}>
                          {i.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                    Save
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
              <th className="px-4 py-2">Supplier</th>
              <th className="px-4 py-2">Batch</th>
              <th className="px-4 py-2">Expiry</th>
              <th className="px-4 py-2">Invoice</th>
              <th className="px-4 py-2">Received by</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {deliveries?.map((d) => (
              <tr key={d.id}>
                <td className="px-4 py-2">{format(new Date(d.delivery_date), "dd MMM yyyy")}</td>
                <td className="px-4 py-2 font-medium">{d.item_name}</td>
                <td className="px-4 py-2">
                  {d.quantity} {d.unit}
                </td>
                <td className="px-4 py-2">{d.supplier}</td>
                <td className="px-4 py-2">{d.batch_number}</td>
                <td className="px-4 py-2">
                  {d.expiry_date ? format(new Date(d.expiry_date), "dd MMM yyyy") : "—"}
                </td>
                <td className="px-4 py-2 font-mono text-xs">{d.invoice_number}</td>
                <td className="px-4 py-2">{d.received_by}</td>
              </tr>
            ))}
            {deliveries?.length === 0 && (
              <tr>
                <td colSpan={8} className="p-6 text-center text-muted-foreground">
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
