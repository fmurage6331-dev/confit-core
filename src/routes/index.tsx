/**
 * LabTrack — Laboratory Records
 * Copyright (c) 2026 Francis Muhoro. All rights reserved.
 * Author: Francis Muhoro
 */

import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { FlaskConical, ShieldCheck, FileText, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <FlaskConical className="h-5 w-5" />
            </div>
            <span className="text-lg font-semibold">Aegiscare</span>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="ghost"><Link to="/login">Sign in</Link></Button>
            <Button asChild><Link to="/login" search={{ mode: "signup" }}>Get started</Link></Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-20">
        <div className="max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" /> Secure hospital management
          </span>
          <h1 className="mt-6 text-5xl font-bold tracking-tight md:text-6xl">
            Hospital operations,<br />done simply.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground">
            Register patients, run encounters across rooms, and manage billing, pharmacy,
            lab and radiology from one place. Search the archive instantly and print clean
            documents for patients and clinicians.
          </p>
          <div className="mt-8 flex gap-3">
            <Button asChild size="lg"><Link to="/login" search={{ mode: "signup" }}>Create account</Link></Button>
            <Button asChild size="lg" variant="outline"><Link to="/login">Sign in</Link></Button>
          </div>
        </div>

        <div className="mt-20 grid gap-6 md:grid-cols-3">
          {[
            { icon: FlaskConical, title: "Test catalog", body: "Pick from common tests like CBC, Malaria, Urinalysis, LFT and more." },
            { icon: Search, title: "Instant search", body: "Find any record by patient name, lab number or registration number." },
            { icon: FileText, title: "Printable slips", body: "Generate a clean result slip ready for the patient or doctor." },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-xl border bg-card p-6 shadow-[var(--shadow-card)]">
              <Icon className="h-6 w-6 text-primary" />
              <h3 className="mt-4 text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

// Avoid unused import warning
void redirect;