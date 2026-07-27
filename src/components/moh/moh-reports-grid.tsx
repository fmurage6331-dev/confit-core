/**
 * LabTrack — Shared MOH reports grid.
 * Renders MOH report cards using client-side routing (no full page reloads).
 */

import { Link } from "@tanstack/react-router";
import { MOH_REPORTS } from "@/lib/moh-reports";

export function MohReportsGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {MOH_REPORTS.map(({ title, subtitle, description, href, icon: Icon, period }) => (
        <Link key={href} to={href as "/moh/705"}>
          <div className="h-full rounded-xl border bg-card p-5 transition-colors hover:border-primary/50 hover:bg-muted/30 cursor-pointer">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold">{title}</h3>
                <p className="text-sm text-muted-foreground">{subtitle}</p>
              </div>
              <span className="rounded-lg bg-primary/10 p-2 text-primary">
                <Icon className="h-5 w-5" />
              </span>
            </div>

            <p className="mt-3 text-sm text-muted-foreground">{description}</p>

            <span className="mt-3 inline-flex rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {period}
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
