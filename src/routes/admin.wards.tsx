/**
 * AegisCare / LabTrack — Admin: Ward Management
 * Create, edit, deactivate and delete wards.
 * Wards link to room pages via rooms.ward_id FK.
 */

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { BedDouble, Pencil, Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/admin/wards")({
  component: () => (
    <AppShell>
      <AdminWardsPage />
    </AppShell>
  ),
});

// ─── Types ────────────────────────────────────────────────────────────────────

type Ward = {
  id: string;
  name: string;
  ward_type: string | null;
  floor: string | null;
  section: string | null;
  gender_restriction: string | null;
  daily_rate: number | null;
  capacity: number | null;
  is_active: boolean;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const WARD_TYPES = [
  { value: "general", label: "General" },
  { value: "casualty", label: "Casualty / Emergency" },
  { value: "internal_medicine", label: "Internal Medicine" },
  { value: "surgical", label: "Surgical" },
  { value: "maternity", label: "Maternity" },
  { value: "paediatrics", label: "Paediatrics" },
  { value: "orthopedics", label: "Orthopedics" },
  { value: "icu_hdu", label: "ICU / HDU" },
  { value: "isolation", label: "Isolation" },
  { value: "psychiatric", label: "Psychiatric" },
  { value: "oncology", label: "Oncology" },
  { value: "renal", label: "Renal / Dialysis" },
  { value: "cardiology", label: "Cardiology" },
  { value: "neurology", label: "Neurology" },
  { value: "burns", label: "Burns" },
  { value: "rehabilitation", label: "Rehabilitation" },
  { value: "other", label: "Other" },
] as const;

const SECTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "paediatrics", label: "Paediatrics" },
  { value: "mixed", label: "Mixed" },
] as const;

const GENDER_RESTRICTIONS = [
  { value: "male_only", label: "Male only" },
  { value: "female_only", label: "Female only" },
  { value: "children_only", label: "Children only" },
  { value: "none", label: "No restriction" },
] as const;

const EMPTY_WARD: Ward = {
  id: "",
  name: "",
  ward_type: "general",
  floor: "",
  section: null,
  gender_restriction: "none",
  daily_rate: null,
  capacity: null,
  is_active: true,
};

// ─── Main Page ────────────────────────────────────────────────────────────────

