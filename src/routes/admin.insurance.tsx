/**
 * LabTrack — Laboratory Records
 * Copyright (c) 2026 Francis Muhoro. All rights reserved.
 * Author: Francis Muhoro
 */

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Pencil, Trash2, Plus } from "lucide-react";

export const Route = createFileRoute("/admin/insurance")({
  component: () => <AppShell><AdminInsurance /></AppShell>,
});

type Insurer = {
  id: string;
  name: string;
  code: string;
  coverage_percentage: number;
  is_active: boolean;
};

const schema = z.object({
  name: z.string().trim().min(1).max(120),
  code: z.string().trim().min(1).max(20).regex(/^[A-Za-z0-9_-]+$/, "Code: letters/numbers only"),
  coverage_percentage: z.coerce.number().min(0).max(100),
  is_active: z.boolean(),
});

function AdminInsurance() {
  const { user, isAdmin } = useAuth();
  const [rows, setRows] = useState<Insurer[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Insurer | null>(null);
  const [open, setOpen] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from("insurance_providers")
      .select("id,name,code,coverage_percentage,is_active").order("name");
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setRows(data ?? []);
  }
  useEffect(() => { load(); }, []);

  if (!isAdmin) {
    return <div className="rounded-lg border p-6 text-sm text-muted-foreground">Admins only.</div>;
  }

  function openNew() { setEditing({ id: "", name: "", code: "", coverage_percentage: 0, is_active: true }); setOpen(true); }
  function openEdit(r: Insurer) { setEditing(r); setOpen(true); }

  async function remove(id: string) {
    if (!confirm("Delete this insurer?")) return;
    const { error } = await supabase.from("insurance_providers").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setRows((r) => r.filter((x) => x.id !== id));
    toast.success("Deleted");
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;
    const parsed = schema.safeParse({
      name: editing.name, code: editing.code,
      coverage_percentage: editing.coverage_percentage, is_active: editing.is_active,
    });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    if (editing.id) {
      const { error } = await supabase.from("insurance_providers").update(parsed.data).eq("id", editing.id);
      if (error) { toast.error(error.message); return; }
    } else {
      const { error } = await supabase.from("insurance_providers").insert({ ...parsed.data, created_by: user!.id });
      if (error) { toast.error(error.message); return; }
    }
    toast.success("Saved");
    setOpen(false); setEditing(null); load();
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold">Insurance providers</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage insurers shown in patient registration.</p>
        </div>
        <Button onClick={openNew}><Plus className="mr-1 h-4 w-4" /> Add insurer</Button>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3 w-[260px]">Coverage</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No insurers yet.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-4 py-3 font-medium">{r.name}</td>
                <td className="px-4 py-3"><code className="rounded bg-muted px-1.5 py-0.5 text-xs">{r.code}</code></td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Progress value={Number(r.coverage_percentage)} className="h-2 flex-1" />
                    <span className="w-12 text-right text-xs tabular-nums">{Number(r.coverage_percentage)}%</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {r.is_active
                    ? <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Active</Badge>
                    : <Badge variant="secondary">Inactive</Badge>}
                </td>
                <td className="px-4 py-3 text-right">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit insurer" : "Add insurer"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Provider name</Label>
                <Input id="name" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} required />
              </div>
              <div>
                <Label htmlFor="code">Short code</Label>
                <Input id="code" value={editing.code} onChange={(e) => setEditing({ ...editing, code: e.target.value.toUpperCase() })} required />
              </div>
              <div>
                <Label htmlFor="cov">Coverage percentage</Label>
                <Input id="cov" type="number" min={0} max={100} step={1}
                  value={editing.coverage_percentage}
                  onChange={(e) => setEditing({ ...editing, coverage_percentage: Number(e.target.value) })} required />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <div className="text-sm font-medium">Active</div>
                  <div className="text-xs text-muted-foreground">Only active insurers appear in registration.</div>
                </div>
                <Switch checked={editing.is_active} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} />
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit">Save</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}