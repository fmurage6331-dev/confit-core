/**
 * LabTrack — Shared MOH indicator summary card + table.
 * Used by every report that reads a flat list of indicator_code -> value
 * rows out of moh_monthly_aggregates / moh_weekly_aggregates.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type MohIndicatorRow = {
  indicator_code: string;
  description: string;
  value: number;
};

type MohIndicatorTableProps = {
  totalLabel: string;
  totalDescription: string;
  total: number;
  tableTitle: string;
  isLoading: boolean;
  rows: MohIndicatorRow[];
  emptyMessage: string;
};

export function MohIndicatorTable({
  totalLabel,
  totalDescription,
  total,
  tableTitle,
  isLoading,
  rows,
  emptyMessage,
}: MohIndicatorTableProps) {
  const allZero = rows.length > 0 && rows.every((row) => Number(row.value) === 0);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{totalLabel}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-semibold">{total}</div>
          <p className="text-sm text-muted-foreground">{totalDescription}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{tableTitle}</CardTitle>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Indicator Code</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.indicator_code}>
                    <TableCell className="font-mono text-xs">{row.indicator_code}</TableCell>
                    <TableCell>{row.description}</TableCell>
                    <TableCell className="text-right">{row.value}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {!isLoading && allZero && (
            <p className="text-muted-foreground text-center pt-6 no-print">{emptyMessage}</p>
          )}
        </CardContent>
      </Card>
    </>
  );
}
