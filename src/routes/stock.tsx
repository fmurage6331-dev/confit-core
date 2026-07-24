/**
 * LabTrack — Store Management
 * Copyright (c) 2026 Francis Muhoro. All rights reserved.
 * Author: Francis Muhoro
 */

import { createFileRoute } from "@tanstack/react-router";
import { PermGuard } from "@/lib/require-access";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
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
import {
  ArrowRightLeft,
  Boxes,
  ClipboardCheck,
  Package,
  Plus,
  Printer,
  Search,
  Store,
  Warehouse,
} from "lucide-react";
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

const USAGE_REASONS = [
  { value: "used", label: "Used" },
  { value: "dispensed", label: "Dispensed" },
  { value: "damaged", label: "Damaged" },
  { value: "expired", label: "Expired" },
  { value: "adjustment", label: "Adjustment" },
] as const;

type StockLocation = {
  id: string;
  name: string;
  location_type: string;
  room_id: string | null;
  is_main_store: boolean;
  is_active: boolean;
};

type StockItem = {
  id: string;
  name: string;
  kind: string | null;
  category: string | null;
  unit: string | null;
  current_quantity: number | null;
  reorder_level: number | null;
  buy_price?: number | null;
  cash_price: number | null;
  insurance_price: number | null;
  unit_price: number | null;
  notes: string | null;
};

type StoreBalance = {
  id: string;
  location_id: string;
  location_name: string;
  location_type: string;
  is_main_store: boolean;
  item_id: string;
  item_name: string;
  category: string | null;
  kind: string | null;
  unit: string | null;
  quantity: number | string;
  updated_at: string | null;
};

type StoreUsage = {
  id: string;
  location_id: string;
  location_name: string;
  item_id: string;
  item_name: string;
  category: string | null;
  kind: string | null;
  unit: string | null;
  encounter_id: string | null;
  quantity: number | string;
  reason: string;
  used_by: string | null;
  used_by_email: string | null;
  used_at: string;
  notes: string | null;
  created_at: string;
};

