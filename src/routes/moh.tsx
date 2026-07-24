/**
 * LabTrack — MOH Reports Dashboard
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import {
  Activity,
  BarChart3,
  CalendarDays,
  FlaskConical,
  HeartPulse,
  Package,
  Pill,
  ShieldAlert,
  Stethoscope,
  Users,
} from "lucide-react";

export const Route = createFileRoute("/moh")({
  component: () => (
    <AppShell>
      <MohDashboard />
    </AppShell>
  ),
});

const MOH_REPORTS = [
  {
    title: "MOH 705",
    subtitle: "Outpatient Report",
    description: "Monthly outpatient attendance by age group and sex. Form 705A & 705B.",
    href: "/moh/705",
    icon: Stethoscope,
    period: "Monthly",
  },
  {
    title: "MOH 706",
    subtitle: "Laboratory Report",
    description: "Monthly laboratory investigations and tests performed.",
    href: "/moh/706",
    icon: FlaskConical,
    period: "Monthly",
  },
  {
    title: "MOH 707",
    subtitle: "Pharmacy Report",
    description: "Monthly pharmaceuticals dispensed summary.",
    href: "/moh/707",
    icon: Pill,
    period: "Monthly",
  },
  {
    title: "MOH 505",
    subtitle: "IDSR Weekly",
    description: "Integrated Disease Surveillance and Response. Weekly reporting.",
    href: "/moh/505",
    icon: ShieldAlert,
    period: "Weekly",
  },
  {
    title: "MOH 642",
    subtitle: "Lab Commodities",
    description: "Laboratory reagents and consumables usage tracking.",
    href: "/moh/642",
    icon: Package,
    period: "Monthly",
  },
  {
    title: "MOH FP",
    subtitle: "Family Planning",
    description: "Family planning services and methods summary.",
    href: "/moh/fp",
    icon: Users,
    period: "Monthly",
  },
  {
    title: "MOH MCH",
    subtitle: "Maternal & Child Health",
    description: "ANC, delivery, PNC and maternal-child health indicators.",
    href: "/moh/mch",
    icon: HeartPulse,
    period: "Monthly",
  },
  {
    title: "MOH 717",
    subtitle: "Monthly Summary",
    description: "Summary across all monthly MOH aggregate indicators.",
    href: "/moh/717",
    icon: CalendarDays,
    period: "Monthly",
  },
];

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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {MOH_REPORTS.map(
          ({ title, subtitle, description, href, icon: Icon, period }) => (
            <a key={href} href={href}>
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

                <p className="mt-3 text-sm text-muted-foreground">
                  {description}
                </p>

                <span className="mt-3 inline-flex rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {period}
                </span>
              </div>
            </a>
          ),
        )}
      </div>
    </div>
  );
}
