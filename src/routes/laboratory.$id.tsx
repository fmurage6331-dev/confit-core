/**
 * LabTrack — Laboratory order detail.
 * Enter results with a template-driven dynamic parameter form (numeric /
 * text / select), finalize, and route the patient back automatically once
 * every requested test for the visit is complete — same routing RPCs
 * records.new.tsx already uses.
 */
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/lib/supabase-untyped";
import { AppShell } from "@/components/app-shell";
import { PermGuard } from "@/lib/require-access";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth-context";
import { ArrowLeft, Wand2, Printer } from "lucide-react";
import { PrintHeader } from "@/components/print-header";
import { format } from "date-fns";
import { toast } from "sonner";
import { type StructuredResult } from "@/lib/test-parameters";
import { fetchTemplateFor } from "@/lib/test-templates";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/laboratory/$id")({
  component: () => (
    <AppShell>
      <PermGuard perm="lab_view">
        <LaboratoryDetail />
      </PermGuard>
    </AppShell>
  ),
});

/** Parameter template shape stored in lab_test_catalog.parameters (JSONB). */
type CatalogParameter = {
  name: string;
  unit?: string | null;
  low?: string | number | null;
  high?: string | number | null;
  type?: "numeric" | "text" | "select";
  options?: string[] | null;
};

type FieldSpec = {
  name: string;
  unit: string;
  low: number | null;
  high: number | null;
  type: "numeric" | "text" | "select";
  options: string[];
};

type SavedParameter = {
  name: string;
  value: string;
  unit: string;
  low: number | null;
  high: number | null;
  flag?: Flag;
};

type Flag = "High" | "Low" | "Normal" | "";

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
  specimen_type: string | null;
  collected_at: string | null;
  is_critical: boolean | null;
  patients: {
    patient_name: string | null;
    file_number: string | null;
    sex: string | null;
    estimated_age: number | null;
    phone: string | null;
  } | null;
  lab_test_catalog: {
    name: string | null;
    category: string | null;
    loinc_code: string | null;
    parameters: CatalogParameter[] | null;
  } | null;
  rooms: { name: string | null } | null;
};

type ResultRow = {
  id: string;
  order_id: string;
  result: (StructuredResult & { parameters: SavedParameter[] }) | null;
  performed_by: string | null;
  reported_at: string | null;
  is_critical: boolean | null;
  verified_by: string | null;
  verified_at: string | null;
};

