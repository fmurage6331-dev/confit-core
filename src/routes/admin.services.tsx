/**
 * LabTrack — Laboratory Records
 * Copyright (c) 2026 Francis Muhoro. All rights reserved.
 * Author: Francis Muhoro
 */

import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Guard } from "@/lib/require-access";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Stethoscope } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/services")({
  component: () => (
    <AppShell>
      <Guard allow={["admin"]}>
        <ServicesAdmin />
      </Guard>
    </AppShell>
  ),
});

type Service = {
  id: string;
  name: string;
  kind: string;
  category: string | null;
  price: number;
  cash_price: number | null;
  insurance_price: number | null;
  is_active: boolean;
};

const KINDS = [
  { value: "service", label: "Service" },
  { value: "lab", label: "Lab test" },
  { value: "radiology", label: "Radiology" },
  { value: "ward", label: "Ward admission" },
  { value: "theater", label: "Theater" },
  { value: "consultation", label: "Consultation" },
  { value: "procedure", label: "Procedure" },
];

function ServicesAdmin() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Service | null>(null);
  const [open, setOpen] = useState(false);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["services"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lab_test_catalog")
        .select("id,name,kind,category,price,cash_price,insurance_price,is_active")
        .order("kind")
        .order("name");
      if (error) throw error;
      return (data ?? []) as Service[];
    },
  });

  const save = useMutation({
    mutationFn: async (v: Partial<Service>) => {
      const payload = {
        name: v.name!.trim(),
        kind: v.kind || "service",
        category: v.category || null,
        cash_price: v.cash_price ?? 0,
        insurance_price: v.insurance_price ?? null,
        price: v.cash_price ?? 0, // keep legacy in sync
        is_active: v.is_active ?? true,
      };
      if (editing) {
        const { error } = await supabase
          .from("lab_test_catalog")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("lab_test_catalog").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Service updated" : "Service added");
      qc.invalidateQueries({ queryKey: ["services"] });
      setOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lab_test_catalog").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["services"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Stethoscope className="h-7 w-7 text-primary" />
            Services & charges
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage services, lab tests, procedures and their charges per payment mode.
          </p>
        </div>
        <Dialog
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (!v) setEditing(null);
          }}
        >
          <DialogTrigger asChild>
            <Button onClick={() => setEditing(null)}>
              <Plus className="mr-2 h-4 w-4" />
              Add service
            </Button>
          </DialogTrigger>
          <ServiceDialog
            initial={editing}
            onSubmit={(v) => save.mutate(v)}
            pending={save.isPending}
          />
        </Dialog>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Kind</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3 text-right">Cash</th>
              <th className="px-4 py-3 text-right">Insurance</th>
              <th className="px-4 py-3">Active</th>
              <th className="px-4 py-3"></th>
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
            {rows?.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-muted-foreground">
                  No services yet.
                </td>
              </tr>
            )}
            {rows?.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-3 font-medium">{r.name}</td>
                <td className="px-4 py-3">
                  <Badge variant="outline" className="capitalize">
                    {r.kind}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{r.category || "—"}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  KSh {Number(r.cash_price ?? r.price ?? 0).toFixed(2)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                  {r.insurance_price != null ? `KSh ${Number(r.insurance_price).toFixed(2)}` : "—"}
                </td>
                <td className="px-4 py-3">
                  {r.is_active ? (
                    <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                      Active
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Off</Badge>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditing(r);
                        setOpen(true);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (confirm(`Delete "${r.name}"?`)) remove.mutate(r.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ServiceDialog({
  initial,
  onSubmit,
  pending,
}: {
  initial: Service | null;
  onSubmit: (v: Partial<Service>) => void;
  pending: boolean;
}) {
  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{initial ? "Edit service" : "Add service"}</DialogTitle>
      </DialogHeader>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          onSubmit({
            name: String(f.get("name") || ""),
            kind: String(f.get("kind") || "service"),
            category: (f.get("category") as string) || null,
            cash_price: Number(f.get("cash_price") || 0),
            insurance_price: f.get("insurance_price") ? Number(f.get("insurance_price")) : null,
            is_active: f.get("is_active") === "on",
          });
        }}
        className="space-y-3"
      >
        <div>
          <Label>Name *</Label>
          <Input name="name" required defaultValue={initial?.name} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Kind</Label>
            <Select name="kind" defaultValue={initial?.kind || "service"}>
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
              defaultValue={initial?.category ?? ""}
              placeholder="e.g. Chemistry"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Cash price (KSh) *</Label>
            <Input
              type="number"
              step="0.01"
              name="cash_price"
              required
              defaultValue={initial?.cash_price ?? initial?.price ?? 0}
            />
          </div>
          <div>
            <Label>Insurance price (KSh)</Label>
            <Input
              type="number"
              step="0.01"
              name="insurance_price"
              defaultValue={initial?.insurance_price ?? ""}
              placeholder="Optional"
            />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="is_active" defaultChecked={initial?.is_active ?? true} />{" "}
          Active
        </label>
        <DialogFooter>
          <Button type="submit" disabled={pending}>
            Save
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
