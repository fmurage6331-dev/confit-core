/**
 * LabTrack — Shared MOH report shell.
 *
 * Every individual MOH report page (705, 706, 707, 505, 642, FP, MCH, 717)
 * renders the same scaffolding: a title + back-to-dashboard link, a
 * period control, Recalculate / Refresh / Print (/ CSV) actions, and a
 * print-only header. This component centralizes that so each report file
 * only has to describe its own data and table.
 */

import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Printer, RefreshCw, RotateCcw, type LucideIcon } from "lucide-react";

type MohReportShellProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  /** Text shown in the printed header, e.g. "Reporting month: 2026-07" */
  printSubtitle: string;
  /** The period control (month/week picker), rendered before the action buttons. */
  periodControl: ReactNode;
  onRecalculate?: () => void | Promise<void>;
  recalculateLabel?: string;
  onRefresh: () => void;
  onExportCsv?: () => void;
  children: ReactNode;
};

export function MohReportShell({
  icon: Icon,
  title,
  description,
  printSubtitle,
  periodControl,
  onRecalculate,
  recalculateLabel = "Recalculate",
  onRefresh,
  onExportCsv,
  children,
}: MohReportShellProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap no-print">
        <div>
          <Link
            to="/moh"
            className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to MOH Dashboard
          </Link>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Icon className="h-6 w-6" />
            {title}
          </h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>

        <div className="flex items-end gap-2 flex-wrap">
          {periodControl}

          {onRecalculate && (
            <Button onClick={onRecalculate} variant="default">
              <RotateCcw className="mr-2 h-4 w-4" />
              {recalculateLabel}
            </Button>
          )}

          <Button onClick={onRefresh} variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>

          {onExportCsv && (
            <Button variant="outline" onClick={onExportCsv}>
              <Download className="mr-2 h-4 w-4" />
              CSV
            </Button>
          )}

          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
        </div>
      </div>

      <div className="hidden print:block text-center mb-6">
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-sm">{printSubtitle}</p>
        <p className="text-xs text-muted-foreground">Generated {new Date().toLocaleString()}</p>
      </div>

      {children}
    </div>
  );
}