function AdminWardsPage() {
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState<Ward[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Ward | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("wards")
      .select("id,name,ward_type,floor,section,gender_restriction,daily_rate,capacity,is_active")
      .order("section", { ascending: true })
      .order("name", { ascending: true });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setRows((data ?? []) as Ward[]);
  }

  useEffect(() => {
    load();
  }, []);

  if (!isAdmin) {
    return <div className="rounded-lg border p-6 text-sm text-muted-foreground">Admins only.</div>;
  }

  function openNew() {
    setEditing({ ...EMPTY_WARD });
    setOpen(true);
  }

  function openEdit(w: Ward) {
    setEditing({ ...w });
    setOpen(true);
  }

  async function remove(id: string) {
    if (
      !confirm("Delete this ward? This cannot be undone and will unlink any rooms pointing to it.")
    )
      return;
    const { error } = await supabase.from("wards").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setRows((r) => r.filter((x) => x.id !== id));
    toast.success("Ward deleted");
  }

  async function onSave() {
    if (!editing) return;
    if (!editing.name.trim()) {
      toast.error("Ward name is required");
      return;
    }
    setSaving(true);
    const payload = {
      name: editing.name.trim(),
      ward_type: editing.ward_type || null,
      floor: editing.floor?.trim() || null,
      section: editing.section || null,
      gender_restriction: editing.gender_restriction === "none" ? null : editing.gender_restriction,
      daily_rate: editing.daily_rate ?? null,
      capacity: editing.capacity ?? null,
      is_active: editing.is_active,
    };

    if (editing.id) {
      const { error } = await supabase.from("wards").update(payload).eq("id", editing.id);
      setSaving(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Ward updated");
    } else {
      const { error } = await supabase.from("wards").insert(payload);
      setSaving(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Ward created");
    }
    setOpen(false);
    setEditing(null);
    load();
  }

  const active = rows.filter((r) => r.is_active);
  const inactive = rows.filter((r) => !r.is_active);

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <BedDouble className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Ward Management</h1>
            <p className="text-sm text-muted-foreground">
              Create and manage inpatient wards. Each ward links to a room page and drives bed
              management and billing.
            </p>
          </div>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-2" /> New ward
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border bg-card p-4 text-center">
          <p className="text-xs text-muted-foreground">Total wards</p>
          <p className="text-3xl font-light mt-1">{rows.length}</p>
        </div>
        <div className="rounded-xl border bg-emerald-50 p-4 text-center">
          <p className="text-xs text-emerald-600">Active</p>
          <p className="text-3xl font-light mt-1 text-emerald-700">{active.length}</p>
        </div>
        <div className="rounded-xl border bg-muted p-4 text-center">
          <p className="text-xs text-muted-foreground">Inactive</p>
          <p className="text-3xl font-light mt-1">{inactive.length}</p>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">Loading wards…</div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
          No wards configured yet. Click "New ward" to add one.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Section</th>
                <th className="px-4 py-3">Floor</th>
                <th className="px-4 py-3">Daily rate</th>
                <th className="px-4 py-3">Capacity</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((w) => (
                <tr key={w.id} className="border-t hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium">{w.name}</td>
                  <td className="px-4 py-3 text-muted-foreground capitalize">
                    {w.ward_type?.replace(/_/g, " ") ?? "—"}
                  </td>
                  <td className="px-4 py-3 capitalize">{w.section ?? "—"}</td>
                  <td className="px-4 py-3">{w.floor ? `Floor ${w.floor}` : "—"}</td>
                  <td className="px-4 py-3">
                    {w.daily_rate != null ? `KES ${Number(w.daily_rate).toLocaleString()}` : "—"}
                  </td>
                  <td className="px-4 py-3">{w.capacity ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Badge
                      className={
                        w.is_active
                          ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                          : "bg-muted text-muted-foreground"
                      }
                    >
                      {w.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(w)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-rose-500 hover:text-rose-600"
                        onClick={() => remove(w.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (!o) {
            setOpen(false);
            setEditing(null);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit ward" : "New ward"}</DialogTitle>
          </DialogHeader>

          {editing && (
            <div className="space-y-4">
              {/* Name */}
              <div className="space-y-1.5">
                <Label>Name *</Label>
                <Input
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  placeholder="e.g. Female Surgical"
                />
              </div>

              {/* Type + Section */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Ward type</Label>
                  <Select
                    value={editing.ward_type ?? "general"}
                    onValueChange={(v) => setEditing({ ...editing, ward_type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WARD_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Section</Label>
                  <Select
                    value={editing.section ?? "mixed"}
                    onValueChange={(v) => setEditing({ ...editing, section: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select section…" />
                    </SelectTrigger>
                    <SelectContent>
                      {SECTIONS.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Floor + Gender restriction */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Floor</Label>
                  <Input
                    value={editing.floor ?? ""}
                    onChange={(e) => setEditing({ ...editing, floor: e.target.value })}
                    placeholder="e.g. 1"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Gender restriction</Label>
                  <Select
                    value={editing.gender_restriction ?? "none"}
                    onValueChange={(v) => setEditing({ ...editing, gender_restriction: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {GENDER_RESTRICTIONS.map((g) => (
                        <SelectItem key={g.value} value={g.value}>
                          {g.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Daily rate + Capacity */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Daily rate (KES)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="50"
                    value={editing.daily_rate ?? ""}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        daily_rate: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    placeholder="e.g. 2000"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Bed capacity</Label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={editing.capacity ?? ""}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        capacity: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    placeholder="e.g. 20"
                  />
                </div>
              </div>

              {/* Active toggle */}
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Active</p>
                  <p className="text-xs text-muted-foreground">
                    Inactive wards are hidden from the inpatient bed grid.
                  </p>
                </div>
                <Switch
                  checked={editing.is_active}
                  onCheckedChange={(v) => setEditing({ ...editing, is_active: v })}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setOpen(false);
                setEditing(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={onSave} disabled={saving}>
              {saving ? "Saving…" : editing?.id ? "Update ward" : "Create ward"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
