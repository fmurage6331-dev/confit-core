/**
 * LabTrack — Laboratory Records
 * Copyright (c) 2026 Francis Muhoro. All rights reserved.
 * Author: Francis Muhoro
 */

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { PermGuard } from "@/lib/require-access";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Printer, Trash2, FlaskConical, Send } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { ParameterTable } from "@/components/parameter-table";
import {
  computeFlag,
  formatStructuredForPrint,
  tryParseStructured,
  type StructuredResult,
} from "@/lib/test-parameters";

export const Route = createFileRoute("/records/$id")({
  component: () => <AppShell><PermGuard perm="records_view"><RecordDetail /></PermGuard></AppShell>,
});

function RecordDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: record, isLoading } = useQuery({
    queryKey: ["record", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("lab_tests").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const [result, setResult] = useState("");
  const [notes, setNotes] = useState("");
  const [structured, setStructured] = useState<StructuredResult | null>(null);
  useEffect(() => {
    if (record) {
      const parsed = tryParseStructured(record.result);
      setStructured(parsed);
      setResult(record.result ?? "");
      setNotes(record.notes ?? "");
    }
  }, [record]);

  const save = useMutation({
    mutationFn: async () => {
      const next = structured ? JSON.stringify(structured) : result.trim() || null;
      const { error } = await supabase.from("lab_tests").update({
        result: next, notes: notes.trim() || null,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["record", id] });
      qc.invalidateQueries({ queryKey: ["records"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("lab_tests").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Record deleted"); navigate({ to: "/records" }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const sendBack = useMutation({
    mutationFn: async (room: string) => {
      const { error } = await supabase.from("lab_tests")
        .update({ sent_to_room: room, sent_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Results sent back to requesting room");
      qc.invalidateQueries({ queryKey: ["record", id] });
      qc.invalidateQueries({ queryKey: ["records"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !record) {
    return <div className="text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="no-print">
        <Link to="/records" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to records
        </Link>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3 no-print">
        <div>
          <h1 className="text-3xl font-bold">{record.patient_name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Lab #{record.lab_number} · {record.test_name}</p>
        </div>
        <div className="flex gap-2">
          {record.sent_to_room && (
            <Button
              variant={record.sent_at ? "outline" : "default"}
              onClick={() => sendBack.mutate(record.sent_to_room as string)}
              disabled={sendBack.isPending || !record.result}
              title={!record.result ? "Enter a result before sending" : ""}
            >
              <Send className="mr-2 h-4 w-4" />
              {record.sent_at
                ? `Re-send to ${record.sent_to_room}`
                : `Send results to ${record.sent_to_room}`}
            </Button>
          )}
          <Button variant="outline" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Print result</Button>
          <Button variant="destructive" onClick={() => { if (confirm("Delete this record?")) remove.mutate(); }}>
            <Trash2 className="mr-2 h-4 w-4" />Delete
          </Button>
        </div>
      </div>

      {record.sent_at && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 no-print">
          Results sent to <span className="font-semibold">{record.sent_to_room}</span> on {format(new Date(record.sent_at), "dd MMM yyyy, HH:mm")}.
        </div>
      )}

      {/* Printable slip */}
      <div className="rounded-xl border bg-card p-8 shadow-[var(--shadow-card)] print:border-0 print:shadow-none">
        <div className="mb-6 flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <FlaskConical className="h-5 w-5" />
            </div>
            <div>
              <div className="font-semibold">LabTrack</div>
              <div className="text-xs text-muted-foreground">Laboratory Test Report</div>
            </div>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <div>Issued: {format(new Date(), "dd MMM yyyy, HH:mm")}</div>
            <div>Lab #: <span className="font-mono">{record.lab_number}</span></div>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
          <Field label="Patient name" value={record.patient_name} />
          <Field label="Age" value={String(record.age)} />
          <Field label="Registration #" value={record.registration_number} />
          <Field label="Lab #" value={record.lab_number} />
          <Field label="Test" value={record.test_name} />
          <Field label="Date" value={format(new Date(record.test_date), "dd MMM yyyy")} />
        </dl>

        <div className="mt-8">
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Result</div>
          {structured ? (
            <PrintableParameters s={structured} />
          ) : (
            <div className="min-h-24 whitespace-pre-wrap rounded-lg border bg-muted/30 p-4 text-sm">
              {record.result || <span className="text-muted-foreground">Pending</span>}
            </div>
          )}
        </div>

        {record.notes && (
          <div className="mt-6">
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Notes</div>
            <div className="whitespace-pre-wrap rounded-lg border bg-muted/30 p-4 text-sm">{record.notes}</div>
          </div>
        )}

        <div className="mt-12 grid grid-cols-2 gap-8 text-xs text-muted-foreground">
          <div>
            <div className="border-b border-foreground/40 pb-8" />
            <div className="mt-1">Lab Technician Signature</div>
          </div>
          <div>
            <div className="border-b border-foreground/40 pb-8" />
            <div className="mt-1">Verified by</div>
          </div>
        </div>
      </div>

      {/* Edit area */}
      <div className="space-y-4 rounded-xl border bg-card p-6 shadow-[var(--shadow-card)] no-print">
        <h2 className="font-semibold">Update result</h2>
        {structured ? (
          <ParameterTable value={structured} onChange={setStructured} />
        ) : (
          <div>
            <Label htmlFor="result">Result</Label>
            <Textarea id="result" rows={4} value={result} onChange={(e) => setResult(e.target.value)} />
          </div>
        )}
        <div>
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="flex justify-end">
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}

function PrintableParameters({ s }: { s: StructuredResult }) {
  const rows = s.parameters.filter((p) => p.value.trim() !== "" || p.name.trim() !== "");
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
        Pending
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Parameter</th>
              <th className="px-3 py-2 text-left font-medium">Result</th>
              <th className="px-3 py-2 text-left font-medium">Unit</th>
              <th className="px-3 py-2 text-left font-medium">Reference range</th>
              <th className="px-3 py-2 text-left font-medium">Flag</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((p, i) => {
              const flag = computeFlag(p.value, p.low, p.high);
              const range = p.low !== null && p.high !== null ? `${p.low} – ${p.high}` : "—";
              return (
                <tr key={i}>
                  <td className="px-3 py-2 font-medium">{p.name}</td>
                  <td className="px-3 py-2 font-mono">{p.value || "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{p.unit || "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{range}</td>
                  <td className="px-3 py-2">
                    {flag && flag !== "Normal" ? (
                      <span className="font-semibold">{flag === "High" ? "▲ High" : "▼ Low"}</span>
                    ) : (
                      <span className="text-muted-foreground">{flag || "—"}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {s.summary?.trim() && (
        <div className="whitespace-pre-wrap rounded-lg border bg-muted/30 p-4 text-sm">{s.summary}</div>
      )}
      {/* Plain-text fallback for environments without table styles */}
      <div className="sr-only">{formatStructuredForPrint(s)}</div>
    </div>
  );
}