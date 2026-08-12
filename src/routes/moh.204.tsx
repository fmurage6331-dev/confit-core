/**
 * AegisCare — MOH 204 Facility Summary Report (Enhanced)
 * Monthly summary: OPD, inpatient bed-days, theatre, MCH,
 * mortuary, lab critical flags, pharmacy
 */

import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { MohReportShell } from "@/components/moh/moh-report-shell";
import { MohMonthPicker, getDefaultMonth } from "@/components/moh/moh-month-picker";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { db } from "@/lib/supabase-untyped";
import { useState } from "react";
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
  Building2,
  Users,
  BedDouble,
  Scissors,
  Baby,
  Skull,
  FlaskConical,
  Pill,
} from "lucide-react";

export const Route = createFileRoute("/moh/204")({
  component: () => (
    <AppShell>
      <Moh204 />
    </AppShell>
  ),
});

// ── helpers ──────────────────────────────────────────────────────────────────

function daysBetween(a: string, b: string): number {
  return Math.max(
    0,
    Math.floor((new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24)),
  );
}

function SectionCard({
  title,
  icon: Icon,
  rows,
  isLoading,
}: {
  title: string;
  icon: React.ElementType;
  rows: { label: string; value: number | string; sub?: boolean }[];
  isLoading: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Icon className="h-4 w-4 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="py-6 text-center text-sm text-muted-foreground">Loading…</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Indicator</TableHead>
                <TableHead className="text-right">Count</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.label} className={r.sub ? "text-muted-foreground" : ""}>
                  <TableCell className={r.sub ? "pl-8 text-xs" : "font-medium"}>
                    {r.label}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">
                    {typeof r.value === "number" ? r.value.toLocaleString() : r.value}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ── main component ────────────────────────────────────────────────────────────

function Moh204() {
  const [month, setMonth] = useState(getDefaultMonth());
  const qc = useQueryClient();

  const from = `${month}-01T00:00:00`;
  const to = `${month}-31T23:59:59`;
  const nowIso = new Date().toISOString();

  const { data, isLoading } = useQuery({
    queryKey: ["moh-204", month],
    queryFn: async () => {
      const [
        opdAll,
        opdCash,
        opdInsurance,
        opdFree,
        admissionsData,
        currentlyAdmitted,
        theatreOp,
        theatrePreOp,
        ancVisits,
        deliveries,
        pncVisits,
        cwcVisits,
        deathsInternal,
        deathsExternal,
        labCompleted,
        labCritical,
        dispensed,
      ] = await Promise.all([
        // ── OPD ──────────────────────────────────────────────────────────────
        db
          .from("encounters")
          .select("id", { count: "exact", head: true })
          .eq("encounter_type", "outpatient")
          .gte("created_at", from)
          .lte("created_at", to),
        db
          .from("encounters")
          .select("id", { count: "exact", head: true })
          .eq("encounter_type", "outpatient")
          .eq("payment_mode", "cash")
          .gte("created_at", from)
          .lte("created_at", to),
        db
          .from("encounters")
          .select("id", { count: "exact", head: true })
          .eq("encounter_type", "outpatient")
          .eq("payment_mode", "insurance")
          .gte("created_at", from)
          .lte("created_at", to),
        db
          .from("encounters")
          .select("id", { count: "exact", head: true })
          .eq("encounter_type", "outpatient")
          .eq("payment_mode", "free")
          .gte("created_at", from)
          .lte("created_at", to),

        // ── Inpatient bed-days (fetch rows to compute in JS) ─────────────────
        db.from("admissions").select("admitted_at,discharged_at,status").lte("admitted_at", to),

        // Currently admitted
        db.from("admissions").select("id", { count: "exact", head: true }).eq("status", "admitted"),

        // ── Theatre ──────────────────────────────────────────────────────────
        db
          .from("clinical_notes")
          .select("id", { count: "exact", head: true })
          .eq("note_type", "operative_note")
          .gte("authored_at", from)
          .lte("authored_at", to),
        db
          .from("clinical_notes")
          .select("id", { count: "exact", head: true })
          .eq("note_type", "pre_op_checklist")
          .gte("authored_at", from)
          .lte("authored_at", to),

        // ── MCH ──────────────────────────────────────────────────────────────
        db
          .from("clinical_notes")
          .select("id", { count: "exact", head: true })
          .eq("note_type", "mch_anc")
          .gte("authored_at", from)
          .lte("authored_at", to),
        db
          .from("clinical_notes")
          .select("id", { count: "exact", head: true })
          .eq("note_type", "mch_delivery")
          .gte("authored_at", from)
          .lte("authored_at", to),
        db
          .from("clinical_notes")
          .select("id", { count: "exact", head: true })
          .eq("note_type", "mch_pnc")
          .gte("authored_at", from)
          .lte("authored_at", to),
        db
          .from("clinical_notes")
          .select("id", { count: "exact", head: true })
          .eq("note_type", "mch_cwc")
          .gte("authored_at", from)
          .lte("authored_at", to),

        // ── Mortuary ─────────────────────────────────────────────────────────
        db
          .from("mortuary_records")
          .select("id", { count: "exact", head: true })
          .eq("intake_type", "internal")
          .gte("admitted_to_mortuary_at", from)
          .lte("admitted_to_mortuary_at", to),
        db
          .from("mortuary_records")
          .select("id", { count: "exact", head: true })
          .eq("intake_type", "external")
          .gte("admitted_to_mortuary_at", from)
          .lte("admitted_to_mortuary_at", to),

        // ── Lab ──────────────────────────────────────────────────────────────
        db
          .from("lab_orders")
          .select("id", { count: "exact", head: true })
          .eq("status", "completed")
          .gte("ordered_at", from)
          .lte("ordered_at", to),
        db
          .from("lab_orders")
          .select("id", { count: "exact", head: true })
          .eq("is_critical", true)
          .gte("ordered_at", from)
          .lte("ordered_at", to),

        // ── Pharmacy ─────────────────────────────────────────────────────────
        db
          .from("prescriptions")
          .select("id", { count: "exact", head: true })
          .eq("status", "dispensed")
          .gte("created_at", from)
          .lte("created_at", to),
      ]);

      // Bed-days calculation
      type AdmRow = { admitted_at: string; discharged_at: string | null; status: string };
      const admRows = ((admissionsData.data ?? []) as AdmRow[]).filter(
        (a) => !a.discharged_at || a.discharged_at >= `${month}-01T00:00:00`,
      );
      const periodStart = `${month}-01T00:00:00`;
      const periodEnd = `${month}-31T23:59:59`;

      let totalBedDays = 0;
      for (const a of admRows) {
        const start = a.admitted_at > periodStart ? a.admitted_at : periodStart;
        const end = a.discharged_at
          ? a.discharged_at < periodEnd
            ? a.discharged_at
            : periodEnd
          : nowIso < periodEnd
            ? nowIso
            : periodEnd;
        totalBedDays += daysBetween(start, end);
      }

      const totalAdmissions = admRows.length;
      const avgLos = totalAdmissions > 0 ? (totalBedDays / totalAdmissions).toFixed(1) : "0.0";

      return {
        opd: opdAll.count ?? 0,
        opdCash: opdCash.count ?? 0,
        opdInsurance: opdInsurance.count ?? 0,
        opdFree: opdFree.count ?? 0,
        admissions: totalAdmissions,
        bedDays: totalBedDays,
        avgLos,
        currentlyAdmitted: currentlyAdmitted.count ?? 0,
        theatreOp: theatreOp.count ?? 0,
        theatrePreOp: theatrePreOp.count ?? 0,
        anc: ancVisits.count ?? 0,
        deliveries: deliveries.count ?? 0,
        pnc: pncVisits.count ?? 0,
        cwc: cwcVisits.count ?? 0,
        deathsInternal: deathsInternal.count ?? 0,
        deathsExternal: deathsExternal.count ?? 0,
        lab: labCompleted.count ?? 0,
        labCritical: labCritical.count ?? 0,
        pharmacy: dispensed.count ?? 0,
      };
    },
  });

  const d = data;

  return (
    <MohReportShell
      title="MOH 204 — Facility Summary"
      description="Monthly facility activity summary — OPD, inpatient, theatre, MCH, mortuary, lab and pharmacy."
      printSubtitle={`Reporting month: ${month}`}
      icon={Building2}
      periodControl={<MohMonthPicker month={month} onChange={setMonth} />}
      onRefresh={() => qc.invalidateQueries({ queryKey: ["moh-204", month] })}
    >
      <div className="grid gap-4 md:grid-cols-2">
        {/* OPD */}
        <SectionCard
          title="OPD Visits"
          icon={Users}
          isLoading={isLoading}
          rows={[
            { label: "Total OPD Visits", value: d?.opd ?? 0 },
            { label: "Cash", value: d?.opdCash ?? 0, sub: true },
            { label: "Insurance", value: d?.opdInsurance ?? 0, sub: true },
            { label: "Free / Waived", value: d?.opdFree ?? 0, sub: true },
          ]}
        />

        {/* Inpatient */}
        <SectionCard
          title="Inpatient"
          icon={BedDouble}
          isLoading={isLoading}
          rows={[
            { label: "Total Admissions", value: d?.admissions ?? 0 },
            { label: "Total Bed-Days", value: d?.bedDays ?? 0 },
            { label: "Average Length of Stay", value: `${d?.avgLos ?? "0.0"} days` },
            { label: "Currently Admitted", value: d?.currentlyAdmitted ?? 0 },
          ]}
        />

        {/* Theatre */}
        <SectionCard
          title="Theatre"
          icon={Scissors}
          isLoading={isLoading}
          rows={[
            { label: "Operative Cases", value: d?.theatreOp ?? 0 },
            { label: "Pre-op Checklists Done", value: d?.theatrePreOp ?? 0 },
          ]}
        />

        {/* MCH */}
        <SectionCard
          title="MCH / Reproductive Health"
          icon={Baby}
          isLoading={isLoading}
          rows={[
            { label: "ANC Visits", value: d?.anc ?? 0 },
            { label: "Deliveries Conducted", value: d?.deliveries ?? 0 },
            { label: "PNC Visits", value: d?.pnc ?? 0 },
            { label: "CWC Visits", value: d?.cwc ?? 0 },
          ]}
        />

        {/* Mortuary */}
        <SectionCard
          title="Mortuary"
          icon={Skull}
          isLoading={isLoading}
          rows={[
            { label: "In-Facility Deaths", value: d?.deathsInternal ?? 0 },
            { label: "External Bodies Received", value: d?.deathsExternal ?? 0 },
            { label: "Total Bodies", value: (d?.deathsInternal ?? 0) + (d?.deathsExternal ?? 0) },
          ]}
        />

        {/* Lab */}
        <SectionCard
          title="Laboratory"
          icon={FlaskConical}
          isLoading={isLoading}
          rows={[
            { label: "Tests Completed", value: d?.lab ?? 0 },
            { label: "Critical Flags Raised", value: d?.labCritical ?? 0 },
          ]}
        />

        {/* Pharmacy */}
        <SectionCard
          title="Pharmacy"
          icon={Pill}
          isLoading={isLoading}
          rows={[{ label: "Prescriptions Dispensed", value: d?.pharmacy ?? 0 }]}
        />
      </div>
    </MohReportShell>
  );
}
