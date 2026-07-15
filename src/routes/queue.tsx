/**
 * LabTrack — Laboratory Records
 * Copyright (c) 2026 Francis Muhoro. All rights reserved.
 * Author: Francis Muhoro
 */

import { createFileRoute } from "@tanstack/react-router";
import { PermGuard } from "@/lib/require-access";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { PaymentBadge } from "@/routes/register-patient";

export const Route = createFileRoute("/queue")({
  component: () => <AppShell><PermGuard perm="view_queue"><Queue /></PermGuard></AppShell>,
});

type Reg = {
  id: string;
  patient_name: string;
  phone: string | null;
  file_number: string | null;
  from_room: string | null;
  payment_mode: "cash" | "insurance" | "free";
  insurance_coverage_percentage: number | null;
  tests: { id: string; name: string; price: number }[];
  subtotal: number;
  insurance_covered: number;
  patient_due: number;
  payment_status: "unpaid" | "paid" | "waived" | "partial";
  amount_paid: number;
  status: "waiting" | "in_progress" | "done" | "cancelled";
  created_at: string;
};

function Queue() {
  const [rows, setRows] = useState<Reg[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const { data, error } = await supabase
      .from("patient_registrations")
      .select("id,patient_name,phone,file_number,from_room,payment_mode,insurance_coverage_percentage,tests,subtotal,insurance_covered,patient_due,payment_status,amount_paid,status,created_at")
      .gte("created_at", today.toISOString())
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setRows((data ?? []) as unknown as Reg[]);
  }
  useEffect(() => { load(); }, []);

  async function setStatus(id: string, status: Reg["status"]) {
    const row = rows.find((r) => r.id === id);
    // Block progression past "waiting" until payment is settled
    if (row && (status === "in_progress" || status === "done")
        && row.payment_status !== "paid" && row.payment_status !== "waived") {
      toast.error("Payment must be processed before proceeding. Open Accounting to record payment.");
      return;
    }
    const { error } = await supabase.from("patient_registrations").update({ status } as never).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setRows((rs) => rs.map((r) => r.id === id ? { ...r, status } : r));
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold">Today's queue</h1>
          <p className="mt-1 text-sm text-muted-foreground">Patients registered today.</p>
        </div>
        <Button variant="outline" onClick={load}>Refresh</Button>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Patient</th>
              <th className="px-4 py-3">From</th>
              <th className="px-4 py-3">Tests</th>
              <th className="px-4 py-3">Mode</th>
              <th className="px-4 py-3 text-right">Subtotal</th>
              <th className="px-4 py-3 text-right">Insurance</th>
              <th className="px-4 py-3 text-right">Patient due</th>
              <th className="px-4 py-3">Payment</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">No patients registered today.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-4 py-3">
                  <div className="font-medium">{r.patient_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.file_number && <>#{r.file_number} · </>}
                    {r.phone || "—"}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Badge variant="outline" className="font-normal">{r.from_room || "—"}</Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {r.tests.map((t) => (
                      <Badge key={t.id} variant="secondary" className="font-normal">{t.name}</Badge>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3"><PaymentBadge mode={r.payment_mode} /></td>
                <td className="px-4 py-3 text-right tabular-nums">KSh {Number(r.subtotal).toFixed(2)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                  {r.payment_mode === "insurance" ? `-KSh ${Number(r.insurance_covered).toFixed(2)}` : "—"}
                </td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums">KSh {Number(r.patient_due).toFixed(2)}</td>
                <td className="px-4 py-3">
                  {(() => {
                    const settled = r.payment_status === "paid" || r.payment_status === "waived";
                    const cls = settled
                      ? "bg-emerald-100 text-emerald-700"
                      : r.payment_status === "partial" ? "bg-blue-100 text-blue-700"
                      : "bg-rose-100 text-rose-700";
                    const label = settled ? (r.payment_status === "waived" ? "Waived" : "Paid")
                      : r.payment_status === "partial" ? "Partial" : "Unpaid";
                    return <Badge className={`${cls} hover:${cls}`}>{label}</Badge>;
                  })()}
                </td>
                <td className="px-4 py-3">
                  <Select value={r.status} onValueChange={(v) => setStatus(r.id, v as Reg["status"])}>
                    <SelectTrigger className="h-8 w-[140px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="waiting">Waiting</SelectItem>
                      <SelectItem value="in_progress">In progress</SelectItem>
                      <SelectItem value="done">Done</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}