/**
 * LabTrack — Laboratory Records
 * Copyright (c) 2026 Francis Muhoro. All rights reserved.
 * Author: Francis Muhoro
 */

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/lib/supabase-untyped";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Pencil, Trash2, Plus } from "lucide-react";

export const Route = createFileRoute("/admin/insurance")({
  component: () => (
    <AppShell>
      <AdminInsurance />
    </AppShell>
  ),
});

type CoverageRule = "percentage" | "fixed_per_visit" | "percentage_with_cap";

type Insurer = {
  id: string;
  name: string;
  code: string;
  coverage_percentage: number;
  coverage_rule: CoverageRule;
  per_visit_limit: number | null;
  is_active: boolean;
  insurer_type: string | null;
};

const schema = z.object({
  name: z.string().trim().min(1).max(120),
  code: z
    .string()
    .trim()
    .min(1)
    .max(20)
    .regex(/^[A-Za-z0-9_-]+$/, "Code: letters/numbers only"),
  coverage_percentage: z.coerce.number().min(0).max(100),
  coverage_rule: z.enum(["percentage", "fixed_per_visit", "percentage_with_cap"]),
  per_visit_limit: z.coerce.number().min(0).nullable(),
  is_active: z.boolean(),
  insurer_type: z.string().nullable(),
});

