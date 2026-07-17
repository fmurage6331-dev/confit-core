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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Package, Printer, ClipboardCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/stock")({
  component: () => <AppShell><PermGuard perm="stock"><StockPage /></PermGuard></AppShell>,
});

const KINDS = [
  { value: "pharmaceutical", label: "Pharmaceutical" },
  { value: "non_pharmaceutical", label: "Non-pharmaceutical" },
  { value: "consumable", label: "Consumable" },
] as const;

function kindLabel(k: string) {
  return KINDS.find((x) => x.value === k)?.label ?? k;
}

function StockPage() {
  const qc = useQueryClient();
  const [openItem, setOpenItem] = useState(false);
  const [openMove, setOpenMove] = useState<{ id: string; name: string } | null>(null);
  const [editItem, setEditItem] = useState<any | null>(null);
  const [tab, setTab] = useState<"all" | typeof KINDS[number]["value"]>("all");

  const { data: items, isLoading } = useQuery({
    queryKey: ["stock_items"],
    queryFn: async () => {
      const { data, error } = await supabase.from("stock_items").select("*").order("kind").order("category").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const addItem = useMutation({
    mutationFn: async (i: Record<string, unknown>) => { const { error } = await supabase.from("stock_items").insert(i as never); if (error) throw error; },
    onSuccess: () => { toast.success("Product added"); qc.invalidateQueries({ queryKey: ["stock_items"] }); setOpenItem(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateItem = useMutation({
    mutationFn: async (i: Record<string, unknown>) => { const { error } = await supabase.from("stock_items").update(i as never).eq('id', (i.id as string)); if (error) throw error; },
    onSuccess: () => { toast.success("Product updated"); qc.invalidateQueries({ queryKey: ["stock_items"] }); setEditItem(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const addMove = useMutation({
    mutationFn: async (m: Record<string, unknown>) => { const { error } = await supabase.from("stock_movements").insert(m as never); if (error) throw error; },
    onSuccess: () => { toast.success("Movement recorded"); qc.invalidateQueries({ queryKey: ["stock_items"] }); setOpenMove(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = (items ?? []).filter((i) => tab === "all" ? true : (i.kind ?? "consumable") === tab);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 no-print">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Package className="h-7 w-7 text-primary" />Stock & products</h1>
          <p className="mt-1 text-sm text-muted-foreground">Pharmaceutical, non-pharmaceutical and consumable inventory. Record usage, adjustments and stock takes.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Print</Button>
          <Dialog open={openItem} onOpenChange={setOpenItem}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Add product</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add product / stock item</DialogTitle></DialogHeader>
              <form onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                addItem.mutate({
                  name: f.get("name"),
                  kind: f.get("kind") || "consumable",
                  category: f.get("category"),
                  unit: f.get("unit") || "pcs",
                  current_quantity: Number(f.get("current_quantity") || 0),
                  reorder_level: Number(f.get("reorder_level") || 0),
                  unit_price: Number(f.get("unit_price") || 0),
                  notes: f.get("notes"),
                });
              }} className="space-y-3">
                <div><Label>Name *</Label><Input name="name" required /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Kind *</Label>
                    <Select name="kind" defaultValue="consumable">
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {KINDS.map((k) => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Category</Label><Input name="category" placeholder="e.g. Antibiotics" /></div>
                </div>
                <div><Label>Unit price (KES)</Label><Input type="number" step="0.01" name="unit_price" defaultValue={0} /></div>
                <div className="grid grid-cols-3 gap-3">
                  <div><Label>Unit</Label><Input name="unit" defaultValue="pcs" /></div>
                  <div><Label>Starting qty</Label><Input type="number" step="0.01" name="current_quantity" defaultValue={0} /></div>
                  <div><Label>Reorder ≤</Label><Input type="number" step="0.01" name="reorder_level" defaultValue={0} /></div>
                </div>
                <div><Label>Notes</Label><Textarea name="notes" /></div>
                <DialogFooter><Button type="submit" disabled={addItem.isPending}>Save</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex gap-1 border-b no-print">
        {[{ value: "all", label: "All" }, ...KINDS].map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value as typeof tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.value ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >{t.label}</button>
        ))}
      </div>

      <div className="hidden print:block mb-4">
        <h2 className="text-xl font-bold">Stock Take Report</h2>
        <p className="text-sm">Generated {new Date().toLocaleString()}</p>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Item</th>
              <th className="px-4 py-2">Kind</th>
              <th className="px-4 py-2">Category</th>
              <th className="px-4 py-2">Unit</th>
              <th className="px-4 py-2">On hand</th>
              <th className="px-4 py-2">Reorder ≤</th>
              <th className="px-4 py-2 text-right">Price</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading && <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">Loading…</td></tr>}
            {filtered.map((i) => {
              const low = Number(i.current_quantity) <= Number(i.reorder_level);
              return (
                <tr key={i.id}>
                  <td className="px-4 py-2 font-medium">{i.name}</td>
                  <td className="px-4 py-2"><span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs">{kindLabel(i.kind ?? "consumable")}</span></td>
                  <td className="px-4 py-2 text-muted-foreground">{i.category}</td>
                  <td className="px-4 py-2">{i.unit}</td>
                  <td className={`px-4 py-2 font-mono ${low ? "text-destructive font-semibold" : ""}`}>{i.current_quantity}</td>
                  <td className="px-4 py-2 text-muted-foreground">{i.reorder_level}</td>
                  <td className="px-4 py-2 text-right tabular-nums">KES {Number(i.unit_price ?? 0).toFixed(2)}</td>
                  <td className="px-4 py-2">
                    {low
                      ? <span className="inline-flex rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-medium text-destructive">Low</span>
                      : <span className="inline-flex rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">OK</span>}
                  </td>
                  <td className="px-4 py-2 no-print">
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setEditItem(i)}>
                        Edit
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setOpenMove({ id: i.id, name: i.name })}>
                        <ClipboardCheck className="mr-1 h-3 w-3" />Adjust
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!isLoading && filtered.length === 0 && <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">No items in this category.</td></tr>}
          </tbody>
        </table>
      </div>

      <Dialog open={!!openMove} onOpenChange={(v) => !v && setOpenMove(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adjust: {openMove?.name}</DialogTitle></DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            addMove.mutate({
              item_id: openMove!.id,
              change: Number(f.get("change")),
              reason: f.get("reason"),
              notes: f.get("notes"),
            });
          }} className="space-y-3">
            <div><Label>Reason *</Label>
              <Select name="reason" defaultValue="usage">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="usage">Usage (subtract)</SelectItem>
                  <SelectItem value="adjustment">Adjustment</SelectItem>
                  <SelectItem value="stock_take">Stock take correction</SelectItem>
                  <SelectItem value="delivery">Delivery (manual)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Change *</Label><Input type="number" step="0.01" name="change" required placeholder="Positive to add, negative to remove" /></div>
            <div><Label>Notes</Label><Textarea name="notes" /></div>
            <DialogFooter><Button type="submit" disabled={addMove.isPending}>Save</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editItem} onOpenChange={(o) => !o && setEditItem(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit product</DialogTitle></DialogHeader>
          {editItem && (
            <form onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              updateItem.mutate({
                id: editItem.id,
                name: f.get("name"),
                kind: f.get("kind") || "consumable",
                category: f.get("category"),
                unit: f.get("unit") || "pcs",
                current_quantity: Number(f.get("current_quantity") || 0),
                reorder_level: Number(f.get("reorder_level") || 0),
                unit_price: Number(f.get("unit_price") || 0),
                notes: f.get("notes"),
              });
            }} className="space-y-3">
              <div><Label>Name *</Label><Input name="name" defaultValue={editItem.name} required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Kind *</Label>
                  <Select name="kind" defaultValue={editItem.kind ?? "consumable"}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {KINDS.map((k) => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Category</Label><Input name="category" defaultValue={editItem.category ?? ""} placeholder="e.g. Antibiotics" /></div>
              </div>
              <div><Label>Unit price (KES)</Label><Input type="number" step="0.01" name="unit_price" defaultValue={Number(editItem.unit_price ?? 0)} /></div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Unit</Label><Input name="unit" defaultValue={editItem.unit ?? "pcs"} /></div>
                <div><Label>On hand</Label><Input type="number" step="0.01" name="current_quantity" defaultValue={Number(editItem.current_quantity ?? 0)} /></div>
                <div><Label>Reorder ≤</Label><Input type="number" step="0.01" name="reorder_level" defaultValue={Number(editItem.reorder_level ?? 0)} /></div>
              </div>
              <div><Label>Notes</Label><Textarea name="notes" defaultValue={editItem.notes ?? ""} /></div>
              <DialogFooter className="flex gap-2">
                <Button variant="outline" onClick={() => setEditItem(null)}>Cancel</Button>
                <Button type="submit" disabled={updateItem.isPending}>Save</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
