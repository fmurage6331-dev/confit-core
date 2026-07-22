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
import { Plus, Package, Printer, ClipboardCheck, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/stock")({
  component: () => (
    <AppShell>
      <PermGuard perm="stock">
        <StockPage />
      </PermGuard>
    </AppShell>
  ),
});

const KINDS = [
  { value: "pharmaceutical", label: "Pharmaceutical" },
  { value: "non_pharmaceutical", label: "Non-pharmaceutical" },
  { value: "consumable", label: "Consumable" },
] as const;

type StockItem = {
  id: string;
  name: string;
  kind: string | null;
  category: string | null;
  unit: string | null;
  current_quantity: number | null;
  reorder_level: number | null;
  buy_price: number | null;
  cash_price: number | null;
  insurance_price: number | null;
  unit_price: number | null;
  notes: string | null;
};

function kindLabel(k: string) {
  return KINDS.find((x) => x.value === k)?.label ?? k;
}

function StockPage() {
  const qc = useQueryClient();
  const [openItem, setOpenItem] = useState(false);
  const [openMove, setOpenMove] = useState<StockItem | null>(null);
  const [editItem, setEditItem] = useState<StockItem | null>(null);
  const [tab, setTab] = useState<"all" | (typeof KINDS)[number]["value"]>("all");
  const [createMohIndicator, setCreateMohIndicator] = useState(false);

  const { data: items, isLoading } = useQuery({
    queryKey: ["stock_items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_items")
        .select("*")
        .order("kind")
        .order("category")
        .order("name");
      if (error) throw error;
      return (data ?? []) as StockItem[];
    },
  });

  const addItem = useMutation({
    mutationFn: async (i: Record<string, unknown>) => {
      const { error } = await supabase.from("stock_items").insert(i as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Product added");
      qc.invalidateQueries({ queryKey: ["stock_items"] });
      setOpenItem(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateItem = useMutation({
    mutationFn: async (i: Record<string, unknown>) => {
      const { error } = await supabase
        .from("stock_items")
        .update(i as never)
        .eq("id", i.id as string);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Product updated");
      qc.invalidateQueries({ queryKey: ["stock_items"] });
      setEditItem(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const adjustProduct = useMutation({
    mutationFn: async (args: {
      itemId: string;
      prices: Record<string, unknown>;
      move: Record<string, unknown> | null;
    }) => {
      const { error: priceError } = await supabase
        .from("stock_items")
        .update(args.prices as never)
        .eq("id", args.itemId);
      if (priceError) throw priceError;
      if (args.move) {
        const { error: moveError } = await supabase
          .from("stock_movements")
          .insert(args.move as never);
        if (moveError) throw moveError;
      }
    },
    onSuccess: () => {
      toast.success("Product updated");
      qc.invalidateQueries({ queryKey: ["stock_items"] });
      setOpenMove(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = (items ?? []).filter((i) =>
    tab === "all" ? true : (i.kind ?? "consumable") === tab,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 no-print">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Package className="h-7 w-7 text-primary" />
            Stock & products
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pharmaceutical, non-pharmaceutical and consumable inventory. Record usage, adjustments
            and stock takes.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
          <Dialog open={openItem} onOpenChange={(v) => { setOpenItem(v); if (!v) setCreateMohIndicator(false); }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add product
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add product / stock item</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  const name = f.get("name") as string;
                  const category = f.get("category") as string;
                  const kind = f.get("kind") as string;
                  const createIndicator = f.get("create_moh_indicator") === "on";

                  addItem.mutate({
                    name,
                    kind: kind || "consumable",
                    category,
                    unit: f.get("unit") || "pcs",
                    current_quantity: Number(f.get("current_quantity") || 0),
                    reorder_level: Number(f.get("reorder_level") || 0),
                    buy_price: Number(f.get("buy_price") || 0),
                    cash_price: Number(f.get("cash_price") || 0),
                    insurance_price: Number(f.get("insurance_price") || 0),
                    unit_price: Number(f.get("cash_price") || 0),
                    notes: f.get("notes"),
                  });

                  // Create MOH indicator definition if checked
                  if (createIndicator && category) {
                    const indicatorCode = (f.get("moh_indicator_code") as string) || 
                      name.toUpperCase().replace(/[^A-Z0-9]/g, "_").substring(0, 20);
                    const description = (f.get("moh_description") as string) || name;
                    const formNumber = (f.get("moh_form_number") as string) || "MOH_PHARM";
                    
                    // Determine criteria type based on category
                    let criteriaType = "drug_class";
                    if (category.includes("Contraceptive") || category.includes("FP")) {
                      criteriaType = "fp_method";
                    }

                    const { error } = await supabase.from("moh_indicator_definitions").insert({
                      form_number: formNumber,
                      indicator_code: indicatorCode,
                      description: description,
                      criteria_type: criteriaType,
                      criteria_value: category,
                    });

                    if (error) {
                      toast.error("Product saved, but failed to create MOH indicator: " + error.message);
                    } else {
                      toast.success("MOH indicator created: " + indicatorCode);
                    }
                  }
                }}
                className="space-y-3"
              >
                <div>
                  <Label>Name *</Label>
                  <Input name="name" required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Kind *</Label>
                    <Select name="kind" defaultValue="consumable">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {KINDS.map((k) => (
                          <SelectItem key={k.value} value={k.value}>
                            {k.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Category (for MOH tracking)</Label>
                    <Input name="category" placeholder="e.g. Antibiotics, FP, etc." />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>Buy price (KES)</Label>
                    <Input type="number" step="0.01" name="buy_price" defaultValue={0} />
                  </div>
                  <div>
                    <Label>Cash price (KES)</Label>
                    <Input type="number" step="0.01" name="cash_price" defaultValue={0} />
                  </div>
                  <div>
                    <Label>Insurance price (KES)</Label>
                    <Input type="number" step="0.01" name="insurance_price" defaultValue={0} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>Unit</Label>
                    <Input name="unit" defaultValue="pcs" />
                  </div>
                  <div>
                    <Label>Starting qty</Label>
                    <Input type="number" step="0.01" name="current_quantity" defaultValue={0} />
                  </div>
                  <div>
                    <Label>Reorder ≤</Label>
                    <Input type="number" step="0.01" name="reorder_level" defaultValue={0} />
                  </div>
                </div>
                <div>
                  <Label>Notes</Label>
                  <Textarea name="notes" />
                </div>

                {/* MOH Indicator Section */}
                <div className="border rounded-lg p-3 bg-muted/30">
                  <button
                    type="button"
                    onClick={() => setCreateMohIndicator(!createMohIndicator)}
                    className="flex items-center gap-2 text-sm font-medium w-full"
                  >
                    {createMohIndicator ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    MOH Indicator (auto-tracking)
                  </button>

                  {createMohIndicator && (
                    <div className="mt-3 space-y-3 pl-6">
                      <p className="text-xs text-muted-foreground">
                        Automatically create an indicator definition so this item is tracked in MOH reports.
                      </p>
                      <input type="checkbox" name="create_moh_indicator" defaultChecked={true} hidden />
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>Form Number</Label>
                          <Select name="moh_form_number" defaultValue="MOH_PHARM">
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="MOH_PHARM">MOH Pharmacy</SelectItem>
                              <SelectItem value="MOH_FP">MOH Family Planning</SelectItem>
                              <SelectItem value="MOH_717">MOH 717</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Indicator Code</Label>
                          <Input
                            name="moh_indicator_code"
                            placeholder="Auto-generated"
                          />
                        </div>
                      </div>
                      <div>
                        <Label>Description</Label>
                        <Input
                          name="moh_description"
                          placeholder="Description for this indicator"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <DialogFooter>
                  <Button type="submit" disabled={addItem.isPending}>
                    Save
                  </Button>
                </DialogFooter>
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
              tab === t.value
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
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
              <th className="px-4 py-2 text-right">Buy</th>
              <th className="px-4 py-2 text-right">Cash</th>
              <th className="px-4 py-2 text-right">Insurance</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading && (
              <tr>
                <td colSpan={11} className="p-6 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            )}
            {filtered.map((i) => {
              const low = Number(i.current_quantity) <= Number(i.reorder_level);
              return (
                <tr
                  key={i.id}
                  className="cursor-pointer transition-colors hover:bg-muted/40"
                  onClick={() => setOpenMove(i)}
                >
                  <td className="px-4 py-2 font-medium">{i.name}</td>
                  <td className="px-4 py-2">
                    <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs">
                      {kindLabel(i.kind ?? "consumable")}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{i.category}</td>
                  <td className="px-4 py-2">{i.unit}</td>
                  <td
                    className={`px-4 py-2 font-mono ${low ? "text-destructive font-semibold" : ""}`}
                  >
                    {i.current_quantity}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{i.reorder_level}</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    KES {Number(i.buy_price ?? 0).toFixed(2)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    KES {Number(i.cash_price ?? i.unit_price ?? 0).toFixed(2)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    KES {Number(i.insurance_price ?? 0).toFixed(2)}
                  </td>
                  <td className="px-4 py-2">
                    {low ? (
                      <span className="inline-flex rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-medium text-destructive">
                        Low
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
                        OK
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 no-print">
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditItem(i);
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMove(i);
                        }}
                      >
                        <ClipboardCheck className="mr-1 h-3 w-3" />
                        Adjust
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={11} className="p-6 text-center text-muted-foreground">
                  No items in this category.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={!!openMove} onOpenChange={(v) => !v && setOpenMove(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust: {openMove?.name}</DialogTitle>
          </DialogHeader>
          {openMove && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                const change = Number(f.get("change") || 0);
                adjustProduct.mutate({
                  itemId: openMove.id,
                  prices: {
                    buy_price: Number(f.get("buy_price") || 0),
                    cash_price: Number(f.get("cash_price") || 0),
                    insurance_price: Number(f.get("insurance_price") || 0),
                    unit_price: Number(f.get("cash_price") || 0),
                  },
                  move:
                    change !== 0
                      ? {
                          item_id: openMove.id,
                          change,
                          reason: f.get("reason"),
                          notes: f.get("notes"),
                        }
                      : null,
                });
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Buy price (KES)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    name="buy_price"
                    defaultValue={Number(openMove.buy_price ?? 0)}
                  />
                </div>
                <div>
                  <Label>Cash price (KES)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    name="cash_price"
                    defaultValue={Number(openMove.cash_price ?? openMove.unit_price ?? 0)}
                  />
                </div>
                <div>
                  <Label>Insurance price (KES)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    name="insurance_price"
                    defaultValue={Number(openMove.insurance_price ?? 0)}
                  />
                </div>
              </div>
              <div className="space-y-3 border-t pt-3">
                <p className="text-xs uppercase text-muted-foreground">
                  Stock quantity change (optional)
                </p>
                <div>
                  <Label>Reason</Label>
                  <Select name="reason" defaultValue="usage">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="usage">Usage (subtract)</SelectItem>
                      <SelectItem value="adjustment">Adjustment</SelectItem>
                      <SelectItem value="stock_take">Stock take correction</SelectItem>
                      <SelectItem value="delivery">Delivery (manual)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Change</Label>
                  <Input
                    type="number"
                    step="0.01"
                    name="change"
                    defaultValue={0}
                    placeholder="Positive to add, negative to remove — leave 0 to skip"
                  />
                </div>
                <div>
                  <Label>Notes</Label>
                  <Textarea name="notes" />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={adjustProduct.isPending}>
                  Save
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editItem} onOpenChange={(o) => !o && setEditItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit product</DialogTitle>
          </DialogHeader>
          {editItem && (
            <form
              onSubmit={(e) => {
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
                  buy_price: Number(f.get("buy_price") || 0),
                  cash_price: Number(f.get("cash_price") || 0),
                  insurance_price: Number(f.get("insurance_price") || 0),
                  unit_price: Number(f.get("cash_price") || 0),
                  notes: f.get("notes"),
                });
              }}
              className="space-y-3"
            >
              <div>
                <Label>Name *</Label>
                <Input name="name" defaultValue={editItem.name} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Kind *</Label>
                  <Select name="kind" defaultValue={editItem.kind ?? "consumable"}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {KINDS.map((k) => (
                        <SelectItem key={k.value} value={k.value}>
                          {k.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Category</Label>
                  <Input
                    name="category"
                    defaultValue={editItem.category ?? ""}
                    placeholder="e.g. Antibiotics"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Buy price (KES)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    name="buy_price"
                    defaultValue={Number(editItem.buy_price ?? 0)}
                  />
                </div>
                <div>
                  <Label>Cash price (KES)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    name="cash_price"
                    defaultValue={Number(editItem.cash_price ?? editItem.unit_price ?? 0)}
                  />
                </div>
                <div>
                  <Label>Insurance price (KES)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    name="insurance_price"
                    defaultValue={Number(editItem.insurance_price ?? 0)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Unit</Label>
                  <Input name="unit" defaultValue={editItem.unit ?? "pcs"} />
                </div>
                <div>
                  <Label>On hand</Label>
                  <Input
                    type="number"
                    step="0.01"
                    name="current_quantity"
                    defaultValue={Number(editItem.current_quantity ?? 0)}
                  />
                </div>
                <div>
                  <Label>Reorder ≤</Label>
                  <Input
                    type="number"
                    step="0.01"
                    name="reorder_level"
                    defaultValue={Number(editItem.reorder_level ?? 0)}
                  />
                </div>
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea name="notes" defaultValue={editItem.notes ?? ""} />
              </div>
              <DialogFooter className="flex gap-2">
                <Button variant="outline" onClick={() => setEditItem(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateItem.isPending}>
                  Save
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