function AdminInsurance() {
  const { user, isAdmin } = useAuth();
  const [rows, setRows] = useState<Insurer[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Insurer | null>(null);
  const [open, setOpen] = useState(false);
  const [plansOpen, setPlansOpen] = useState(false);
  const [selectedForPlans, setSelectedForPlans] = useState<Insurer | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await db
      .from("insurance_providers")
      .select(
        "id,name,code,coverage_percentage,coverage_rule,per_visit_limit,is_active,insurer_type",
      )
      .order("name");
    setLoading(false);
    if (error) {
      toast.error((error as { message: string }).message);
      return;
    }
    setRows((data ?? []) as Insurer[]);
  }
  useEffect(() => {
    load();
  }, []);

  if (!isAdmin) {
    return <div className="rounded-lg border p-6 text-sm text-muted-foreground">Admins only.</div>;
  }

  function openNew() {
    setEditing({
      id: "",
      name: "",
      code: "",
      coverage_percentage: 0,
      coverage_rule: "percentage",
      per_visit_limit: null,
      is_active: true,
      insurer_type: "private",
    });
    setOpen(true);
  }
  function openEdit(r: Insurer) {
    setEditing(r);
    setOpen(true);
  }

  async function remove(id: string) {
    if (!confirm("Delete this insurer?")) return;
    const { error } = await supabase.from("insurance_providers").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setRows((r) => r.filter((x) => x.id !== id));
    toast.success("Deleted");
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;
    const parsed = schema.safeParse({
      name: editing.name,
      code: editing.code,
      coverage_percentage: editing.coverage_percentage,
      coverage_rule: editing.coverage_rule,
      per_visit_limit: editing.coverage_rule === "percentage" ? null : editing.per_visit_limit,
      is_active: editing.is_active,
      insurer_type: editing.insurer_type,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    if (editing.id) {
      const { error } = await db
        .from("insurance_providers")
        .update(parsed.data)
        .eq("id", editing.id);
      if (error) {
        toast.error(error.message);
        return;
      }
    } else {
      const { error } = await db
        .from("insurance_providers")
        .insert({ ...parsed.data, created_by: user!.id });
      if (error) {
        toast.error(error.message);
        return;
      }
    }
    toast.success("Saved");
    setOpen(false);
    setEditing(null);
    load();
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold">Insurance providers</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage insurers shown in patient registration.
          </p>
        </div>
        <Button onClick={openNew}>
          <Plus className="mr-1 h-4 w-4" /> Add insurer
        </Button>
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
            {loading && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  No insurers yet.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-4 py-3 font-medium">{r.name}</td>
                <td className="px-4 py-3">
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{r.code}</code>
                </td>
                <td className="px-4 py-3">
                  {r.coverage_rule === "fixed_per_visit" ? (
                    <span className="text-xs">
                      KSh {Number(r.per_visit_limit ?? 0).toLocaleString()} / visit
                    </span>
                  ) : r.coverage_rule === "percentage_with_cap" ? (
                    <div className="flex items-center gap-3">
                      <Progress value={Number(r.coverage_percentage)} className="h-2 flex-1" />
                      <span className="w-auto text-right text-xs tabular-nums">
                        {Number(r.coverage_percentage)}% ≤ KSh{" "}
                        {Number(r.per_visit_limit ?? 0).toLocaleString()}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <Progress value={Number(r.coverage_percentage)} className="h-2 flex-1" />
                      <span className="w-12 text-right text-xs tabular-nums">
                        {Number(r.coverage_percentage)}%
                      </span>
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  {r.is_active ? (
                    <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                      Active
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Inactive</Badge>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {(r.insurer_type === "private" || r.insurer_type === "corporate") && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mr-2 h-8 px-2 text-xs"
                      onClick={() => {
                        setSelectedForPlans(r);
                        setPlansOpen(true);
                      }}
                    >
                      Plans
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => openEdit(r)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(r.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
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
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Provider Type</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                    value={editing.insurer_type || "private"}
                    onChange={(e) => setEditing({ ...editing, insurer_type: e.target.value })}
                  >
                    <option value="private">Private Insurance</option>
                    <option value="corporate">Corporate</option>
                    <option value="sha_shif">SHA SHIF</option>
                    <option value="sha_phf">SHA PHF</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="code">Short code</Label>
                  <Input
                    id="code"
                    value={editing.code}
                    onChange={(e) => setEditing({ ...editing, code: e.target.value.toUpperCase() })}
                    required
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="name">Provider name</Label>
                <Input
                  id="name"
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="rule">Coverage rule</Label>
                <select
                  id="rule"
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                  value={editing.coverage_rule}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      coverage_rule: e.target.value as CoverageRule,
                      per_visit_limit: null,
                    })
                  }
                >
                  <option value="percentage">Percentage of visit total</option>
                  <option value="fixed_per_visit">Fixed amount per visit</option>
                  <option value="percentage_with_cap">Percentage with per-visit cap</option>
                </select>
              </div>
              {editing.coverage_rule !== "fixed_per_visit" && (
                <div>
                  <Label htmlFor="cov">Coverage percentage</Label>
                  <Input
                    id="cov"
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={editing.coverage_percentage}
                    onChange={(e) =>
                      setEditing({ ...editing, coverage_percentage: Number(e.target.value) })
                    }
                    required
                  />
                </div>
              )}
              {editing.coverage_rule !== "percentage" && (
                <div>
                  <Label htmlFor="limit">
                    {editing.coverage_rule === "fixed_per_visit"
                      ? "Fixed amount per visit (KSh)"
                      : "Maximum per visit (KSh)"}
                  </Label>
                  <Input
                    id="limit"
                    type="number"
                    min={0}
                    step={1}
                    value={editing.per_visit_limit ?? ""}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        per_visit_limit: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    required
                  />
                </div>
              )}
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <div className="text-sm font-medium">Active</div>
                  <div className="text-xs text-muted-foreground">
                    Only active insurers appear in registration.
                  </div>
                </div>
                <Switch
                  checked={editing.is_active}
                  onCheckedChange={(v) => setEditing({ ...editing, is_active: v })}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Save</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <BenefitPlansDialog insurer={selectedForPlans} open={plansOpen} onOpenChange={setPlansOpen} />
    </div>
  );
}

type BenefitCategory = {
  id: string;
  plan_id: string;
  category: string;
  limit_amount: number;
  coverage_percentage: number;
  requires_preauth: boolean;
};

type BenefitPlan = {
  id: string;
  insurer_id: string;
  plan_name: string;
  benefit_period: string;
  is_active: boolean;
  insurance_benefit_categories: BenefitCategory[];
};

function BenefitPlansDialog({
  insurer,
  open,
  onOpenChange,
}: {
  insurer: Insurer | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [plans, setPlans] = useState<BenefitPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingPlan, setEditingPlan] = useState<BenefitPlan | null>(null);

  const loadPlans = async () => {
    if (!insurer) return;
    setLoading(true);
    const { data } = await db
      .from("insurance_benefit_plans")
      .select("*, insurance_benefit_categories(*)")
      .eq("insurer_id", insurer.id);
    setPlans((data ?? []) as unknown as BenefitPlan[]);
    setLoading(false);
  };

  useEffect(() => {
    if (open) void loadPlans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, insurer]);

  async function savePlan(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const planData = {
      insurer_id: insurer?.id,
      plan_name: fd.get("plan_name"),
      benefit_period: fd.get("benefit_period"),
      is_active: true,
    };

    if (editingPlan?.id) {
      await db.from("insurance_benefit_plans").update(planData).eq("id", editingPlan.id);
    } else {
      await db.from("insurance_benefit_plans").insert(planData);
    }
    setEditingPlan(null);
    loadPlans();
    toast.success("Plan saved");
  }

  async function addCategory(planId: string) {
    const cat = window.prompt(
      "Category (inpatient, outpatient, dental, optical, pharmacy, maternity, radiology, other)?",
    );
    const limit = window.prompt("Limit Amount (KSh)?");
    if (!cat || !limit) return;

    await db.from("insurance_benefit_categories").insert({
      plan_id: planId,
      category: cat.toLowerCase(),
      limit_amount: Number(limit),
      coverage_percentage: 100,
    });
    loadPlans();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Benefit Plans — {insurer?.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="rounded-lg border bg-muted/30 p-4">
            <h3 className="text-sm font-semibold mb-3">
              {editingPlan ? "Edit Plan" : "Create New Plan"}
            </h3>
            <form onSubmit={savePlan} className="grid gap-3 sm:grid-cols-3 items-end">
              <div>
                <Label>Plan Name</Label>
                <Input
                  name="plan_name"
                  defaultValue={editingPlan?.plan_name}
                  required
                  placeholder="e.g. Corporate Gold"
                />
              </div>
              <div>
                <Label>Period</Label>
                <select
                  name="benefit_period"
                  defaultValue={editingPlan?.benefit_period || "annual"}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                >
                  <option value="annual">Annual</option>
                  <option value="per_admission">Per Admission</option>
                  <option value="lifetime">Lifetime</option>
                </select>
              </div>
              <div className="flex gap-2">
                <Button type="submit">{editingPlan ? "Update" : "Add Plan"}</Button>
                {editingPlan && (
                  <Button type="button" variant="ghost" onClick={() => setEditingPlan(null)}>
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </div>

          <div className="space-y-4">
            {plans.map((p) => (
              <div key={p.id} className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold">{p.plan_name}</span>
                    <Badge variant="outline" className="ml-2 uppercase text-[10px]">
                      {p.benefit_period}
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setEditingPlan(p)}>
                      Edit
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => addCategory(p.id)}>
                      + Add Limit
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {p.insurance_benefit_categories?.map((c: BenefitCategory) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between rounded bg-muted/50 px-2 py-1 text-xs"
                    >
                      <span className="capitalize">{c.category}</span>
                      <span className="font-mono font-bold">
                        KSh {c.limit_amount.toLocaleString()}
                      </span>
                    </div>
                  ))}
                  {(!p.insurance_benefit_categories ||
                    p.insurance_benefit_categories.length === 0) && (
                    <div className="text-xs text-muted-foreground italic col-span-full">
                      No limits defined for this plan.
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
