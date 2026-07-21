/**
 * LabTrack — Hospital Records
 * Copyright (c) 2026 Francis Muhoro. All rights reserved.
 */

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PermGuard } from "@/lib/require-access";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, UserPlus, User } from "lucide-react";

export const Route = createFileRoute("/patients/")({
  component: () => (
    <AppShell>
      <PermGuard perm="records_view">
        <PatientsIndex />
      </PermGuard>
    </AppShell>
  ),
});

type PatientRow = {
  id: string;
  file_number: string | null;
  patient_name: string | null;
  first_name: string | null;
  family_name: string | null;
  phone: string | null;
  sex: string | null;
  date_of_birth: string | null;
  estimated_age: number | null;
  created_at: string;
};

function PatientsIndex() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const term = q.trim();

  const { data, isLoading } = useQuery({
    queryKey: ["patients-search", term],
    queryFn: async () => {
      let query = supabase
        .from("patients")
        .select(
          "id,file_number,patient_name,first_name,family_name,phone,sex,date_of_birth,estimated_age,created_at",
        )
        .order("created_at", { ascending: false })
        .limit(50);

      if (term) {
        const like = `%${term}%`;
        query = query.or(
          `file_number.ilike.${like},patient_name.ilike.${like},first_name.ilike.${like},family_name.ilike.${like},phone.ilike.${like}`,
        );
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as PatientRow[];
    },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Patients</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Search existing patients before registering to avoid duplicates.
          </p>
        </div>
        <Button onClick={() => navigate({ to: "/register-patient" })}>
          <UserPlus className="mr-2 h-4 w-4" /> Register new patient
        </Button>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          placeholder="Search by file number, name, or phone…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">File #</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Sex</th>
              <th className="px-4 py-3">Age</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && data?.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-muted-foreground">
                  {term ? "No matching patients. " : "No patients yet. "}
                  <Link to="/register-patient" className="text-primary hover:underline">
                    Register a new patient →
                  </Link>
                </td>
              </tr>
            )}
            {data?.map((p) => (
              <tr key={p.id} className="hover:bg-accent/40">
                <td className="px-4 py-3 font-mono text-xs">{p.file_number || "—"}</td>
                <td className="px-4 py-3">
                  <Link
                    to="/patients/$id"
                    params={{ id: p.id }}
                    className="flex items-center gap-2 font-medium text-primary hover:underline"
                  >
                    <User className="h-4 w-4" />
                    {p.patient_name ||
                      [p.first_name, p.family_name].filter(Boolean).join(" ") ||
                      "Unnamed"}
                  </Link>
                </td>
                <td className="px-4 py-3 capitalize">{p.sex || "—"}</td>
                <td className="px-4 py-3">{ageDisplay(p)}</td>
                <td className="px-4 py-3">{p.phone || "—"}</td>
                <td className="px-4 py-3 text-right">
                  <Button asChild size="sm" variant="ghost">
                    <Link to="/patients/$id" params={{ id: p.id }}>
                      View
                    </Link>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ageDisplay(p: PatientRow) {
  if (p.date_of_birth) {
    const dob = new Date(p.date_of_birth);
    const years = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000));
    return `${years} y`;
  }
  if (p.estimated_age) return `~${p.estimated_age} y`;
  return "—";
}
