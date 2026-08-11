/**
 * LabTrack — Laboratory Records
 * Copyright (c) 2026 Francis Muhoro. All rights reserved.
 * Author: Francis Muhoro
 */

import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import {
  Activity,
  BadgeCheck,
  BarChart3,
  BedDouble,
  Building2,
  ChevronRight,
  Clock,
  FileText,
  FlaskConical,
  Lock,
  Pill,
  Receipt,
  ScanLine,
  ShieldCheck,
  Stethoscope,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── NAV ── */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Activity className="h-5 w-5" />
            </div>
            <span className="text-lg font-bold tracking-tight">AegisCare</span>
            <span className="hidden rounded-full border px-2 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline">
              HMS v5.3
            </span>
          </div>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#modules" className="hover:text-foreground transition-colors">
              Modules
            </a>
            <a href="#compliance" className="hover:text-foreground transition-colors">
              Compliance
            </a>
            <a href="#stats" className="hover:text-foreground transition-colors">
              Platform
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/login">Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/login" search={{ mode: "signup" }}>
                Request access
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* ── HERO ── */}
      <section className="relative overflow-hidden border-b bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900 px-6 py-24 text-white md:py-32">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-teal-500/10 via-transparent to-transparent" />
        <div className="mx-auto max-w-5xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-teal-400/30 bg-teal-400/10 px-3 py-1 text-xs font-medium text-teal-300">
            <ShieldCheck className="h-3.5 w-3.5" />
            DHA-compliant · SHA-integrated · KEMSA NLMIS-ready
          </div>
          <h1 className="mt-6 text-4xl font-extrabold leading-tight tracking-tight md:text-6xl">
            Hospital management
            <br />
            <span className="bg-gradient-to-r from-teal-300 to-cyan-300 bg-clip-text text-transparent">
              built for Kenya.
            </span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-slate-300">
            End-to-end digital workflows for reception, triage, lab, pharmacy, radiology, billing
            and inpatient care — designed for SHA contracting eligibility and DHA certification.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="bg-teal-500 text-white hover:bg-teal-400">
              <Link to="/login" search={{ mode: "signup" }}>
                Request access
                <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white/20 bg-white/5 text-white hover:bg-white/10"
            >
              <Link to="/login">Sign in</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── TRUST BAR ── */}
      <section className="border-b bg-muted/30 px-6 py-4">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground md:justify-between">
          {[
            { icon: ShieldCheck, label: "DHA Digital Health Act 2023 Compliant" },
            { icon: BadgeCheck, label: "SHA / SHIF Integration Ready" },
            { icon: FileText, label: "MOH 705A/705B/717 Reporting" },
            { icon: Lock, label: "ODPC Data Protection Registered" },
            { icon: Building2, label: "KEMSA NLMIS Consumption Reporting" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-1.5 font-medium">
              <Icon className="h-3.5 w-3.5 text-teal-600" />
              {label}
            </div>
          ))}
        </div>
      </section>

      {/* ── STATS ── */}
      <section id="stats" className="border-b px-6 py-14">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            {[
              { value: "12", label: "Room kinds supported", sub: "from triage to mortuary" },
              { value: "19", label: "Staff roles", sub: "granular permission gates" },
              { value: "21", label: "DB migrations", sub: "fully audited schema history" },
              { value: "100%", label: "RLS coverage", sub: "every table row-level secured" },
            ].map(({ value, label, sub }) => (
              <div key={label} className="rounded-xl border bg-card p-6 text-center shadow-sm">
                <div className="text-4xl font-extrabold text-primary">{value}</div>
                <div className="mt-1 text-sm font-semibold">{label}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── MODULES ── */}
      <section id="modules" className="border-b px-6 py-16">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-bold">One system. Every department.</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Patients flow seamlessly from registration to discharge — no paper, no silos.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: Users,
                title: "Reception & Registration",
                body: "Register patients, capture SHA member numbers, assign insurance, and route to the right department in seconds.",
                badge: "SHA-ready",
              },
              {
                icon: Activity,
                title: "Triage & Vitals",
                body: "Record vitals, anthropometrics and history. Emergency flag auto-sets SHA ECCIF fund type.",
                badge: "ECCIF auto-flag",
              },
              {
                icon: Stethoscope,
                title: "Consultation & ICD-11",
                body: "Doctor workspace with ICD-11 coded diagnoses, FHIR R4 encounter generation and referral tracking.",
                badge: "FHIR R4",
              },
              {
                icon: FlaskConical,
                title: "Laboratory",
                body: "Lab order queue with inpatient ward/bed location, LOINC codes, WHO-EDL flagging and result entry.",
                badge: "LOINC · WHO-EDL",
              },
              {
                icon: ScanLine,
                title: "Radiology",
                body: "Imaging request routing, inpatient admission context, and radiology results linked to the invoice.",
                badge: "Inpatient-aware",
              },
              {
                icon: Pill,
                title: "Pharmacy & Dispensing",
                body: "Prescription queue, trigger-driven stock deduction, KEMSA NLMIS commodity codes and MedicationDispense FHIR events.",
                badge: "NLMIS · FHIR",
              },
              {
                icon: BedDouble,
                title: "Inpatient & Wards",
                body: "Bed grid, admission management, daily bed charge accrual, clinical notes and discharge summaries.",
                badge: "Charge accrual",
              },
              {
                icon: Receipt,
                title: "Billing & Invoicing",
                body: "Auto-generated invoices, contracted insurance rates per provider, partial payments and SHA claim tracking.",
                badge: "SHA claims",
              },
              {
                icon: BarChart3,
                title: "MOH Reports",
                body: "MOH 705A/705B/717 aggregation, monthly submission tracking and NLMIS consumption CSV export.",
                badge: "705A/705B/717",
              },
            ].map(({ icon: Icon, title, body, badge }) => (
              <div
                key={title}
                className="group rounded-xl border bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="rounded-full border bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {badge}
                  </span>
                </div>
                <h3 className="mt-4 font-semibold">{title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── COMPLIANCE ── */}
      <section id="compliance" className="border-b bg-muted/20 px-6 py-16">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-bold">Built for certification.</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Every feature maps to a DHA or MOH requirement — not retrofitted, designed-in.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: ShieldCheck,
                title: "ICD-11 Coding",
                body: "Validated against the WHO ICD-11 registry with DHA extension URIs.",
              },
              {
                icon: Lock,
                title: "Break-Glass Access",
                body: "SECURITY DEFINER audit trail on every emergency record override.",
              },
              {
                icon: FileText,
                title: "SHR Transmission Log",
                body: "Statutory metadata log per Digital Health (Data Exchange) Regulations 2025.",
              },
              {
                icon: BadgeCheck,
                title: "FHIR R4 Encounters",
                body: "generate_fhir_encounter() produces compliant R4 bundles with SHA identifiers.",
              },
              {
                icon: Clock,
                title: "Audit Archiving",
                body: "pg_cron nightly audit log archival — append-only, tamper-evident.",
              },
              {
                icon: Building2,
                title: "Facility Settings",
                body: "KMHFL code, SHA facility ID, facility level 1–6 all configurable.",
              },
              {
                icon: Users,
                title: "Consent OTPs",
                body: "SHA-256 hashed OTPs with 10-minute expiry for patient consent capture.",
              },
              {
                icon: BarChart3,
                title: "NLMIS Reporting",
                body: "KEMSA commodity codes on stock items, consumption CSV export from /reports.",
              },
            ].map(({ icon: Icon, title, body }) => (
              <div key={title} className="rounded-xl border bg-card p-5 shadow-sm">
                <Icon className="h-5 w-5 text-teal-600" />
                <h3 className="mt-3 text-sm font-semibold">{title}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="border-b bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900 px-6 py-20 text-white">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl font-bold md:text-4xl">Ready to digitise your facility?</h2>
          <p className="mt-4 text-slate-300">
            AegisCare is designed for Kenyan public and private facilities at every level. Request
            access and your administrator will provision your workspace.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="bg-teal-500 text-white hover:bg-teal-400">
              <Link to="/login" search={{ mode: "signup" }}>
                Request access
                <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white/20 bg-white/5 text-white hover:bg-white/10"
            >
              <Link to="/login">Sign in</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="px-6 py-8 text-center text-xs text-muted-foreground">
        <p>
          © 2026 AegisCare HMS · Built by Francis Muhoro ·{" "}
          <span className="text-teal-600">DHA · SHA · MOH · KEMSA</span>
        </p>
      </footer>
    </div>
  );
}

// Avoid unused import warning
void redirect;
