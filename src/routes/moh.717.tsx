/**
 * LabTrack — MOH 717 Monthly Workload Summary
 */

import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/lib/supabase-untyped";
import { useMemo, useState } from "react";
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
import { BarChart3, RefreshCw, RotateCcw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/moh/717")({
  component: () => (
    <AppShell>
      <Moh717 />
    </AppShell>
  ),
});

type AggregateRow = {
  indicator_code: string;
  period_month: string;
  value: number | string;
  computed_at?: string | null;
};

const INDICATOR_LABELS: Record<string, string> = {
  OPD_UNDER5_M: "OPD Under 5 Male",
  OPD_UNDER5_F: "OPD Under 5 Female",
  OPD_OVER5_M: "OPD Over 5 Male",
  OPD_OVER5_F: "OPD Over 5 Female",
  OPD_OVER60: "OPD Over 60",
  LAB_TB: "TB Screening",
  LAB_SYPHILIS: "Syphilis Test",
  LAB_HEPB: "Hepatitis B Test",
  LAB_HEPC: "Hepatitis C Test",
  LAB_URINALYSIS: "Urinalysis",
  LAB_BLOOD_GROUP: "Blood Grouping",
  LAB_FBC: "Full Blood Count",
  LAB_PREGNANCY: "Pregnancy Test",
  LAB_PARASITOLOGY: "Stool O&P",
  LAB_CD4: "CD4 Count",
  LAB_BGLUCOSE: "Blood Glucose",
  LAB_LIPIDS: "Cholesterol / Lipids",
  LAB_VDRL: "VDRL / RPR Test",
  LAB_WIDAL: "Widal Test",
  LAB_MALARIA_SMEAR: "Malaria Blood Smear",
  LAB_MICROSCOPY: "Gram Stain / Microscopy",
  LAB_CULTURE: "Culture & Sensitivity",
  PHARM_ANTIBIOTICS: "Antibiotics Dispensed",
  PHARM_ANALGESICS: "Analgesics Dispensed",
  PHARM_NSAIDS: "NSAIDs Dispensed",
  PHARM_ANTIMALARIALS: "Antimalarials Dispensed",
  PHARM_ANTIHYPERTENSIVES: "Antihypertensives Dispensed",
  PHARM_ANTIDIABETICS: "Antidiabetics Dispensed",
  PHARM_PPI: "PPIs Dispensed",
  PHARM_REHYDRATION: "Rehydration Solutions Dispensed",
  PHARM_ORS: "ORS Dispensed",
  LAB_HIV_KITS: "HIV Test Kits Used",
  LAB_MALARIA_RDT: "Malaria RDTs Used",
  LAB_SYPHILIS_RDT: "Syphilis RDTs Used",
  LAB_GLUCOSE_STRIPS: "Glucose Strips Used",
  LAB_URINE_STRIPS: "Urine Strips Used",
  LAB_SLIDES: "Microscope Slides Used",
  LAB_BLOOD_TUBES: "Blood Tubes / EDTA Tubes Used",
  FP_NEW: "New FP Acceptors",
  FP_REVISIT: "FP Revisits",
  FP_CONSULTATION: "FP Consultations",
  FP_PILLS: "Oral Contraceptive Pills",
  FP_POP: "Progestin Pills",
  FP_ECP: "Emergency Contraception",
  FP_INJECTABLE: "Injectable Contraceptives",
  FP_IMPLANT: "Implant Contraceptives",
  FP_IUCD: "IUCD",
  FP_CONDOMS: "Condoms",
  MCH_ANC1: "First ANC Visits",
  MCH_ANC4: "ANC Visits 4th+",
  MCH_DELIVERY: "Deliveries Conducted",
  MCH_PNC: "Postnatal Visits",
  MCH_DELIVERY_SBA: "Deliveries by Skilled Attendant",
  MCH_LBW: "Low Birth Weight Babies",
  MCH_MMR: "Maternal Deaths",
  MCH_KANGAROO: "Kangaroo Care",
};

const LAB_COMMODITY_CODES = [
  "LAB_HIV_KITS",
  "LAB_MALARIA_RDT",
  "LAB_SYPHILIS_RDT",
  "LAB_GLUCOSE_STRIPS",
  "LAB_URINE_STRIPS",
  "LAB_SLIDES",
  "LAB_BLOOD_TUBES",
];

function getGroup(indicatorCode: string) {
  if (indicatorCode.startsWith("OPD_")) return "MOH 705 — Outpatient";

  if (indicatorCode.startsWith("LAB_") && !LAB_COMMODITY_CODES.includes(indicatorCode)) {
    return "MOH 706 — Laboratory";
  }

  if (indicatorCode.startsWith("PHARM_")) return "MOH 707 — Pharmacy";
  if (LAB_COMMODITY_CODES.includes(indicatorCode)) return "MOH 642 — Lab Commodities";
  if (indicatorCode.startsWith("FP_")) return "MOH FP — Family Planning";
  if (indicatorCode.startsWith("MCH_")) return "MOH MCH — Maternal & Child Health";

  return "Other";
}

