/**
 * DischargeChecklist
 * Gate before Close Visit at the SHA Insurance Desk (managed at Reception).
 * Self-contained: fetches its own checklist state for the encounter.
 * Close Visit only becomes enabled when every condition passes.
 */

import { useEffect, useState } from "react";
import { Check, Fingerprint, Loader2, LogOut, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import type { DischargeChecklistItem } from "@/types/biometric";

const LAB_FINAL_STATUSES = new Set(["completed", "cancelled", "declined", "released"]);

export interface DischargeChecklistProps {
  encounterId: string;
  /** Bump to re-fetch checklist state (e.g. after claim submission or clearance). */
  refreshKey?: number;
  /** True when the visit is insured-approved (claim submitted/approved or clearance approved). */
  insuranceApproved: boolean;
  /** SHA-funded visit → biometric DISCHARGE trigger must fire before Close Visit. */
  requireBiometric: boolean;
  closing: boolean;
  onTriggerBiometric: () => void;
  onCloseVisit: () => void;
}

export function DischargeChecklist({
  encounterId,
  refreshKey = 0,
  insuranceApproved,
  requireBiometric,
  closing,
  onTriggerBiometric,
  onCloseVisit,
}: DischargeChecklistProps) {
  const [items, setItems] = useState<DischargeChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [regRes, labRes, rxRes, invRes] = await Promise.all([
        supabase.from("patient_registrations").select("status").eq("id", encounterId).maybeSingle(),
        supabase.from("lab_orders").select("id,status").eq("encounter_id", encounterId),
        supabase.from("prescriptions").select("id,status").eq("registration_id", encounterId),
        supabase
          .from("invoices")
          .select("balance,status")
          .eq("encounter_id", encounterId)
          .maybeSingle(),
      ]);
      if (cancelled) return;

      const regStatus = String(regRes.data?.status ?? "");
      const labs = (labRes.data ?? []) as { status: string | null }[];
      const rxs = (rxRes.data ?? []) as { status: string | null }[];
      const inv = invRes.data as { balance: number | null; status: string | null } | null;

      const pendingLabs = labs.filter((o) => !LAB_FINAL_STATUSES.has(o.status ?? ""));
      const pendingRxs = rxs.filter((r) => r.status === "pending");
      const invoiceSettled = !inv || Number(inv.balance ?? 0) <= 0 || inv.status === "paid";
      const signed = regStatus === "signed" || regStatus === "done";

      const next: DischargeChecklistItem[] = [
        {
          key: "signed",
          label: "Consultation signed & locked",
          passed: signed,
          detail: !signed ? "Sign & Lock the consultation before closing the visit." : undefined,
        },
        {
          key: "labs",
          label: "Labs released (or none ordered)",
          passed: pendingLabs.length === 0,
          detail:
            pendingLabs.length > 0
              ? `${pendingLabs.length} lab order(s) not yet released.`
              : undefined,
        },
        {
          key: "pharmacy",
          label: "Pharmacy dispensed (or none prescribed)",
          passed: pendingRxs.length === 0,
          detail:
            pendingRxs.length > 0
              ? `${pendingRxs.length} prescription(s) still pending.`
              : undefined,
        },
        {
          key: "billing",
          label: "Invoice settled or insurance approved",
          passed: invoiceSettled || insuranceApproved,
          detail:
            !invoiceSettled && !insuranceApproved
              ? "Settle the invoice or submit/approve the insurance claim first."
              : undefined,
        },
      ];
      setItems(next);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [encounterId, refreshKey, insuranceApproved]);

  const allPassed = items.length > 0 && items.every((i) => i.passed);
  const passedCount = items.filter((i) => i.passed).length;

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Discharge checklist</h3>
        <span
          className={`text-xs font-medium ${allPassed ? "text-emerald-600" : "text-amber-600"}`}
        >
          {loading ? "Checking…" : `${passedCount}/${items.length} complete`}
        </span>
      </div>

      <ul className="space-y-1.5">
        {items.map((item) => (
          <li
            key={item.key}
            className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${
              item.passed
                ? "border-emerald-200 bg-emerald-50/50 text-emerald-800"
                : "border-muted bg-muted/20 text-muted-foreground"
            }`}
          >
            {item.passed ? (
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            ) : (
              <X className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            )}
            <div className="min-w-0">
              <div className="font-medium">{item.label}</div>
              {!item.passed && item.detail && (
                <div className="text-xs text-muted-foreground">{item.detail}</div>
              )}
            </div>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
        <p className="text-xs text-muted-foreground">
          {requireBiometric
            ? "SHA-funded visit — patient biometric authorisation is required before the visit can be closed."
            : "All items must be complete before the visit can be closed."}
        </p>
        {requireBiometric ? (
          <Button onClick={onTriggerBiometric} disabled={loading || !allPassed || closing}>
            {closing ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Fingerprint className="mr-1 h-4 w-4" />
            )}
            Authorise & close visit
          </Button>
        ) : (
          <Button
            onClick={onCloseVisit}
            disabled={loading || !allPassed || closing}
            title={!allPassed ? "Complete all discharge checklist items first" : undefined}
          >
            {closing ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="mr-1 h-4 w-4" />
            )}
            Close visit
          </Button>
        )}
      </div>
    </div>
  );
}
