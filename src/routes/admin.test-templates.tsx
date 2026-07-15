/**
 * LabTrack — Laboratory Records
 * Copyright (c) 2026 Francis Muhoro. All rights reserved.
 * Author: Francis Muhoro
 */

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Trash2, Plus, Pencil, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { fetchMergedTemplates, type TestTemplate } from "@/lib/test-templates";
import type { Parameter } from "@/lib/test-parameters";
import { TEST_PARAMETERS } from "@/lib/test-parameters";

export const Route = createFileRoute("/admin/test-templates")({
  component: () => <AppShell><TestTemplatesAdmin /></AppShell>,
});

function emptyParam(): Parameter {
  return { name: "", unit: "", low: null, high: null };
}

function TestTemplatesAdmin() {
  const { isAdmin, rolesLoading, user } = useAuth();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<TestTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [editing, setEditing] = useState<TestTemplate | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!rolesLoading && !isAdmin) navigate({ to: "/dashboard" });
  }, [isAdmin, rolesLoading, navigate]);

  async function load() {
    setLoading(true);
    try {
      setTemplates(await fetchMergedTemplates());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void load(); }, []);

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q ? templates.filter((t) => t.test_name.toLowerCase().includes(q)) : templates;
  }, [filter, templates]);

  async function save(t: TestTemplate) {
    setSaving(true);
    try {
      const clean: Parameter[] = t.parameters
        .filter((p) => p.name.trim() !== "")
        .map((p) => ({ name: p.name.trim(), unit: p.unit, low: p.low, high: p.high }));
      const { error } = await supabase
        .from("test_templates")
        .upsert(
          { test_name: t.test_name.trim(), parameters: clean as never, created_by: user?.id },
          { onConflict: "test_name" },
        );
      if (error) throw error;
      toast.success("Template saved");
      setEditing(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function remove(t: TestTemplate) {
    if (!confirm(`Delete template "${t.test_name}"?`)) return;
    const { error } = await supabase.from("test_templates").delete().eq("test_name", t.test_name);
    if (error) { toast.error(error.message); return; }
    toast.success("Template deleted");
    await load();
  }

  async function resetToDefault(t: TestTemplate) {
    const defaults = TEST_PARAMETERS[t.test_name];
    if (!defaults) { toast.error("No built-in defaults for this test"); return; }
    await save({ test_name: t.test_name, parameters: defaults });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Test parameter templates</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage parameters and standard reference ranges used when entering results.
          </p>
        </div>
        <Button onClick={() => setEditing({ test_name: "", parameters: [emptyParam()] })}>
          <Plus className="mr-1 h-4 w-4" /> New template
        </Button>
      </div>

      <Input
        placeholder="Search tests…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="max-w-sm"
      />

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Test</th>
              <th className="px-4 py-2 text-left font-medium">Parameters</th>
              <th className="px-4 py-2 text-right font-medium w-48">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading && <tr><td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">Loading…</td></tr>}
            {!loading && visible.length === 0 && (
              <tr><td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">No templates.</td></tr>
            )}
            {visible.map((t) => (
              <tr key={t.test_name}>
                <td className="px-4 py-3 font-medium">{t.test_name}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {t.parameters.length} parameter{t.parameters.length === 1 ? "" : "s"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setEditing({ ...t, parameters: t.parameters.map((p) => ({ ...p })) })}>
                      <Pencil className="mr-1 h-4 w-4" /> Edit
                    </Button>
                    {TEST_PARAMETERS[t.test_name] && (
                      <Button size="sm" variant="ghost" onClick={() => resetToDefault(t)} title="Reset to built-in defaults">
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => remove(t)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit template" : "New template"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="tname">Test name</Label>
                <Input
                  id="tname"
                  value={editing.test_name}
                  onChange={(e) => setEditing({ ...editing, test_name: e.target.value })}
                  placeholder="e.g. Complete Blood Count (CBC)"
                />
              </div>

              <div className="rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Parameter</th>
                      <th className="px-3 py-2 text-left font-medium w-28">Unit</th>
                      <th className="px-3 py-2 text-left font-medium w-24">Low</th>
                      <th className="px-3 py-2 text-left font-medium w-24">High</th>
                      <th className="px-2 py-2 w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {editing.parameters.map((p, i) => {
                      const upd = (patch: Partial<Parameter>) => {
                        const next = editing.parameters.map((x, idx) => idx === i ? { ...x, ...patch } : x);
                        setEditing({ ...editing, parameters: next });
                      };
                      const parseNum = (v: string): number | null => {
                        if (v.trim() === "") return null;
                        const n = parseFloat(v);
                        return Number.isFinite(n) ? n : null;
                      };
                      return (
                        <tr key={i}>
                          <td className="px-3 py-2">
                            <Input value={p.name} onChange={(e) => upd({ name: e.target.value })} className="h-8" />
                          </td>
                          <td className="px-3 py-2">
                            <Input value={p.unit} onChange={(e) => upd({ unit: e.target.value })} className="h-8" />
                          </td>
                          <td className="px-3 py-2">
                            <Input inputMode="decimal" value={p.low ?? ""} onChange={(e) => upd({ low: parseNum(e.target.value) })} className="h-8 font-mono" />
                          </td>
                          <td className="px-3 py-2">
                            <Input inputMode="decimal" value={p.high ?? ""} onChange={(e) => upd({ high: parseNum(e.target.value) })} className="h-8 font-mono" />
                          </td>
                          <td className="px-2 py-2">
                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8"
                              onClick={() => setEditing({ ...editing, parameters: editing.parameters.filter((_, idx) => idx !== i) })}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Button type="button" variant="outline" size="sm"
                onClick={() => setEditing({ ...editing, parameters: [...editing.parameters, emptyParam()] })}>
                <Plus className="mr-1 h-4 w-4" /> Add parameter
              </Button>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button
              disabled={saving || !editing?.test_name.trim()}
              onClick={() => editing && save(editing)}
            >
              {saving ? "Saving…" : "Save template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}