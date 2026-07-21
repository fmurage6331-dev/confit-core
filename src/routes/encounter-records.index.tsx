/**
 * LabTrack — Encounter records list.
 * One row per encounter with counts of each documentation type.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { PermGuard } from "@/lib/require-access";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FolderOpen, Search } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/encounter-records/")({
  component: () => (
    <AppShell>
      <PermGuard perm="records_view">
        <EncounterRecordsList />
      </PermGuard>
    </AppShell>
  ),
});

type Row = {
  encounter_id: string | null;
  patient_id: string | null;
  patient_name: string | null;
  encounter_date: string | null;
  encounter_status: string | null;
  invoice_id: string | null;
  invoice_status: string | null;
  total_due: number | null;
  balance: number | null;
  doctor_note_count: number | null;
  discharge_note_count: number | null;
  prescription_count: number | null;
  lab_test_count: number | null;
  radiology_order_count: number | null;
};

function EncounterRecordsList() {
  const [q, setQ] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["encounter-records-summary"],
    queryFn: async () => {
      // Fetch summary; join patients for file_number search.
      const { data, error } = await supabase
        .from("encounter_records_summary")
        .select("*, patients(file_number)")
        .order("encounter_date", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as (Row & {
        patients: { file_number: string | null } | null;
      })[];
    },
  });

  const filtered = useMemo(() => {
    const rows = data ?? [];
    const ql = q.trim().toLowerCase();
    if (!ql) return rows;
    return rows.filter(
      (r) =>
        (r.patient_name ?? "").toLowerCase().includes(ql) ||
        (r.patients?.file_number ?? "").toLowerCase().includes(ql),
    );
  }, [data, q]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <FolderOpen className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Encounter records</h1>
          <p className="text-sm text-muted-foreground">
            All documentation tied to a patient encounter.
          </p>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search patient name or file #…"
          className="pl-9"
        />
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-[var(--shadow-card)]">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Date</th>
              <th className="px-4 py-3 text-left font-medium">Patient</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Bill</th>
              <th className="px-4 py-3 text-left font-medium">Notes</th>
              <th className="px-4 py-3 text-left font-medium">Rx</th>
              <th className="px-4 py-3 text-left font-medium">Lab</th>
              <th className="px-4 py-3 text-left font-medium">Rad</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            )}
            {error && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-rose-600">
                  {(error as Error).message}
                </td>
              </tr>
            )}
            {!isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                  No encounters found.
                </td>
              </tr>
            )}
            {filtered.map((r) => {
              const notes = (r.doctor_note_count ?? 0) + (r.discharge_note_count ?? 0);
              return (
                <tr key={r.encounter_id ?? ""} className="hover:bg-accent/40">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Link
                      to={"/encounter-records/$id" as never}
                      params={{ id: r.encounter_id ?? "" } as never}
                      className="text-primary hover:underline"
                    >
                      {r.encounter_date ? format(new Date(r.encounter_date), "dd MMM, HH:mm") : "—"}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{r.patient_name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.patients?.file_number ?? ""}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">{r.encounter_status ?? "—"}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    {r.invoice_id ? (
                      <div>
                        <Badge variant="outline">{r.invoice_status ?? "draft"}</Badge>
                        {Number(r.balance ?? 0) > 0 && (
                          <div className="text-xs text-rose-600 mt-0.5">
                            Bal {Number(r.balance).toFixed(2)}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {notes || <span className="text-muted-foreground">0</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {r.prescription_count || <span className="text-muted-foreground">0</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {r.lab_test_count || <span className="text-muted-foreground">0</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {r.radiology_order_count || <span className="text-muted-foreground">0</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
