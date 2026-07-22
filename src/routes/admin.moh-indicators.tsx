/**
 * LabTrack — MOH Indicator Definitions Admin (CRUD)
 */

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/moh-indicators")({
  component: () => (
    <AppShell>
      <MohIndicatorAdmin />
    </AppShell>
  ),
});

type Def = {
  id: string;
  form_number: string;
  indicator_code: string;
  description: string | null;
  criteria_type: string | null;
  criteria_value: string | null;
};

const FORM_NUMBERS = ["MOH_717", "MOH_706", "MOH_PHARM", "MOH_FP"];
const CRITERIA_TYPES = ["age_range", "lab_test", "drug_class", "fp_method", "diagnosis", "other"];

function emptyDef(): Omit<Def, "id"> {
  return {
    form_number: "MOH_717",
    indicator_code: "",
    description: "",
    criteria_type: "age_range",
    criteria_value: "",
  };
}

function MohIndicatorAdmin() {
  const { isAdmin, rolesLoading } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Def[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState<Def | null>(null);
  const [creating, setCreating] = useState<Omit<Def, "id"> | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!rolesLoading && !isAdmin) navigate({ to: "/dashboard" });
  }, [isAdmin, rolesLoading, navigate]);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("moh_indicator_definitions")
      .select("id, form_number, indicator_code, description, criteria_type, criteria_value")
      .order("form_number")
      .order("indicator_code");
    if (error) toast.error(error.message);
    setRows((data ?? []) as Def[]);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  const existingCodes = useMemo(
    () => new Set(rows.map((r) => r.indicator_code.toUpperCase())),
    [rows],
  );

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.indicator_code.toLowerCase().includes(q) ||
        r.form_number.toLowerCase().includes(q) ||
        (r.description ?? "").toLowerCase().includes(q),
    );
  }, [rows, filter]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    const draft = editing ?? creating;
    if (!draft) return;
    const code = draft.indicator_code.trim().toUpperCase();
    if (!code) return toast.error("Indicator code is required");
    if (!/^[A-Z0-9_]+$/.test(code))
      return toast.error("Code may only contain A-Z, 0-9, and underscores");
    if (!draft.form_number.trim()) return toast.error("Form number is required");

    // Client-side duplicate check
    const isDuplicate = rows.some(
      (r) => r.indicator_code.toUpperCase() === code && (!editing || r.id !== editing.id),
    );
    if (isDuplicate) return toast.error(`Indicator code "${code}" already exists`);

    setSaving(true);
    try {
      const payload = {
        form_number: draft.form_number.trim(),
        indicator_code: code,
        description: draft.description?.trim() || null,
        criteria_type: draft.criteria_type?.trim() || null,
        criteria_value: draft.criteria_value?.trim() || null,
      };
      if (editing) {
        const { error } = await supabase
          .from("moh_indicator_definitions")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
        toast.success("Indicator updated");
      } else {
        const { error } = await supabase.from("moh_indicator_definitions").insert(payload);
        if (error) throw error;
        toast.success("Indicator added");
      }
      setEditing(null);
      setCreating(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(id: string, code: string) {
    if (!confirm(`Delete indicator "${code}"?`)) return;
    const { error } = await supabase.from("moh_indicator_definitions").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    await load();
  }

  const draft = editing ?? creating;
  const dialogOpen = draft !== null;
  const codeUpper = draft?.indicator_code.trim().toUpperCase() ?? "";
  const duplicateWarning =
    draft &&
    codeUpper &&
    existingCodes.has(codeUpper) &&
    (!editing || editing.indicator_code.toUpperCase() !== codeUpper);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">MOH Indicator Definitions</h1>
          <p className="text-sm text-muted-foreground">
            Rules that map source data to MOH indicator codes for OPD, LAB, PHARM, and FP.
          </p>
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Filter…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-56"
          />
          <Button onClick={() => setCreating(emptyDef())}>
            <Plus className="mr-2 h-4 w-4" /> Add indicator
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Definitions ({rows.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Form</TableHead>
                  <TableHead>Indicator code</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Criteria type</TableHead>
                  <TableHead>Criteria value</TableHead>
                  <TableHead className="w-24 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.form_number}</TableCell>
                    <TableCell className="font-mono text-xs">{r.indicator_code}</TableCell>
                    <TableCell className="text-sm">{r.description}</TableCell>
                    <TableCell className="text-sm">{r.criteria_type}</TableCell>
                    <TableCell className="text-sm">{r.criteria_value}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => setEditing(r)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDelete(r.id, r.indicator_code)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-10 text-center text-sm text-muted-foreground"
                    >
                      No indicators found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={dialogOpen}
        onOpenChange={(o) => {
          if (!o) {
            setEditing(null);
            setCreating(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit indicator" : "Add indicator"}</DialogTitle>
          </DialogHeader>
          {draft && (
            <form onSubmit={onSave} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Form number</Label>
                  <Select
                    value={draft.form_number}
                    onValueChange={(v) => {
                      if (editing) setEditing({ ...editing, form_number: v });
                      else setCreating({ ...draft, form_number: v });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FORM_NUMBERS.map((f) => (
                        <SelectItem key={f} value={f}>
                          {f}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Indicator code</Label>
                  <Input
                    value={draft.indicator_code}
                    onChange={(e) => {
                      const v = e.target.value.toUpperCase();
                      if (editing) setEditing({ ...editing, indicator_code: v });
                      else setCreating({ ...draft, indicator_code: v });
                    }}
                    placeholder="e.g. LAB_HIV"
                  />
                  {duplicateWarning && (
                    <p className="mt-1 text-xs text-destructive">
                      Code "{codeUpper}" already exists.
                    </p>
                  )}
                </div>
              </div>
              <div>
                <Label>Description</Label>
                <Input
                  value={draft.description ?? ""}
                  onChange={(e) => {
                    if (editing) setEditing({ ...editing, description: e.target.value });
                    else setCreating({ ...draft, description: e.target.value });
                  }}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Criteria type</Label>
                  <Select
                    value={draft.criteria_type ?? ""}
                    onValueChange={(v) => {
                      if (editing) setEditing({ ...editing, criteria_type: v });
                      else setCreating({ ...draft, criteria_type: v });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select…" />
                    </SelectTrigger>
                    <SelectContent>
                      {CRITERIA_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Criteria value</Label>
                  <Input
                    value={draft.criteria_value ?? ""}
                    onChange={(e) => {
                      if (editing) setEditing({ ...editing, criteria_value: e.target.value });
                      else setCreating({ ...draft, criteria_value: e.target.value });
                    }}
                    placeholder="e.g. <5, HIV, IMPLANT"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditing(null);
                    setCreating(null);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={saving || !!duplicateWarning}>
                  {saving ? "Saving…" : "Save"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