function Moh717() {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const monthStart = `${month}-01`;

  const {
    data: rows,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["moh-717", monthStart],
    queryFn: async () => {
      const { data, error } = await db
        .from("moh_monthly_aggregates")
        .select("*")
        .eq("period_month", monthStart)
        .order("indicator_code", { ascending: true });

      if (error) throw new Error(error.message);
      return (data ?? []) as AggregateRow[];
    },
  });

  const grouped = useMemo(() => {
    const map = new Map<
      string,
      {
        group: string;
        total: number;
        rows: Array<{
          indicator_code: string;
          description: string;
          value: number;
          computed_at?: string | null;
        }>;
      }
    >();

    for (const row of rows ?? []) {
      const group = getGroup(row.indicator_code);
      const value = Number(row.value ?? 0);

      if (!map.has(group)) {
        map.set(group, {
          group,
          total: 0,
          rows: [],
        });
      }

      const entry = map.get(group);
      if (!entry) continue;

      entry.total += value;
      entry.rows.push({
        indicator_code: row.indicator_code,
        description: INDICATOR_LABELS[row.indicator_code] ?? row.indicator_code,
        value,
        computed_at: row.computed_at,
      });
    }

    const order = [
      "MOH 705 — Outpatient",
      "MOH 706 — Laboratory",
      "MOH 707 — Pharmacy",
      "MOH 642 — Lab Commodities",
      "MOH FP — Family Planning",
      "MOH MCH — Maternal & Child Health",
      "Other",
    ];

    return Array.from(map.values()).sort(
      (a, b) => order.indexOf(a.group) - order.indexOf(b.group),
    );
  }, [rows]);

  const grandTotal = useMemo(() => {
    return grouped.reduce((sum, group) => sum + group.total, 0);
  }, [grouped]);

  const handleRecalculateAll = async () => {
    try {
      const monthly = await db.rpc("refresh_moh_monthly_aggregates", {
        target_month: monthStart,
      });

      if (monthly.error) throw new Error(monthly.error.message);

      const moh642 = await db.rpc("refresh_moh_642_monthly_aggregates", {
        target_month: monthStart,
      });

      if (moh642.error) throw new Error(moh642.error.message);

      const moh707 = await db.rpc("refresh_moh_707_monthly_aggregates", {
        target_month: monthStart,
      });

      if (moh707.error) throw new Error(moh707.error.message);

      toast.success("MOH monthly summary recalculated.");
      await refetch();
    } catch (error: unknown) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to recalculate MOH monthly summary.",
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />
            MOH 717 — Monthly Workload Summary
          </h1>
          <p className="text-sm text-muted-foreground">
            Monthly summary across outpatient, laboratory, pharmacy, commodities,
            family planning and MCH indicators.
          </p>
        </div>

        <div className="flex items-end gap-2 flex-wrap">
          <div>
            <Label htmlFor="month" className="text-xs">
              Reporting month
            </Label>
            <Input
              id="month"
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-48"
            />
          </div>

          <Button onClick={handleRecalculateAll} variant="default">
            <RotateCcw className="mr-2 h-4 w-4" />
            Recalculate All
          </Button>

          <Button onClick={() => refetch()} variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Total Monthly Workload</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{grandTotal}</div>
            <p className="text-sm text-muted-foreground">
              Total across all monthly MOH aggregates.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Report Groups</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{grouped.length}</div>
            <p className="text-sm text-muted-foreground">
              MOH report groups with data this month.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Indicator Rows</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{rows?.length ?? 0}</div>
            <p className="text-sm text-muted-foreground">
              Individual aggregate indicator rows.
            </p>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="py-8">
            <p className="text-muted-foreground">Loading monthly summary...</p>
          </CardContent>
        </Card>
      ) : grouped.length > 0 ? (
        grouped.map((group) => (
          <Card key={group.group}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-4">
                <span>{group.group}</span>
                <span className="text-sm font-normal text-muted-foreground">
                  Total: {group.total}
                </span>
              </CardTitle>
            </CardHeader>

            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Indicator Code</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {group.rows.map((row) => (
                    <TableRow key={`${group.group}-${row.indicator_code}`}>
                      <TableCell className="font-mono text-xs">
                        {row.indicator_code}
                      </TableCell>
                      <TableCell>{row.description}</TableCell>
                      <TableCell className="text-right">{row.value}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))
      ) : (
        <Card>
          <CardContent className="py-10">
            <p className="text-center text-muted-foreground">
              No monthly MOH data found for this month. Click Recalculate All.
            </p>
          </CardContent>
        </Card>
      )}

      {!isLoading && !isFetching && grouped.length === 0 && (
        <p className="text-center text-xs text-muted-foreground">
          If this remains empty after recalculation, there may be no source
          encounters, pharmacy dispensing, or store usage for this month.
        </p>
      )}
    </div>
  );
}
