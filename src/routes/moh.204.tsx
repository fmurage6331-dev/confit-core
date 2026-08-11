/**
 * AegisCare — MOH 204 Facility Summary Report
 * Monthly summary: OPD, inpatient, deliveries, deaths, lab, pharmacy
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
import { Building2 } from "lucide-react";

export const Route = createFileRoute("/moh/204")({
  component: () => (
    <AppShell>
      <Moh204 />
    </AppShell>
  ),
});

function Moh204() {
  const [month, setMonth] = useState(getDefaultMonth());
  const qc = useQueryClient();

  const from = `${month}-01T00:00:00`;
  const to = `${month}-31T23:59:59`;

  const { data, isLoading } = useQuery({
    queryKey: ["moh-204", month],
    queryFn: async () => {
      const [opd, admissions, deliveries, deaths, labOrders, dispensed] = await Promise.all([
        db
          .from("encounters")
          .select("id", { count: "exact", head: true })
          .eq("encounter_type", "outpatient")
          .gte("created_at", from)
          .lte("created_at", to),
        db
          .from("admissions")
          .select("id", { count: "exact", head: true })
          .gte("admitted_at", from)
          .lte("admitted_at", to),
        db
          .from("clinical_notes")
          .select("id", { count: "exact", head: true })
          .eq("note_type", "mch_delivery")
          .gte("authored_at", from)
          .lte("authored_at", to),
        db
          .from("mortuary_records")
          .select("id", { count: "exact", head: true })
          .eq("intake_type", "internal")
          .gte("admitted_to_mortuary_at", from)
          .lte("admitted_to_mortuary_at", to),
        db
          .from("lab_orders")
          .select("id", { count: "exact", head: true })
          .eq("status", "completed")
          .gte("ordered_at", from)
          .lte("ordered_at", to),
        db
          .from("prescriptions")
          .select("id", { count: "exact", head: true })
          .eq("status", "dispensed")
          .gte("created_at", from)
          .lte("created_at", to),
      ]);
      return {
        opd: opd.count ?? 0,
        admissions: admissions.count ?? 0,
        deliveries: deliveries.count ?? 0,
        deaths: deaths.count ?? 0,
        lab: labOrders.count ?? 0,
        pharmacy: dispensed.count ?? 0,
      };
    },
  });

  const rows = [
    { label: "Total OPD Visits", value: data?.opd ?? 0 },
    { label: "Total Inpatient Admissions", value: data?.admissions ?? 0 },
    { label: "Deliveries Conducted", value: data?.deliveries ?? 0 },
    { label: "In-Facility Deaths", value: data?.deaths ?? 0 },
    { label: "Lab Tests Completed", value: data?.lab ?? 0 },
    { label: "Prescriptions Dispensed", value: data?.pharmacy ?? 0 },
  ];

  return (
    <MohReportShell
      title="MOH 204 — Facility Summary"
      description="Monthly facility activity summary — OPD, inpatient, deliveries, deaths, lab and pharmacy."
      printSubtitle={`Reporting month: ${month}`}
      icon={Building2}
      periodControl={<MohMonthPicker month={month} onChange={setMonth} />}
      onRefresh={() => qc.invalidateQueries({ queryKey: ["moh-204", month] })}
    >
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Facility Activity Summary — {month}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
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
                  <TableRow key={r.label}>
                    <TableCell>{r.label}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {r.value.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </MohReportShell>
  );
}
