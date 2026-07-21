/**
 * LabTrack — Laboratory Records
 * Copyright (c) 2026 Francis Muhoro. All rights reserved.
 * Author: Francis Muhoro
 */

import { Fragment } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/app-shell";
import { Guard } from "@/lib/require-access";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { ShieldCheck, Save } from "lucide-react";

export const Route = createFileRoute("/admin/permissions")({
  component: () => (
    <AppShell>
      <Guard allow={["admin"]}>
        <PermissionsPage />
      </Guard>
    </AppShell>
  ),
});

type Role =
  | "staff"
  | "accountant"
  | "lab_tech"
  | "records_officer"
  | "doctor"
  | "clinical_officer"
  | "nurse"
  | "radiologist"
  | "pharmacist"
  | "mortician";

const ROLES: { key: Role; label: string }[] = [
  { key: "doctor", label: "Doctor" },
  { key: "clinical_officer", label: "Clinical officer" },
  { key: "nurse", label: "Nurse" },
  { key: "radiologist", label: "Radiologist" },
  { key: "pharmacist", label: "Pharmacist" },
  { key: "lab_tech", label: "Lab tech" },
  { key: "records_officer", label: "Records" },
  { key: "accountant", label: "Accountant" },
  { key: "mortician", label: "Mortician" },
  { key: "staff", label: "Staff (general)" },
];

const PERMS: { group: string; items: { key: string; label: string }[] }[] = [
  {
    group: "Reception",
    items: [
      { key: "register_patient", label: "Register patients" },
      { key: "view_queue", label: "View today's queue" },
    ],
  },
  {
    group: "Clinical",
    items: [
      { key: "records_view", label: "View patient records" },
      { key: "records_create", label: "Create / enter records" },
      { key: "order_lab", label: "Order lab tests" },
      { key: "order_radiology", label: "Order radiology" },
      { key: "prescribe", label: "Prescribe medication" },
      { key: "admit_patient", label: "Admit patient" },
      { key: "discharge_patient", label: "Discharge patient" },
      { key: "vitals_update", label: "Update vitals" },
    ],
  },
  {
    group: "Lab",
    items: [
      { key: "lab_results_entry", label: "Enter lab results" },
      { key: "machines", label: "Machines & maintenance" },
      { key: "deliveries", label: "Deliveries" },
      { key: "stock", label: "Stock" },
    ],
  },
  {
    group: "Radiology",
    items: [
      { key: "radiology_view", label: "View radiology orders" },
      { key: "radiology_update", label: "Update radiology status" },
      { key: "radiology_results_create", label: "Enter radiology results" },
    ],
  },
  {
    group: "Pharmacy",
    items: [
      { key: "prescriptions_view", label: "View prescriptions" },
      { key: "prescriptions_dispense", label: "Dispense prescriptions" },
    ],
  },
  {
    group: "Ward / IPD",
    items: [
      { key: "admissions_view", label: "View admissions" },
      { key: "bed_management", label: "Manage beds" },
    ],
  },
  {
    group: "Mortuary",
    items: [
      { key: "mortuary_view", label: "View mortuary" },
      { key: "mortuary_update", label: "Update mortuary" },
    ],
  },
  {
    group: "Accounting",
    items: [{ key: "accounting", label: "Process bills & payments" }],
  },
  {
    group: "Reports (department scoped)",
    items: [
      { key: "reports.registrations", label: "Patient registrations report" },
      { key: "reports.tests", label: "Tests / lab report" },
      { key: "reports.finance", label: "Finance / fund utilisation report" },
      { key: "reports.stock", label: "Stock & deliveries report" },
    ],
  },
];

function PermissionsPage() {
  const { refreshRoles, user } = useAuth();
  const [matrix, setMatrix] = useState<Record<string, Set<string>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from("role_permissions").select("role,permission");
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    const m: Record<string, Set<string>> = {};
    for (const r of ROLES) m[r.key] = new Set();
    for (const row of data ?? []) {
      const role = row.role as string;
      if (!m[role]) m[role] = new Set();
      m[role].add(row.permission as string);
    }
    setMatrix(m);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  function toggle(role: string, perm: string) {
    setMatrix((prev) => {
      const next = { ...prev, [role]: new Set(prev[role]) };
      if (next[role].has(perm)) next[role].delete(perm);
      else next[role].add(perm);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    const allPerms = PERMS.flatMap((g) => g.items.map((i) => i.key));
    // Compute desired & current sets, diff per role.
    const { data: current, error } = await supabase
      .from("role_permissions")
      .select("role,permission");
    if (error) {
      toast.error(error.message);
      setSaving(false);
      return;
    }
    const currentMap: Record<string, Set<string>> = {};
    for (const r of ROLES) currentMap[r.key] = new Set();
    for (const row of current ?? []) {
      const role = row.role as string;
      if (!currentMap[role]) currentMap[role] = new Set();
      currentMap[role].add(row.permission as string);
    }

    const toInsert: { role: Role; permission: string }[] = [];
    const toDelete: { role: Role; permission: string }[] = [];
    for (const r of ROLES) {
      const desired = matrix[r.key] ?? new Set();
      const have = currentMap[r.key] ?? new Set();
      for (const p of allPerms) {
        const want = desired.has(p);
        const has = have.has(p);
        if (want && !has) toInsert.push({ role: r.key, permission: p });
        if (!want && has) toDelete.push({ role: r.key, permission: p });
      }
    }

    if (toInsert.length) {
      const { error: e1 } = await supabase.from("role_permissions").insert(toInsert);
      if (e1) {
        toast.error(e1.message);
        setSaving(false);
        return;
      }
    }
    for (const d of toDelete) {
      const { error: e2 } = await supabase
        .from("role_permissions")
        .delete()
        .eq("role", d.role)
        .eq("permission", d.permission);
      if (e2) {
        toast.error(e2.message);
        setSaving(false);
        return;
      }
    }
    setSaving(false);
    toast.success("Permissions saved");
    // Refresh current user's perms so any change is reflected immediately.
    if (user) await refreshRoles();
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold">
            <ShieldCheck className="h-7 w-7 text-primary" /> Role permissions
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Toggle exactly which features each role can use. Admins always have every permission.
          </p>
        </div>
        <Button onClick={save} disabled={saving || loading}>
          <Save className="mr-2 h-4 w-4" /> {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>

      {loading ? (
        <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
          Loading…
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Permission</th>
                {ROLES.map((r) => (
                  <th key={r.key} className="px-4 py-3 text-center">
                    {r.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMS.map((group) => (
                <Fragment key={group.group}>
                  <tr className="border-t bg-muted/20">
                    <td
                      colSpan={ROLES.length + 1}
                      className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                    >
                      {group.group}
                    </td>
                  </tr>
                  {group.items.map((p) => (
                    <tr key={p.key} className="border-t">
                      <td className="px-4 py-3">
                        <div className="font-medium">{p.label}</div>
                        <div className="text-xs text-muted-foreground">{p.key}</div>
                      </td>
                      {ROLES.map((r) => (
                        <td key={r.key} className="px-4 py-3 text-center">
                          <Checkbox
                            checked={matrix[r.key]?.has(p.key) ?? false}
                            onCheckedChange={() => toggle(r.key, p.key)}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
