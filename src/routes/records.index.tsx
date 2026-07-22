/**
 * LabTrack — Laboratory Records
 * Copyright (c) 2026 Francis Muhoro. All rights reserved.
 * Author: Francis Muhoro
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { PermGuard } from "@/lib/require-access";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, ListPlus } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/records/")({
  component: () => (
    <AppShell>
      <PermGuard perm="records_view">
        <Records />
      </PermGuard>
    </AppShell>
  ),
});

function Records() {
  const [q, setQ] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["records", q],
    queryFn: async () => {
      let query = supabase
        .from("lab_tests")
        .select(
          "id, patient_name, age, registration_number, lab_number, test_name, test_date, result",
        )
        .order("created_at", { ascending: false })
        .limit(200);
      if (q.trim()) {
        const term = `%${q.trim()}%`;
        query = query.or(
          `patient_name.ilike.${term},lab_number.ilike.${term},registration_number.ilike.${term},test_name.ilike.${term}`,
        );
      }
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Records</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Search by patient name, lab number, registration number or test.
          </p>
        </div>
        <Button asChild>
          <Link to="/records/new">
            <ListPlus className="mr-2 h-4 w-4" />
            New test
          </Link>
        </Button>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search records…"
          className="pl-9"
        />
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-[var(--shadow-card)]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Patient</th>
                <th className="px-4 py-3 font-medium">Age</th>
                <th className="px-4 py-3 font-medium">Reg #</th>
                <th className="px-4 py-3 font-medium">Lab #</th>
                <th className="px-4 py-3 font-medium">Test</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              )}
              {!isLoading && data?.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    No matching records.
                  </td>
                </tr>
              )}
              {data?.map((r) => (
                <tr key={r.id} className="cursor-pointer hover:bg-accent/30">
                  <td className="px-4 py-3 font-medium">
                    <Link to="/records/$id" params={{ id: r.id }} className="block">
                      {r.patient_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{r.age}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.registration_number}</td>
                  <td className="px-4 py-3 font-mono text-xs">{r.lab_number}</td>
                  <td className="px-4 py-3">{r.test_name}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {format(new Date(r.test_date), "dd MMM yyyy")}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        r.result ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {r.result ? "Complete" : "Pending"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