function toNum(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

function flagFor(value: string, low: number | null, high: number | null): Flag {
  const n = parseFloat(value);
  if (!Number.isFinite(n)) return "";
  if (high !== null && n > high) return "High";
  if (low !== null && n < low) return "Low";
  if (low === null && high === null) return "";
  return "Normal";
}

function normalizeSpecs(params: CatalogParameter[]): FieldSpec[] {
  return params
    .filter((p) => p && typeof p.name === "string" && p.name.trim() !== "")
    .map((p) => ({
      name: p.name,
      unit: p.unit ?? "",
      low: toNum(p.low),
      high: toNum(p.high),
      type: p.type === "text" || p.type === "select" ? p.type : "numeric",
      options: Array.isArray(p.options) ? p.options.filter(Boolean) : [],
    }));
}

/** datetime-local value from an ISO string (or now). */
function toLocalInput(iso?: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return format(new Date(), "yyyy-MM-dd'T'HH:mm");
  return format(d, "yyyy-MM-dd'T'HH:mm");
}

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
        .select(
          "id,order_number,status,priority,instructions,ordered_at,patient_id,encounter_id,requested_by_room_id,patients(patient_name,file_number,sex,estimated_age,phone),lab_test_catalog(name,category,loinc_code,parameters),rooms(name)",
        )
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
        .select("id,order_id,result,performed_by,reported_at,is_critical,verified_by,verified_at")
        .eq("order_id", id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as unknown as ResultRow | null;
    },
    enabled: !!order,
  });

  const loinc = order?.lab_test_catalog?.loinc_code ?? null;

  /** Specs straight from the catalog template. */
  const catalogSpecs = useMemo<FieldSpec[]>(
    () => normalizeSpecs(order?.lab_test_catalog?.parameters ?? []),
    [order?.lab_test_catalog?.parameters],
  );

  const [fallbackSpecs, setFallbackSpecs] = useState<FieldSpec[] | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState("");
  const [performedBy, setPerformedBy] = useState("");
  const [reportedAt, setReportedAt] = useState(() => toLocalInput());
  const [specimenType, setSpecimenType] = useState("");
  const [collectedAt, setCollectedAt] = useState(() => toLocalInput());
  const [isCritical, setIsCritical] = useState(false);

  // Legacy fallback: reuse the saved test_templates / built-in ranges when the
  // catalog carries no parameter template.
  useEffect(() => {
    const testName = order?.lab_test_catalog?.name;
    if (!testName || catalogSpecs.length > 0) {
      setFallbackSpecs(null);
      return;
    }
    let cancelled = false;
    fetchTemplateFor(testName)
      .then((tpl) => {
        if (cancelled) return;
        setFallbackSpecs(
          tpl && tpl.length
            ? normalizeSpecs(tpl.map((p) => ({ ...p, type: "numeric" as const })))
            : null,
        );
      })
      .catch(() => {
        if (!cancelled) setFallbackSpecs(null);
      });
    return () => {
      cancelled = true;
    };
  }, [order?.lab_test_catalog?.name, catalogSpecs.length]);

  const specs = useMemo<FieldSpec[]>(
    () => (catalogSpecs.length > 0 ? catalogSpecs : (fallbackSpecs ?? [])),
    [catalogSpecs, fallbackSpecs],
  );
  const hasTemplate = specs.length > 0;
  const hasNumeric = specs.some((s) => s.type === "numeric");

  // Hydrate from a saved result (values keyed by parameter name).
  useEffect(() => {
    setPerformedBy(result?.performed_by ?? user?.email ?? "");
    setReportedAt(toLocalInput(result?.reported_at));
    setIsCritical(result?.is_critical ?? false);
    if (result?.result) {
      setSummary(result.result.summary ?? "");
      const next: Record<string, string> = {};
      for (const p of result.result.parameters ?? []) next[p.name] = p.value ?? "";
      setValues(next);
    }
  }, [result, user?.email]);

  const savedParameters = useMemo<SavedParameter[]>(
    () =>
      specs.map((s) => {
        const value = values[s.name] ?? "";
        return {
          name: s.name,
          value,
          unit: s.unit,
          low: s.low,
          high: s.high,
          flag: s.type === "numeric" ? flagFor(value, s.low, s.high) : "",
        };
      }),
    [specs, values],
  );

  const abnormalCount = savedParameters.filter((p) => p.flag === "High" || p.flag === "Low").length;

  const setValue = (name: string, value: string) =>
    setValues((prev) => ({ ...prev, [name]: value }));

  const fillAllNormal = () => {
    setValues((prev) => {
      const next = { ...prev };
      for (const s of specs) {
        if (s.type !== "numeric") continue;
        if (s.low !== null && s.high !== null) {
          const mid = (s.low + s.high) / 2;
          next[s.name] = String(Number(mid.toFixed(2)));
        } else if (s.low !== null) {
          next[s.name] = String(s.low);
        } else if (s.high !== null) {
          next[s.name] = String(s.high);
        }
      }
      return next;
    });
  };

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
    mutationFn: async (opts?: { finalize?: boolean; verify?: boolean }) => {
      const reportedIso = reportedAt
        ? new Date(reportedAt).toISOString()
        : new Date().toISOString();
      const payload = {
        order_id: id,
        result: {
          version: 1,
          parameters: hasTemplate ? savedParameters : [],
          summary,
        } as unknown as StructuredResult,
        performed_by: performedBy.trim() || null,
        reported_at: opts?.finalize ? reportedIso : (result?.reported_at ?? null),
        is_critical: isCritical,
        verified_by: opts?.verify ? (user?.id ?? null) : (result?.verified_by ?? null),
        verified_at: opts?.verify ? new Date().toISOString() : (result?.verified_at ?? null),
      };

      // Save specimen fields to lab_orders
      if (specimenType || collectedAt) {
        await db
          .from("lab_orders")
          .update({
            specimen_type: specimenType || null,
            collected_at: collectedAt ? new Date(collectedAt).toISOString() : null,
            is_critical: isCritical,
          })
          .eq("id", id);
      }
      if (result?.id) {
        const { error } = await db.from("lab_results").update(payload).eq("id", result.id);
        if (error) throw error;
      } else {
        const { error } = await db.from("lab_results").insert(payload);
        if (error) throw error;
      }
      if (opts?.finalize) {
        const { error } = await supabase
          .from("lab_orders")
          .update({ status: "completed" })
          .eq("id", id);
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
              ? await supabase.rpc("send_lab_result_to_room", {
                  p_encounter_id: order.encounter_id,
                  p_room_id: order.requested_by_room_id,
                })
              : await supabase.rpc("send_lab_results_to_requesting_room", {
                  p_encounter_id: order.encounter_id,
                });
            if (routeError)
              toast.error(
                `Result saved, but couldn't route patient back automatically: ${routeError.message}`,
              );
          }
        }
      }
    },
    onSuccess: async (_d, vars) => {
      toast.success(
        vars?.finalize ? "Result finalized" : vars?.verify ? "Result verified" : "Saved",
      );
      qc.invalidateQueries({ queryKey: ["lab-result", id] });
      qc.invalidateQueries({ queryKey: ["lab-order", id] });
      qc.invalidateQueries({ queryKey: ["lab-orders"] });

      // Send SMS notification on verify only — no PHI in message (ODPC compliant)
      if (vars?.verify) {
        const phone = (order?.patients as unknown as { phone?: string | null })?.phone;
        if (phone) {
          await supabase.functions.invoke("send-sms", {
            body: {
              phone,
              message: `Dear ${order?.patients?.patient_name ?? "Patient"}, your laboratory result from AegisCare is ready. Please visit the facility or call us to discuss your results. Do not share this message.`,
            },
          });
        }
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const decline = useMutation({
    mutationFn: async (reason: string) => {
      const { error } = await supabase
        .from("lab_orders")
        .update({ status: "declined", decline_reason: reason || null })
        .eq("id", id);
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
      <div className="hidden print:block">
        <PrintHeader
          title="Laboratory Result"
          subtitle={order.lab_test_catalog?.name ?? undefined}
        />
      </div>

      <Link
        to="/laboratory"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground print:hidden"
      >
        <ArrowLeft className="h-4 w-4" /> Back to worklist
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">{order.lab_test_catalog?.name ?? "Lab order"}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>
              {order.order_number ?? ""} · Ordered{" "}
              {format(new Date(order.ordered_at), "dd MMM yyyy, HH:mm")}
            </span>
            {loinc && <LoincBadge code={loinc} />}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill status={order.status} />
          {canUpdateStatus && order.status === "ordered" && (
            <Button variant="outline" size="sm" onClick={() => updateStatus.mutate("in_progress")}>
              Pick up
            </Button>
          )}
          {order.status === "completed" && (
            <Button
              variant="outline"
              size="sm"
              className="print:hidden"
              onClick={() => window.print()}
            >
              <Printer className="mr-1 h-4 w-4" /> Print result
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-[var(--shadow-card)]">
        <div className="grid gap-4 text-sm sm:grid-cols-2">
          <Field label="Patient">
            {order.patient_id ? (
              <Link
                to="/patients/$id"
                params={{ id: order.patient_id }}
                className="text-primary hover:underline"
              >
                {order.patients?.patient_name ?? "—"}
              </Link>
            ) : (
              (order.patients?.patient_name ?? "—")
            )}
            <div className="text-xs text-muted-foreground">
              File #{order.patients?.file_number ?? "—"}
            </div>
          </Field>
          <Field label="Sex / Age">
            {order.patients?.sex ?? "—"} · {order.patients?.estimated_age ?? "—"}
          </Field>
          <Field label="Urgency">{order.priority ?? "routine"}</Field>
          <Field label="Category">{order.lab_test_catalog?.category ?? "—"}</Field>
          <Field label="Ordered by">{order.rooms?.name ?? "—"}</Field>
          <div className="sm:col-span-2">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Instructions
            </div>
            <div className="mt-1 whitespace-pre-wrap">
              {order.instructions || <span className="text-muted-foreground">None</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Completed-result summary card */}
      {result?.reported_at && (
        <div className="rounded-xl border bg-muted/30 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">
                  {order.lab_test_catalog?.name ?? "Lab result"}
                </span>
                {loinc && <LoincBadge code={loinc} />}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Reported {format(new Date(result.reported_at), "dd MMM yyyy, HH:mm")}
                {result.performed_by ? ` · by ${result.performed_by}` : ""}
              </div>
            </div>
            <Badge
              className={
                abnormalCount > 0
                  ? "bg-rose-100 text-rose-700 hover:bg-rose-100"
                  : "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
              }
            >
              {abnormalCount > 0
                ? `${abnormalCount} abnormal value${abnormalCount === 1 ? "" : "s"}`
                : "All values normal"}
            </Badge>
          </div>
        </div>
      )}

      {order.status !== "declined" ? (
        <div className="space-y-5 rounded-xl border bg-card p-6 shadow-[var(--shadow-card)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold">Result entry</h2>
              {loinc && <LoincBadge code={loinc} />}
            </div>
            {result?.reported_at && (
              <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                Finalized {format(new Date(result.reported_at), "dd MMM, HH:mm")}
              </Badge>
            )}
          </div>

          {hasTemplate ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label>Parameters</Label>
                {hasNumeric && canWrite && (
                  <Button type="button" variant="outline" size="sm" onClick={fillAllNormal}>
                    <Wand2 className="mr-1 h-4 w-4" /> All normal
                  </Button>
                )}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {specs.map((s) => (
                  <ParameterField
                    key={s.name}
                    spec={s}
                    value={values[s.name] ?? ""}
                    disabled={!canWrite}
                    onChange={(v) => setValue(s.name, v)}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div>
              <Label htmlFor="result">Result</Label>
              <Textarea
                id="result"
                rows={5}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                disabled={!canWrite}
                placeholder="e.g. Negative / Hb: 12.4 g/dL …"
              />
            </div>
          )}

          {hasTemplate && (
            <div>
              <Label htmlFor="summary">Summary / Interpretation</Label>
              <Textarea
                id="summary"
                rows={3}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                disabled={!canWrite}
                placeholder="Overall interpretation, clinical comment…"
              />
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="specimen_type">Specimen type</Label>
              <Select value={specimenType} onValueChange={setSpecimenType}>
                <SelectTrigger id="specimen_type">
                  <SelectValue placeholder="Select specimen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="blood">Blood</SelectItem>
                  <SelectItem value="urine">Urine</SelectItem>
                  <SelectItem value="stool">Stool</SelectItem>
                  <SelectItem value="sputum">Sputum</SelectItem>
                  <SelectItem value="swab">Swab</SelectItem>
                  <SelectItem value="csf">CSF</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="collected_at">Specimen collected at</Label>
              <Input
                id="collected_at"
                type="datetime-local"
                value={collectedAt}
                onChange={(e) => setCollectedAt(e.target.value)}
                disabled={!canWrite}
              />
            </div>
            <div>
              <Label htmlFor="performed_by">Performed by</Label>
              <Input
                id="performed_by"
                value={performedBy}
                onChange={(e) => setPerformedBy(e.target.value)}
                disabled={!canWrite}
              />
            </div>
            <div>
              <Label htmlFor="reported_at">Reported at</Label>
              <Input
                id="reported_at"
                type="datetime-local"
                value={reportedAt}
                onChange={(e) => setReportedAt(e.target.value)}
                disabled={!canWrite}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <div className="text-sm font-medium text-rose-700">Mark as Critical</div>
              <div className="text-xs text-muted-foreground">
                Flags this result for urgent clinician review
              </div>
            </div>
            <input
              type="checkbox"
              checked={isCritical}
              onChange={(e) => setIsCritical(e.target.checked)}
              disabled={!canWrite}
              className="h-4 w-4 accent-rose-600"
            />
          </div>

          {result?.verified_at && (
            <div className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-xs text-teal-700">
              ✓ Verified by {result.verified_by ?? "—"} on{" "}
              {format(new Date(result.verified_at), "dd MMM yyyy, HH:mm")}
            </div>
          )}

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
              <Button
                variant="outline"
                onClick={() => saveResult.mutate(undefined)}
                disabled={saveResult.isPending}
              >
                {saveResult.isPending ? "Saving…" : "Save draft"}
              </Button>
              {result?.reported_at && !result?.verified_at && (
                <Button
                  variant="outline"
                  className="border-teal-300 text-teal-700 hover:bg-teal-50"
                  onClick={() => saveResult.mutate({ verify: true })}
                  disabled={saveResult.isPending}
                >
                  Verify result
                </Button>
              )}
              <Button
                onClick={() => {
                  const hasParam = savedParameters.some((p) => p.value.trim() !== "");
                  if (!hasParam && !summary.trim()) {
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

function ParameterField({
  spec,
  value,
  disabled,
  onChange,
}: {
  spec: FieldSpec;
  value: string;
  disabled: boolean;
  onChange: (v: string) => void;
}) {
  const flag = spec.type === "numeric" ? flagFor(value, spec.low, spec.high) : "";
  const abnormal = flag === "High" || flag === "Low";
  const ref =
    spec.low !== null || spec.high !== null
      ? `Ref: ${spec.low ?? "—"} – ${spec.high ?? "—"}${spec.unit ? ` ${spec.unit}` : ""}`
      : spec.unit
        ? spec.unit
        : "";

  return (
    <div className="rounded-lg border bg-background p-3">
      <div className="mb-1 flex items-center justify-between gap-2">
        <Label className="text-sm font-medium">{spec.name}</Label>
        <FlagBadge flag={flag} />
      </div>

      {spec.type === "select" ? (
        <Select value={value || undefined} onValueChange={onChange} disabled={disabled}>
          <SelectTrigger>
            <SelectValue placeholder="Select…" />
          </SelectTrigger>
          <SelectContent>
            {spec.options.map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input
          inputMode={spec.type === "numeric" ? "decimal" : "text"}
          type={spec.type === "numeric" ? "number" : "text"}
          step="any"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            spec.type === "numeric" && "font-mono",
            abnormal && "border-destructive bg-destructive/10 focus-visible:ring-destructive",
          )}
        />
      )}

      {ref && <div className="mt-1 text-xs text-muted-foreground">{ref}</div>}
    </div>
  );
}

function FlagBadge({ flag }: { flag: Flag }) {
  if (!flag) return null;
  if (flag === "High")
    return (
      <span className="rounded bg-rose-100 px-1.5 py-0.5 text-xs font-semibold text-rose-700">
        ▲ High
      </span>
    );
  if (flag === "Low")
    return (
      <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs font-semibold text-blue-700">
        ▼ Low
      </span>
    );
  return (
    <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-semibold text-emerald-700">
      ✓ Normal
    </span>
  );
}

function LoincBadge({ code }: { code: string }) {
  return (
    <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
      LOINC: {code}
    </span>
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
    status === "completed"
      ? "bg-emerald-100 text-emerald-700"
      : status === "in_progress"
        ? "bg-blue-100 text-blue-700"
        : status === "declined"
          ? "bg-rose-100 text-rose-700"
          : "bg-amber-100 text-amber-700";
  return <Badge className={`${cls} hover:${cls}`}>{(status ?? "ordered").replace("_", " ")}</Badge>;
}
