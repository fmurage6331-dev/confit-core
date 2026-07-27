/**
 * LabTrack — MOH 705 Outpatient Summary Report
 * Form 705A (Under 5) and Form 705B (Over 5)
 */

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/supabase-untyped";
import { AppShell } from "@/components/app-shell";
import { MohReportShell } from "@/components/moh/moh-report-shell";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Activity, Stethoscope } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/moh/705")({
  component: () => (
    <AppShell>
      <Moh705Report />
    </AppShell>
  ),
});

type ReportRow = {
  row_number: number;
  disease_name: string;
  icd11_code: string;
  total_cases: number;
  male_cases: number;
  female_cases: number;
};

function getDefaultDates() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const lastDay = String(new Date(yyyy, now.getMonth() + 1, 0).getDate()).padStart(2, "0");

  return {
    start: `${yyyy}-${mm}-01`,
    end: `${yyyy}-${mm}-${lastDay}`,
  };
}

function Moh705Report() {
  const defaults = getDefaultDates();
  const [startDate, setStartDate] = useState(defaults.start);
  const [endDate, setEndDate] = useState(defaults.end);
  const [formType, setFormType] = useState<"A" | "B">("A");
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(false);

  async function loadReport() {
    if (!startDate || !endDate) {
      toast.error("Please select both start and end dates");
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await db.rpc<ReportRow[]>("get_moh_705_report", {
        p_start_date: `${startDate}T00:00:00+03:00`,
        p_end_date: `${endDate}T23:59:59+03:00`,
        p_form_type: formType,
      });

      if (error) throw new Error(error.message);

      setRows(data ?? []);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to load report");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, row) => ({
        total: acc.total + Number(row.total_cases || 0),
        male: acc.male + Number(row.male_cases || 0),
        female: acc.female + Number(row.female_cases || 0),
      }),
      { total: 0, male: 0, female: 0 },
    );
  }, [rows]);

  function exportCSV() {
    if (rows.length === 0) {
      toast.error("No data to export");
      return;
    }

    const header = [
      "Row #",
      "Disease Name",
      "ICD-11 Code",
      "Total Cases",
      "Male Cases",
      "Female Cases",
    ];

    const csvRows = [
      header.join(","),
      ...rows.map((row) =>
        [
          row.row_number,
          `"${row.disease_name}"`,
          `"${row.icd11_code}"`,
          row.total_cases,
          row.male_cases,
          row.female_cases,
        ].join(","),
      ),
    ];

    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = `MOH_705${formType}_${startDate}_to_${endDate}.csv`;
    a.click();

    URL.revokeObjectURL(url);
    toast.success("CSV downloaded");
  }

  const formLabel = formType === "A" ? "705A (Under 5 years)" : "705B (5 years and above)";

  return (
    <MohReportShell
      icon={Stethoscope}
      title="MOH 705 — Outpatient Summary"
      description={`Disease surveillance report. Form ${formLabel}`}
      printSubtitle={`Form ${formLabel} | ${startDate} to ${endDate}`}
      periodControl={
        <>
          <div>
            <Label htmlFor="form-type" className="text-xs">
              Form Type
            </Label>
            <Select value={formType} onValueChange={(value) => setFormType(value as "A" | "B")}>
              <SelectTrigger className="w-56" id="form-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="A">705A — Under 5 years</SelectItem>
                <SelectItem value="B">705B — 5 years and above</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="start-date" className="text-xs">
              Start Date
            </Label>
            <Input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="w-44"
            />
          </div>

          <div>
            <Label htmlFor="end-date" className="text-xs">
              End Date
            </Label>
            <Input
              id="end-date"
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className="w-44"
            />
          </div>
        </>
      }
      onRefresh={loadReport}
      onExportCsv={exportCSV}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Cases</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totals.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Male Cases</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{totals.male}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Female Cases
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-pink-600">{totals.female}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Activity className="h-4 w-4" />
            MOH 705{formType} — Disease Breakdown
          </CardTitle>
        </CardHeader>

        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Loading report data…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No data found for the selected period. Make sure encounters have been recorded with
              diagnoses.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16 text-center">#</TableHead>
                    <TableHead>Disease / Condition</TableHead>
                    <TableHead className="w-28 text-center">ICD-11</TableHead>
                    <TableHead className="w-24 text-center">Total</TableHead>
                    <TableHead className="w-24 text-center">Male</TableHead>
                    <TableHead className="w-24 text-center">Female</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {rows.map((row) => (
                    <TableRow
                      key={row.row_number}
                      className={Number(row.total_cases) > 0 ? "font-medium" : ""}
                    >
                      <TableCell className="text-center text-muted-foreground">
                        {row.row_number}
                      </TableCell>
                      <TableCell>{row.disease_name}</TableCell>
                      <TableCell className="text-center font-mono text-xs text-muted-foreground">
                        {row.icd11_code === "N/A" ? "—" : row.icd11_code}
                      </TableCell>
                      <TableCell className="text-center font-semibold">{row.total_cases}</TableCell>
                      <TableCell className="text-center">{row.male_cases}</TableCell>
                      <TableCell className="text-center">{row.female_cases}</TableCell>
                    </TableRow>
                  ))}

                  <TableRow className="border-t-2 font-bold bg-muted/50">
                    <TableCell className="text-center" />
                    <TableCell>GRAND TOTAL</TableCell>
                    <TableCell className="text-center" />
                    <TableCell className="text-center">{totals.total}</TableCell>
                    <TableCell className="text-center">{totals.male}</TableCell>
                    <TableCell className="text-center">{totals.female}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </MohReportShell>
  );
}