function kindLabel(value: string | null | undefined) {
  const key = value ?? "consumable";
  return KINDS.find((item) => item.value === key)?.label ?? key;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function getFormNumber(formData: FormData, key: string) {
  const value = Number(formData.get(key) || 0);
  return Number.isFinite(value) ? value : 0;
}

function StockPage() {
  const qc = useQueryClient();

  const [activeLocationId, setActiveLocationId] = useState("");
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState("all");

  const [openAddItem, setOpenAddItem] = useState(false);
  const [openReceive, setOpenReceive] = useState(false);
  const [openTransfer, setOpenTransfer] = useState(false);
  const [openUsage, setOpenUsage] = useState(false);

  const { data: locations, isLoading: locationsLoading } = useQuery({
    queryKey: ["stock-locations"],
    queryFn: async () => {
      const { data, error } = await db
        .from("stock_locations")
        .select("*")
        .eq("is_active", true)
        .order("is_main_store", { ascending: false })
        .order("name", { ascending: true });

      if (error) throw new Error(error.message);
      return (data ?? []) as StockLocation[];
    },
  });

  const { data: items, isLoading: itemsLoading } = useQuery({
    queryKey: ["stock-items"],
    queryFn: async () => {
      const { data, error } = await db
        .from("stock_items")
        .select("*")
        .order("kind", { ascending: true })
        .order("category", { ascending: true })
        .order("name", { ascending: true });

      if (error) throw new Error(error.message);
      return (data ?? []) as StockItem[];
    },
  });

  const { data: balances, isLoading: balancesLoading } = useQuery({
    queryKey: ["stock-store-balances"],
    queryFn: async () => {
      const { data, error } = await db
        .from("stock_store_balances_view")
        .select("*")
        .order("location_name", { ascending: true })
        .order("item_name", { ascending: true });

      if (error) throw new Error(error.message);
      return (data ?? []) as StoreBalance[];
    },
  });

  const { data: usageRows, isLoading: usageLoading } = useQuery({
    queryKey: ["stock-store-usage"],
    queryFn: async () => {
      const { data, error } = await db
        .from("stock_store_usage_view")
        .select("*")
        .order("used_at", { ascending: false })
        .limit(100);

      if (error) throw new Error(error.message);
      return (data ?? []) as StoreUsage[];
    },
  });

  useEffect(() => {
    if (!activeLocationId && locations && locations.length > 0) {
      setActiveLocationId(locations[0].id);
    }
  }, [activeLocationId, locations]);

  const activeLocation = useMemo(() => {
    return locations?.find((location) => location.id === activeLocationId) ?? null;
  }, [locations, activeLocationId]);

  const activeBalances = useMemo(() => {
    const query = search.trim().toLowerCase();

    return (balances ?? [])
      .filter((row) => row.location_id === activeLocationId)
      .filter((row) => {
        if (kindFilter === "all") return true;
        return (row.kind ?? "consumable") === kindFilter;
      })
      .filter((row) => {
        if (!query) return true;

        return (
          row.item_name.toLowerCase().includes(query) ||
          (row.category ?? "").toLowerCase().includes(query) ||
          (row.kind ?? "").toLowerCase().includes(query)
        );
      });
  }, [balances, activeLocationId, search, kindFilter]);

  const activeUsage = useMemo(() => {
    return (usageRows ?? []).filter((row) => row.location_id === activeLocationId);
  }, [usageRows, activeLocationId]);

  const addItem = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { error } = await db.from("stock_items").insert(payload);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Stock item added.");
      setOpenAddItem(false);
      qc.invalidateQueries({ queryKey: ["stock-items"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const receiveStock = useMutation({
    mutationFn: async (payload: {
      locationId: string;
      itemId: string;
      quantity: number;
      note: string | null;
    }) => {
      const { error } = await db.rpc("receive_stock_to_location", {
        target_location_id: payload.locationId,
        target_item_id: payload.itemId,
        received_quantity: payload.quantity,
        note: payload.note,
      });

      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Stock received.");
      setOpenReceive(false);
      qc.invalidateQueries({ queryKey: ["stock-store-balances"] });
      qc.invalidateQueries({ queryKey: ["stock-items"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const transferStock = useMutation({
    mutationFn: async (payload: {
      fromLocationId: string;
      toLocationId: string;
      itemId: string;
      quantity: number;
      note: string | null;
    }) => {
      const { error } = await db.rpc("transfer_stock_between_locations", {
        source_location_id: payload.fromLocationId,
        destination_location_id: payload.toLocationId,
        target_item_id: payload.itemId,
        transfer_quantity: payload.quantity,
        note: payload.note,
      });

      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Stock transferred.");
      setOpenTransfer(false);
      qc.invalidateQueries({ queryKey: ["stock-store-balances"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const recordUsage = useMutation({
    mutationFn: async (payload: {
      locationId: string;
      itemId: string;
      quantity: number;
      reason: string;
      note: string | null;
    }) => {
      const { error } = await db.rpc("record_stock_usage", {
        source_location_id: payload.locationId,
        target_item_id: payload.itemId,
        used_quantity: payload.quantity,
        usage_reason: payload.reason,
        target_encounter_id: null,
        note: payload.note,
      });

      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Stock usage recorded.");
      setOpenUsage(false);
      qc.invalidateQueries({ queryKey: ["stock-store-balances"] });
      qc.invalidateQueries({ queryKey: ["stock-store-usage"] });
      qc.invalidateQueries({ queryKey: ["stock-items"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const pageLoading = locationsLoading || itemsLoading || balancesLoading;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 no-print">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Warehouse className="h-7 w-7 text-primary" />
            Stores & Stock
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Main Store and department stores for Lab, Pharmacy, Radiology,
            Reception, MCH and FP.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>

          <Dialog open={openAddItem} onOpenChange={setOpenAddItem}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                Add item
              </Button>
            </DialogTrigger>

            <DialogContent className="max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add stock item</DialogTitle>
              </DialogHeader>

              <form
                className="space-y-3"
                onSubmit={(event) => {
                  event.preventDefault();

                  const formData = new FormData(event.currentTarget);

                  addItem.mutate({
                    name: getFormString(formData, "name"),
                    kind: getFormString(formData, "kind") || "consumable",
                    category: getFormString(formData, "category"),
                    unit: getFormString(formData, "unit") || "pcs",
                    current_quantity: getFormNumber(formData, "current_quantity"),
                    reorder_level: getFormNumber(formData, "reorder_level"),
                    buy_price: getFormNumber(formData, "buy_price"),
                    cash_price: getFormNumber(formData, "cash_price"),
                    insurance_price: getFormNumber(formData, "insurance_price"),
                    unit_price: getFormNumber(formData, "cash_price"),
                    notes: getFormString(formData, "notes"),
                  });
                }}
              >
                <div>
                  <Label>Name *</Label>
                  <Input name="name" required />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Kind</Label>
                    <Select name="kind" defaultValue="consumable">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {KINDS.map((kind) => (
                          <SelectItem key={kind.value} value={kind.value}>
                            {kind.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Category</Label>
                    <Input name="category" placeholder="e.g. Test kits, Antibiotic" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>Unit</Label>
                    <Input name="unit" defaultValue="pcs" />
                  </div>
                  <div>
                    <Label>Opening quantity</Label>
                    <Input
                      type="number"
                      step="0.01"
                      name="current_quantity"
                      defaultValue={0}
                    />
                  </div>
                  <div>
                    <Label>Reorder level</Label>
                    <Input
                      type="number"
                      step="0.01"
                      name="reorder_level"
                      defaultValue={0}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>Buy price</Label>
                    <Input
                      type="number"
                      step="0.01"
                      name="buy_price"
                      defaultValue={0}
                    />
                  </div>
                  <div>
                    <Label>Cash price</Label>
                    <Input
                      type="number"
                      step="0.01"
                      name="cash_price"
                      defaultValue={0}
                    />
                  </div>
                  <div>
                    <Label>Insurance price</Label>
                    <Input
                      type="number"
                      step="0.01"
                      name="insurance_price"
                      defaultValue={0}
                    />
                  </div>
                </div>

                <div>
                  <Label>Notes</Label>
                  <Textarea name="notes" />
                </div>

                <DialogFooter>
                  <Button type="submit" disabled={addItem.isPending}>
                    Save item
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={openReceive} onOpenChange={setOpenReceive}>
            <DialogTrigger asChild>
              <Button>
                <Package className="mr-2 h-4 w-4" />
                Receive stock
              </Button>
            </DialogTrigger>

            <DialogContent>
              <DialogHeader>
                <DialogTitle>Receive stock into store</DialogTitle>
              </DialogHeader>

              <form
                className="space-y-3"
                onSubmit={(event) => {
                  event.preventDefault();

                  const formData = new FormData(event.currentTarget);

                  receiveStock.mutate({
                    locationId: getFormString(formData, "location_id"),
                    itemId: getFormString(formData, "item_id"),
                    quantity: getFormNumber(formData, "quantity"),
                    note: getFormString(formData, "note") || null,
                  });
                }}
              >
                <div>
                  <Label>Store</Label>
                  <Select name="location_id" defaultValue={activeLocationId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select store" />
                    </SelectTrigger>
                    <SelectContent>
                      {(locations ?? []).map((location) => (
                        <SelectItem key={location.id} value={location.id}>
                          {location.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Item</Label>
                  <Select name="item_id">
                    <SelectTrigger>
                      <SelectValue placeholder="Select item" />
                    </SelectTrigger>
                    <SelectContent>
                      {(items ?? []).map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Quantity</Label>
                  <Input type="number" step="0.01" name="quantity" required />
                </div>

                <div>
                  <Label>Note</Label>
                  <Textarea name="note" placeholder="Delivery note, supplier, or reason" />
                </div>

                <DialogFooter>
                  <Button type="submit" disabled={receiveStock.isPending}>
                    Receive
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={openTransfer} onOpenChange={setOpenTransfer}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <ArrowRightLeft className="mr-2 h-4 w-4" />
                Transfer
              </Button>
            </DialogTrigger>

            <DialogContent>
              <DialogHeader>
                <DialogTitle>Transfer stock between stores</DialogTitle>
              </DialogHeader>

              <form
                className="space-y-3"
                onSubmit={(event) => {
                  event.preventDefault();

                  const formData = new FormData(event.currentTarget);

                  transferStock.mutate({
                    fromLocationId: getFormString(formData, "from_location_id"),
                    toLocationId: getFormString(formData, "to_location_id"),
                    itemId: getFormString(formData, "item_id"),
                    quantity: getFormNumber(formData, "quantity"),
                    note: getFormString(formData, "note") || null,
                  });
                }}
              >
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>From store</Label>
                    <Select name="from_location_id" defaultValue={activeLocationId}>
                      <SelectTrigger>
                        <SelectValue placeholder="From" />
                      </SelectTrigger>
                      <SelectContent>
                        {(locations ?? []).map((location) => (
                          <SelectItem key={location.id} value={location.id}>
                            {location.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>To store</Label>
                    <Select name="to_location_id">
                      <SelectTrigger>
                        <SelectValue placeholder="To" />
                      </SelectTrigger>
                      <SelectContent>
                        {(locations ?? []).map((location) => (
                          <SelectItem key={location.id} value={location.id}>
                            {location.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label>Item</Label>
                  <Select name="item_id">
                    <SelectTrigger>
                      <SelectValue placeholder="Select item" />
                    </SelectTrigger>
                    <SelectContent>
                      {(items ?? []).map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Quantity</Label>
                  <Input type="number" step="0.01" name="quantity" required />
                </div>

                <div>
                  <Label>Note</Label>
                  <Textarea name="note" />
                </div>

                <DialogFooter>
                  <Button type="submit" disabled={transferStock.isPending}>
                    Transfer
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={openUsage} onOpenChange={setOpenUsage}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <ClipboardCheck className="mr-2 h-4 w-4" />
                Record usage
              </Button>
            </DialogTrigger>

            <DialogContent>
              <DialogHeader>
                <DialogTitle>Record manual stock usage</DialogTitle>
              </DialogHeader>

              <form
                className="space-y-3"
                onSubmit={(event) => {
                  event.preventDefault();

                  const formData = new FormData(event.currentTarget);

                  recordUsage.mutate({
                    locationId: getFormString(formData, "location_id"),
                    itemId: getFormString(formData, "item_id"),
                    quantity: getFormNumber(formData, "quantity"),
                    reason: getFormString(formData, "reason") || "used",
                    note: getFormString(formData, "note") || null,
                  });
                }}
              >
                <div>
                  <Label>Store</Label>
                  <Select name="location_id" defaultValue={activeLocationId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select store" />
                    </SelectTrigger>
                    <SelectContent>
                      {(locations ?? []).map((location) => (
                        <SelectItem key={location.id} value={location.id}>
                          {location.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Item</Label>
                  <Select name="item_id">
                    <SelectTrigger>
                      <SelectValue placeholder="Select item" />
                    </SelectTrigger>
                    <SelectContent>
                      {(items ?? []).map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Quantity</Label>
                    <Input type="number" step="0.01" name="quantity" required />
                  </div>

                  <div>
                    <Label>Reason</Label>
                    <Select name="reason" defaultValue="used">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {USAGE_REASONS.map((reason) => (
                          <SelectItem key={reason.value} value={reason.value}>
                            {reason.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label>Note</Label>
                  <Textarea
                    name="note"
                    placeholder="Example: Manual lab usage for MOH 642"
                  />
                </div>

                <DialogFooter>
                  <Button type="submit" disabled={recordUsage.isPending}>
                    Record usage
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <aside className="rounded-xl border bg-card p-3 no-print">
          <div className="mb-3 flex items-center gap-2 px-2 text-sm font-semibold">
            <Store className="h-4 w-4" />
            Stores
          </div>

          <div className="space-y-1">
            {locationsLoading && (
              <p className="px-2 py-4 text-sm text-muted-foreground">
                Loading stores…
              </p>
            )}

            {(locations ?? []).map((location) => {
              const active = location.id === activeLocationId;

              return (
                <button
                  key={location.id}
                  type="button"
                  onClick={() => setActiveLocationId(location.id)}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted text-foreground"
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate">{location.name}</span>
                    {location.is_main_store && (
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] ${
                          active
                            ? "bg-primary-foreground/20 text-primary-foreground"
                            : "bg-primary/10 text-primary"
                        }`}
                      >
                        main
                      </span>
                    )}
                  </span>
                </button>
              );
            })}

            {!locationsLoading && (locations ?? []).length === 0 && (
              <p className="px-2 py-4 text-sm text-muted-foreground">
                No stores available for your account.
              </p>
            )}
          </div>
        </aside>

        <section className="space-y-4">
          <div className="rounded-xl border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <Boxes className="h-5 w-5 text-primary" />
                  {activeLocation?.name ?? "Store"}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {activeLocation?.is_main_store
                    ? "Main receiving and distribution store."
                    : "Department or room-level store."}
                </p>
              </div>

              <div className="flex flex-wrap gap-2 no-print">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search items"
                    className="w-56 pl-9"
                  />
                </div>

                <Select value={kindFilter} onValueChange={setKindFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All kinds</SelectItem>
                    {KINDS.map((kind) => (
                      <SelectItem key={kind.value} value={kind.value}>
                        {kind.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="border-b px-4 py-3">
              <h3 className="font-semibold">Store balances</h3>
              <p className="text-xs text-muted-foreground">
                Current stock quantity inside the selected store.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2">Item</th>
                    <th className="px-4 py-2">Kind</th>
                    <th className="px-4 py-2">Category</th>
                    <th className="px-4 py-2">Unit</th>
                    <th className="px-4 py-2 text-right">Quantity</th>
                    <th className="px-4 py-2">Updated</th>
                  </tr>
                </thead>

                <tbody className="divide-y">
                  {pageLoading && (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-muted-foreground">
                        Loading…
                      </td>
                    </tr>
                  )}

                  {!pageLoading &&
                    activeBalances.map((row) => (
                      <tr key={row.id} className="hover:bg-muted/40">
                        <td className="px-4 py-2 font-medium">{row.item_name}</td>
                        <td className="px-4 py-2">
                          <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs">
                            {kindLabel(row.kind)}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">
                          {row.category ?? "—"}
                        </td>
                        <td className="px-4 py-2">{row.unit ?? "pcs"}</td>
                        <td className="px-4 py-2 text-right font-mono">
                          {Number(row.quantity ?? 0).toLocaleString()}
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">
                          {formatDate(row.updated_at)}
                        </td>
                      </tr>
                    ))}

                  {!pageLoading && activeBalances.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-muted-foreground">
                        No stock balances in this store yet. Receive or transfer stock
                        into this store.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="border-b px-4 py-3">
              <h3 className="font-semibold">Recent usage</h3>
              <p className="text-xs text-muted-foreground">
                Manual usage, pharmacy dispensing, damaged, expired and adjustment records.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2">Item</th>
                    <th className="px-4 py-2">Reason</th>
                    <th className="px-4 py-2 text-right">Quantity</th>
                    <th className="px-4 py-2">Used by</th>
                    <th className="px-4 py-2">Used at</th>
                    <th className="px-4 py-2">Notes</th>
                  </tr>
                </thead>

                <tbody className="divide-y">
                  {usageLoading && (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-muted-foreground">
                        Loading usage…
                      </td>
                    </tr>
                  )}

                  {!usageLoading &&
                    activeUsage.map((row) => (
                      <tr key={row.id} className="hover:bg-muted/40">
                        <td className="px-4 py-2 font-medium">{row.item_name}</td>
                        <td className="px-4 py-2">
                          <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs">
                            {row.reason}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right font-mono">
                          {Number(row.quantity ?? 0).toLocaleString()}
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">
                          {row.used_by_email ?? "—"}
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">
                          {formatDate(row.used_at)}
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">
                          {row.notes ?? "—"}
                        </td>
                      </tr>
                    ))}

                  {!usageLoading && activeUsage.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-muted-foreground">
                        No usage records for this store yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>

      <div className="print-only hidden">
        <h2 className="text-xl font-bold">Store Stock Report</h2>
        <p className="text-sm">Generated {new Date().toLocaleString()}</p>
      </div>
    </div>
  );
}
