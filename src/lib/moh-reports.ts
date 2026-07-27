/**
 * LabTrack — Shared MOH report registry.
 *
 * Single source of truth for the list of MOH reports, their routes and
 * metadata. Used by both the MOH dashboard (src/routes/moh.tsx) and the
 * Reports page (src/routes/reports.tsx) so the two never drift out of sync.
 */

import {
  Activity,
  CalendarDays,
  FlaskConical,
  HeartPulse,
  Package,
  Pill,
  ShieldAlert,
  Stethoscope,
  Users,
  type LucideIcon,
} from "lucide-react";

export type MohReportPeriod = "Monthly" | "Weekly";

export type MohReportDefinition = {
  code: string;
  title: string;
  subtitle: string;
  description: string;
  href: string;
  icon: LucideIcon;
  period: MohReportPeriod;
};

export const MOH_REPORTS: MohReportDefinition[] = [
  {
    code: "705",
    title: "MOH 705",
    subtitle: "Outpatient Report",
    description: "Monthly outpatient attendance by age group and sex. Form 705A & 705B.",
    href: "/moh/705",
    icon: Stethoscope,
    period: "Monthly",
  },
  {
    code: "706",
    title: "MOH 706",
    subtitle: "Laboratory Report",
    description: "Monthly laboratory investigations and tests performed.",
    href: "/moh/706",
    icon: FlaskConical,
    period: "Monthly",
  },
  {
    code: "707",
    title: "MOH 707",
    subtitle: "Pharmacy Report",
    description: "Monthly pharmaceuticals dispensed summary.",
    href: "/moh/707",
    icon: Pill,
    period: "Monthly",
  },
  {
    code: "505",
    title: "MOH 505",
    subtitle: "IDSR Weekly",
    description: "Integrated Disease Surveillance and Response. Weekly reporting.",
    href: "/moh/505",
    icon: ShieldAlert,
    period: "Weekly",
  },
  {
    code: "642",
    title: "MOH 642",
    subtitle: "Lab Commodities",
    description: "Laboratory reagents and consumables usage tracking.",
    href: "/moh/642",
    icon: Package,
    period: "Monthly",
  },
  {
    code: "fp",
    title: "MOH FP",
    subtitle: "Family Planning",
    description: "Family planning services and methods summary.",
    href: "/moh/fp",
    icon: Users,
    period: "Monthly",
  },
  {
    code: "mch",
    title: "MOH MCH",
    subtitle: "Maternal & Child Health",
    description: "ANC, delivery, PNC and maternal-child health indicators.",
    href: "/moh/mch",
    icon: HeartPulse,
    period: "Monthly",
  },
  {
    code: "717",
    title: "MOH 717",
    subtitle: "Monthly Summary",
    description: "Summary across all monthly MOH aggregate indicators.",
    href: "/moh/717",
    icon: CalendarDays,
    period: "Monthly",
  },
];

export const MOH_DASHBOARD_ICON = Activity;
