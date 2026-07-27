/**
 * LabTrack — MOH Reports Dashboard
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { MohReportsGrid } from "@/components/moh/moh-reports-grid";
import { Activity, BarChart3 } from "lucide-react";

export const Route = createFileRoute("/moh")({
  component: () => (
    <AppShell>
      <MohDashboard />
    </AppShell>
  ),
});

function MohDashboard() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Activity className="h-8 w-8 text-primary" />
            MOH Reports
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ministry of Health reporting dashboard. Select a report to view or print.
          </p>
        </div>

        <div className="flex gap-2">
          <Link to="/reports">
            <button className="flex items-center gap-2 rounded-md border bg-background px-4 py-2 text-sm font-medium hover:bg-muted">
              <BarChart3 className="h-4 w-4" />
              General Reports
            </button>
          </Link>
        </div>
      </div>

      <MohReportsGrid />
    </div>
  );
}
