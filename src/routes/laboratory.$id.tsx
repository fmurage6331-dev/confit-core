/**
 * LabTrack — Laboratory order detail.
 * Enter results (reusing the same structured-parameter templates as
 * Records), finalize, and route the patient back automatically once every
 * requested test for the visit is complete — same routing RPCs records.new.tsx
 * already uses.
 */
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { PermGuard } from "@/lib/require-access";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { ParameterTable } from "@/components/parameter-table";
import { type StructuredResult, type Parameter } from "@/lib/test-parameters";
import { fetchTemplateFor } from "@/lib/test-templates";

export const Route = createFileRoute("/laboratory/$id")({
  component: () => (
    <AppShell>
      <PermGuard perm="lab_view">
        <LaboratoryDetail />
      </PermGuard>
    </AppShell>
  ),
});

type OrderRow = {
  id: string;
  order_number: string | null;
  status: string | null;
  priority: string | null;
  instructions: string | null;
  ordered_at: string;
  patient_id: string | null;
  encounter_id: string | null;
  requested_by_room_id: string | null;
  patients: { patient_name: string | null; file_number: string | null; sex: string | null; estimated_age: number | null } | null;
  lab_test_catalog: { name: string | null; category: string | null } | null;
  rooms: { name: string | null } | null;
};

type ResultRow = {
  id: string;
  order_id: string;
  result: StructuredResult | null;
  performed_by: string | null;
  reported_at: string | null;
};

function LaboratoryDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { hasPerm, user } = useAuth();
  const canWrite = hasPerm("lab_results_create") || hasPerm("lab_update");
  const canUpdateStatus = hasPerm("lab_update");

  const { data: order, isLoading } = useQuery({
    queryKey: ["lab-order", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lab_orders")
        .select("id,order_number,status,priority,instructions,ordered_at,patient_id,encounter_id,requested_by_room_id,patients(patient_name,file_number,sex,estimated_age),lab_test_catalog(name,category),rooms(name)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as unknown as OrderRow;
    },
  });

  const { data: result } = useQuery({
    queryKey: ["lab-result", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lab_results")
        .select("id,order_id,result,performed_by,reported_at")
        .eq("order_id", id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as ResultRow | null;
    },
    enabled: !!order,
  });

  const [template, setTemplate] = useState<Parameter[] | null>(null);
  const [structured, setStructured] = useState<StructuredResult | null>(null);
  const [freeText, setFreeText] = useState("");
  const [performedBy, setPerformedBy] = useState("");

  useEffect(() => {
    setPerformedBy(result?.performed_by ?? user?.email ?? "");
    if (result?.result) {
      setStructured(result.result);
      setFreeText(result.result.summary ?? "");
    }
  }, [result, user?.email]);

  useEffect(() => {
    const testName = order?.lab_test_catalog?.name;
    if (!testName || result) return; // don't clobber an already-saved result
    let cancelled = false;
    fetchTemplateFor(testName).then((tpl) => {
      if (cancelled) return;
      setTemplate(tpl);
      if (tpl) {
        setStructured({ version: 1, parameters: tpl.map((p) => ({ name: p.name, value: "", unit: p.unit, low: p.low, high: p.high })), summary: "" });
      }
    }).catch(() => { if (!cancelled) setTemplate(null); });
    return () => { cancelled = true; };
  }, [order?.lab_test_catalog?.name, result]);

  const updateStatus = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase.from("lab_orders").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lab-order", id] });
      qc.invalidateQueries({ queryKey: ["lab-orders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveResult = useMutation({
    mutationFn: async (opts?: { finalize?: boolean }) => {
      const payload = {
        order_id: id,
        result: template && structured ? { ...structured, summary: freeText } : ({ version: 1, parameters: [], summary: freeText } as StructuredResult),
        performed_by: performedBy.trim() || null,
        reported_at: opts?.finalize ? new Date().toISOString() : (result?.reported_at ?? null),
      };
      if (result?.id) {
        const { error } = await supabase.from("lab_results").update(payload).eq("id", result.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("lab_results").insert(payload);
        if (error) throw error;
      }
      if (opts?.finalize) {
        const { error } = await supabase.from("lab_orders").update({ status: "completed" }).eq("id", id);
        if (error) throw error;

        // Same "route patient back once every requested test for this visit
        // is done" logic used by records.new.tsx, targeted at the room that
        // requested this specific test where we have that tag.
        if (order?.encounter_id) {
          const { data: openOrders } = await supabase
            .from("lab_orders")
            .select("id,status")
            .eq("encounter_id", order.encounter_id)
            .neq("status", "completed")
            .neq("status", "declined")
            .neq("id", id);
          const stillPending = (openOrders ?? []).length > 0;
          if (!stillPending) {
            const { error: routeError } = order.requested_by_room_id
              ? await supabase.rpc("send_lab_result_to_room", { p_encounter_id: order.encounter_id, p_room_id: order.requested_by_room_id })
              : await supabase.rpc("send_lab_results_to_requesting_room", { p_encounter_id: order.encounter_id });
            if (routeError) toast.error(`Result saved, but couldn't route patient back automatically: ${routeError.message}`);
          }
        }
      }
    },
    onSuccess: (_d, vars) => {
      toast.success(vars?.finalize ? "Result finalized" : "Saved");
      qc.invalidateQueries({ queryKey: ["lab-result", id] });
      qc.invalidateQueries({ queryKey: ["lab-order", id] });
      qc.invalidateQueries({ queryKey: ["lab-orders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const decline = useMutation({
    mutationFn: async (reason: string) => {
      const { error } = await supabase.from("lab_orders").update({ status: "declined", decline_reason: reason || null }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lab request declined");
      qc.invalidateQueries({ queryKey: ["lab-orders"] });
      navigate({ to: "/laboratory" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !order) {
    return <div className="text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link to="/laboratory" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to worklist
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">{order.lab_test_catalog?.name ?? "Lab order"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {order.order_number ?? ""} · Ordered {format(new Date(order.ordered_at), "dd MMM yyyy, HH:mm")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill status={order.status} />
          {canUpdateStatus && order.status === "ordered" && (
            <Button variant="outline" size="sm" onClick={() => updateStatus.mutate("in_progress")}>Pick up</Button>
          )}
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-[var(--shadow-card)]">
        <div className="grid gap-4 text-sm sm:grid-cols-2">
          <Field label="Patient">
            {order.patient_id ? (
              <Link to="/patients/$id" params={{ id: order.patient_id }} className="text-primary hover:underline">
                {order.patients?.patient_name ?? "—"}
              </Link>
            ) : (order.patients?.patient_name ?? "—")}
            <div className="text-xs text-muted-foreground">File #{order.patients?.file_number ?? "—"}</div>
          </Field>
          <Field label="Sex / Age">{(order.patients?.sex ?? "—")} · {order.patients?.estimated_age ?? "—"}</Field>
          <Field label="Urgency">{order.priority ?? "routine"}</Field>
          <Field label="Category">{order.lab_test_catalog?.category ?? "—"}</Field>
          <Field label="Ordered by">{order.rooms?.name ?? "—"}</Field>
          <div className="sm:col-span-2">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Instructions</div>
            <div className="mt-1 whitespace-pre-wrap">{order.instructions || <span className="text-muted-foreground">None</span>}</div>
          </div>
        </div>
      </div>

      {order.status !== "declined" ? (
        <div className="space-y-4 rounded-xl border bg-card p-6 shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Result</h2>
            {result?.reported_at && (
              <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                Finalized {format(new Date(result.reported_at), "dd MMM, HH:mm")}
              </Badge>
            )}
          </div>

          {template && structured ? (
            <div className="space-y-2">
              <Label>Parameters</Label>
              <ParameterTable value={structured} onChange={setStructured} />
            </div>
          ) : (
            <div>
              <Label htmlFor="result">Result</Label>
              <Textarea id="result" rows={5} value={freeText} onChange={(e) => setFreeText(e.target.value)} disabled={!canWrite} placeholder="e.g. Negative / Hb: 12.4 g/dL …" />
            </div>
          )}
          {template && structured && (
            <div>
              <Label htmlFor="summary">Summary / comment</Label>
              <Textarea id="summary" rows={2} value={freeText} onChange={(e) => setFreeText(e.target.value)} disabled={!canWrite} />
            </div>
          )}
          <div>
            <Label htmlFor="performed_by">Performed by</Label>
            <Input id="performed_by" value={performedBy} onChange={(e) => setPerformedBy(e.target.value)} disabled={!canWrite} />
          </div>

          {canWrite && (
            <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
              <button
                className="mr-auto text-sm text-rose-600 hover:underline"
                onClick={() => {
                  const reason = window.prompt("Reason for declining this lab request?") ?? "";
                  if (reason.trim()) decline.mutate(reason.trim());
                }}
              >
                Reject lab request
              </button>
              <Button variant="outline" onClick={() => saveResult.mutate(undefined)} disabled={saveResult.isPending}>
                {saveResult.isPending ? "Saving…" : "Save draft"}
              </Button>
              <Button
                onClick={() => {
                  const hasParam = structured?.parameters?.some((p) => p.value?.toString().trim());
                  if (!hasParam && !freeText.trim()) {
                    toast.error("Enter a result before finalizing");
                    return;
                  }
                  saveResult.mutate({ finalize: true });
                }}
                disabled={saveResult.isPending}
              >
                Finalize & mark completed
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          This lab request was declined.
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 font-medium">{children}</div>
    </div>
  );
}

function StatusPill({ status }: { status: string | null }) {
  const cls =
    status === "completed" ? "bg-emerald-100 text-emerald-700"
    : status === "in_progress" ? "bg-blue-100 text-blue-700"
    : status === "declined" ? "bg-rose-100 text-rose-700"
    : "bg-amber-100 text-amber-700";
  return <Badge className={`${cls} hover:${cls}`}>{(status ?? "ordered").replace("_", " ")}</Badge>;
}
