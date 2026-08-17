/**
 * AegisCare / LabTrack — Inpatient Clinical Chart
 * /inpatient/$admissionId
 * Phase 1 + 2: Overview, Clinical Notes, Services, Medications, Billing Summary
 */

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { AccessDenied } from "@/lib/require-access";
import { useAuth } from "@/lib/auth-context";
import { useEffect, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/lib/supabase-untyped";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  BedDouble,
  ClipboardList,
  FlaskConical,
  Pill,
  Receipt,
  Loader2,
  User,
  Calendar,
  Stethoscope,
  Scan,
  AlertCircle,
  Pencil,
  Printer,
} from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/inpatient_/$admissionId")({
  component: () => (
    <AppShell>
      <InpatientChartGate />
    </AppShell>
  ),
});

// ─── Permission gate ──────────────────────────────────────────────────────────

function InpatientChartGate() {
  const { hasPerm } = useAuth();
  const canView =
    hasPerm("admissions_view") || hasPerm("admit_patient") || hasPerm("bed_management");
  if (!canView) return <AccessDenied />;
  return <InpatientChart />;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type AdmissionDetail = {
  id: string;
  encounter_id: string | null;
  patient_id: string | null;
  bed_id: string | null;
  ward_id: string | null;
  admitted_at: string | null;
  expected_discharge_date: string | null;
  admitting_doctor: string | null;
  admission_reason: string | null;
  admission_type: string | null;
  status: string | null;
  patients: {
    id: string;
    patient_name: string | null;
    file_number: string | null;
    sex: string | null;
    date_of_birth: string | null;
    blood_group: string | null;
    allergies: unknown;
  } | null;
  wards: { id: string; name: string; ward_type: string | null } | null;
  beds: { id: string; bed_number: string } | null;
};

type ClinicalNote = {
  id: string;
  note_type: string;
  content: string | null;
  authored_by: string | null;
  authored_at: string | null;
  created_at: string | null;
};

type CatalogItem = {
  id: string;
  name: string;
  kind: string;
  category: string | null;
  cash_price: number | null;
  insurance_price: number | null;
  price: number;
};

type LabOrderRow = {
  id: string;
  status: string;
  priority: string;
  ordered_at: string;
  lab_test_catalog: { name: string | null; category: string | null } | null;
};

type RadiologyOrderRow = {
  id: string;
  status: string;
  priority: string;
  clinical_indication: string | null;
  ordered_at: string;
  lab_test_catalog: { name: string | null; category: string | null } | null;
};

type StockItem = {
  id: string;
  name: string;
  kind: string;
  current_quantity: number;
  strength: number | null;
  strength_unit: string | null;
};

type PrescriptionRow = {
  id: string;
  drug_name: string;
  dosage: string | null;
  frequency: string | null;
  duration: string | null;
  quantity: number;
  notes: string | null;
  status: string;
  created_at: string;
  prescribed_by_name: string | null;
};

type InvoiceLineItem = {
  id: string;
  item_type: string;
  description: string | null;
  quantity: number | null;
  unit_price: number | null;
  amount: number | null;
  insurance_covered_amount: number | null;
  created_at: string | null;
};

type DayGroup = {
  date: string;
  items: InvoiceLineItem[];
  dayTotal: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(d: string | null) {
  if (!d) return "—";
  try {
    return format(parseISO(d), "dd MMM yyyy, HH:mm");
  } catch {
    return d;
  }
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  try {
    return format(parseISO(d), "dd MMM yyyy");
  } catch {
    return d;
  }
}

function daysSince(d: string | null) {
  if (!d) return 0;
  try {
    return differenceInDays(new Date(), parseISO(d));
  } catch {
    return 0;
  }
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700",
    "in-progress": "bg-blue-100 text-blue-700",
    completed: "bg-emerald-100 text-emerald-700",
    cancelled: "bg-rose-100 text-rose-700",
    dispensed: "bg-emerald-100 text-emerald-700",
  };
  return map[status] ?? "bg-muted text-muted-foreground";
}

// ─── Main Chart ───────────────────────────────────────────────────────────────

function InpatientChart() {
  const { admissionId } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();

  // ── Admission data ───────────────────────────────────────────────────────────

  const admQ = useQuery({
    queryKey: ["ipd-chart-admission", admissionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admissions")
        .select(
          "id,encounter_id,patient_id,bed_id,ward_id,admitted_at,expected_discharge_date,admitting_doctor,admission_reason,admission_type,status,patients(id,patient_name,file_number,sex,date_of_birth,blood_group,allergies),wards(id,name,ward_type),beds(id,bed_number)",
        )
        .eq("id", admissionId)
        .single();
      if (error) throw error;
      return data as unknown as AdmissionDetail;
    },
  });

  const adm = admQ.data;
  const encounterId = adm?.encounter_id ?? null;
  const patientId = adm?.patient_id ?? null;

  if (admQ.isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-3 text-muted-foreground">Loading patient chart…</span>
      </div>
    );
  }

  if (!adm) {
    return (
      <div className="p-8 text-center">
        <AlertCircle className="h-8 w-8 mx-auto text-rose-500 mb-3" />
        <p className="text-muted-foreground">Admission not found.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate({ to: "/inpatient" })}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to ward
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-6xl mx-auto space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="outline" size="sm" onClick={() => navigate({ to: "/inpatient" })}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Ward
        </Button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <BedDouble className="h-5 w-5 text-primary shrink-0" />
          <div className="min-w-0">
            <h1 className="text-lg font-bold truncate">
              {adm.patients?.patient_name ?? "Patient"}{" "}
              {adm.patients?.file_number && (
                <span className="text-muted-foreground font-normal text-sm">
                  · {adm.patients.file_number}
                </span>
              )}
            </h1>
            <p className="text-xs text-muted-foreground">
              {adm.wards?.name ?? "Ward"} · Bed {adm.beds?.bed_number ?? "—"} ·{" "}
              {daysSince(adm.admitted_at)} days admitted
            </p>
          </div>
        </div>
        <Badge
          className={
            adm.status === "admitted"
              ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
              : "bg-muted text-muted-foreground"
          }
        >
          {adm.status ?? "unknown"}
        </Badge>
        <Badge variant="outline" className="text-xs font-mono">
          INPATIENT
        </Badge>
      </div>

      {/* ── Tabs ── */}
      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="overview" className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5" /> Overview
          </TabsTrigger>
          <TabsTrigger value="notes" className="flex items-center gap-1.5">
            <ClipboardList className="h-3.5 w-3.5" /> Clinical Notes
          </TabsTrigger>
          <TabsTrigger value="services" className="flex items-center gap-1.5">
            <FlaskConical className="h-3.5 w-3.5" /> Services
          </TabsTrigger>
          <TabsTrigger value="medications" className="flex items-center gap-1.5">
            <Pill className="h-3.5 w-3.5" /> Medications
          </TabsTrigger>
          <TabsTrigger value="results" className="flex items-center gap-1.5">
            <FlaskConical className="h-3.5 w-3.5 text-emerald-500" /> Results
          </TabsTrigger>
          <TabsTrigger value="billing" className="flex items-center gap-1.5">
            <Receipt className="h-3.5 w-3.5" /> Billing
          </TabsTrigger>
        </TabsList>

        {/* ── Overview Tab ── */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" /> Patient Details
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1.5">
                <Row label="Name" value={adm.patients?.patient_name} />
                <Row label="File #" value={adm.patients?.file_number} />
                <Row label="Sex" value={adm.patients?.sex} />
                <Row label="DOB" value={fmtDate(adm.patients?.date_of_birth ?? null)} />
                <Row label="Blood group" value={adm.patients?.blood_group} />
                {Boolean(adm.patients?.allergies) && (
                  <div className="flex gap-2">
                    <span className="text-muted-foreground w-28 shrink-0">Allergies</span>
                    <span className="text-rose-600 font-medium">
                      {typeof adm.patients?.allergies === "string"
                        ? adm.patients.allergies
                        : JSON.stringify(adm.patients?.allergies ?? "")}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" /> Admission Details
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1.5">
                <Row label="Ward" value={adm.wards?.name} />
                <Row label="Bed" value={adm.beds?.bed_number} />
                <Row label="Type" value={adm.admission_type} />
                <Row label="Admitted" value={fmt(adm.admitted_at)} />
                <Row label="Admitting Dr" value={adm.admitting_doctor} />
                <Row label="Expected D/C" value={fmtDate(adm.expected_discharge_date ?? null)} />
                <Row label="Days admitted" value={String(daysSince(adm.admitted_at))} />
                {adm.admission_reason && (
                  <div className="flex gap-2">
                    <span className="text-muted-foreground w-28 shrink-0">Reason</span>
                    <span className="flex-1">{adm.admission_reason}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── Clinical Notes Tab ── */}
        <TabsContent value="notes" className="mt-4">
          {encounterId && (
            <ClinicalNotesTab
              encounterId={encounterId}
              admissionId={admissionId}
              userId={user?.id ?? null}
              onSaved={() =>
                qc.invalidateQueries({
                  queryKey: ["ipd-notes", admissionId],
                })
              }
            />
          )}
        </TabsContent>

        {/* ── Services Tab ── */}
        <TabsContent value="services" className="mt-4">
          {encounterId && patientId && (
            <ServicesTab
              encounterId={encounterId}
              patientId={patientId}
              admissionId={admissionId}
              userId={user?.id ?? null}
              onSaved={() => {
                qc.invalidateQueries({ queryKey: ["ipd-lab-orders", admissionId] });
                qc.invalidateQueries({ queryKey: ["ipd-rad-orders", admissionId] });
              }}
            />
          )}
        </TabsContent>

        {/* ── Medications Tab ── */}
        <TabsContent value="medications" className="mt-4">
          {encounterId && (
            <MedicationsTab
              encounterId={encounterId}
              admissionId={admissionId}
              userId={user?.id ?? null}
              userEmail={user?.email ?? null}
              onSaved={() =>
                qc.invalidateQueries({
                  queryKey: ["ipd-prescriptions", admissionId],
                })
              }
            />
          )}
        </TabsContent>

        {/* ── Results Tab ── */}
        <TabsContent value="results" className="mt-4">
          {encounterId && <ResultsTab admissionId={admissionId} encounterId={encounterId} />}
        </TabsContent>

        {/* ── Billing Tab ── */}
        <TabsContent value="billing" className="mt-4">
          {encounterId && <BillingTab encounterId={encounterId} />}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Row helper ───────────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex gap-2">
      <span className="text-muted-foreground w-28 shrink-0">{label}</span>
      <span className="flex-1">{value ?? "—"}</span>
    </div>
  );
}

// ─── Clinical Notes Tab ───────────────────────────────────────────────────────

function ClinicalNotesTab({
  encounterId,
  admissionId,
  userId,
  onSaved,
}: {
  encounterId: string;
  admissionId: string;
  userId: string | null;
  onSaved: () => void;
}) {
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  const notesQ = useQuery({
    queryKey: ["ipd-notes", admissionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clinical_notes")
        .select("id,note_type,content,authored_by,authored_at,created_at")
        .eq("admission_id", admissionId)
        .order("authored_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ClinicalNote[];
    },
  });

  async function addNote() {
    if (!content.trim()) {
      toast.error("Note content cannot be empty");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("clinical_notes").insert({
      encounter_id: encounterId,
      admission_id: admissionId,
      note_type: "daily_note",
      content: content.trim(),
      authored_by: userId ?? null,
      authored_at: new Date().toISOString(),
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Daily note saved");
    setContent("");
    onSaved();
  }

  return (
    <div className="space-y-4">
      {/* New note form */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-primary" /> Add Daily Note
          </CardTitle>
          <CardDescription>
            Notes are immutable once saved (DHA compliant). Amendments must be added as new notes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            placeholder="Write clinical note here — findings, progress, plan…"
            rows={5}
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          <Button onClick={addNote} disabled={saving || !content.trim()}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <ClipboardList className="h-4 w-4 mr-2" />
            )}
            Save note
          </Button>
        </CardContent>
      </Card>

      {/* Notes list */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            Note History{" "}
            {notesQ.data && (
              <Badge variant="secondary" className="ml-2">
                {notesQ.data.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {notesQ.isLoading ? (
            <div className="flex items-center gap-2 py-4 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading notes…
            </div>
          ) : !notesQ.data || notesQ.data.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No notes recorded yet for this admission.
            </p>
          ) : (
            <ScrollArea className="h-96">
              <div className="space-y-3">
                {notesQ.data.map((note) => (
                  <div key={note.id} className="rounded-lg border bg-card p-4 space-y-1.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs capitalize">
                        {note.note_type.replace(/_/g, " ")}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {fmt(note.authored_at ?? note.created_at)}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Results Tab ──────────────────────────────────────────────────────────────

type LabResultFull = {
  id: string;
  status: string;
  priority: string;
  ordered_at: string;
  order_number: string | null;
  lab_test_catalog: { name: string | null } | null;
  lab_results: {
    id: string;
    result_value: string | null;
    result: Record<string, unknown> | null;
    is_critical: boolean | null;
    verified_at: string | null;
    performed_by: string | null;
    reported_at: string | null;
    notes: string | null;
  } | null;
};

type RadResultFull = {
  id: string;
  status: string;
  priority: string;
  ordered_at: string;
  clinical_indication: string | null;
  lab_test_catalog: { name: string | null } | null;
  radiology_results: {
    id: string;
    findings: string | null;
    impression: string | null;
    radiologist: string | null;
    image_paths: string[] | null;
    reported_at: string | null;
  } | null;
};

function LabStatusBadge({ status }: { status: string }) {
  const cls =
    status === "completed"
      ? "bg-emerald-100 text-emerald-700"
      : status === "in_progress"
        ? "bg-blue-100 text-blue-700"
        : status === "declined"
          ? "bg-rose-100 text-rose-700"
          : status === "cancelled"
            ? "bg-rose-100 text-rose-700"
            : "bg-amber-100 text-amber-700";
  return <Badge className={`${cls} hover:${cls} text-xs`}>{status.replace(/_/g, " ")}</Badge>;
}

function RadImageTile({ path }: { path: string }) {
  const { data: url } = useQuery({
    queryKey: ["ipd-rad-signed", path],
    queryFn: async () => {
      const { data, error } = await supabase.storage.from("radiology").createSignedUrl(path, 3600);
      if (error) throw error;
      return data.signedUrl;
    },
    staleTime: 55 * 60 * 1000,
  });
  const filename = path.split("/").pop() ?? path;
  const isImage = /\.(png|jpe?g|gif|webp|bmp)$/i.test(filename);
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="block rounded border overflow-hidden hover:opacity-90 transition-opacity"
    >
      {url && isImage ? (
        <img src={url} alt={filename} className="h-32 w-full object-cover" />
      ) : (
        <div className="flex h-32 flex-col items-center justify-center gap-1 bg-muted/30 text-xs text-muted-foreground">
          <Scan className="h-5 w-5" />
          <span className="truncate max-w-[90%]">{filename}</span>
        </div>
      )}
    </a>
  );
}

function ResultsTab({ admissionId, encounterId }: { admissionId: string; encounterId: string }) {
  const labQ = useQuery({
    queryKey: ["ipd-lab-results", admissionId],
    queryFn: async () => {
      const { data, error } = await db
        .from("lab_orders")
        .select(
          "id,status,priority,ordered_at,order_number,lab_test_catalog(name),lab_results(id,result_value,result,is_critical,verified_at,performed_by,reported_at,notes)",
        )
        .eq("admission_id", admissionId)
        .order("ordered_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as LabResultFull[];
    },
  });

  const radQ = useQuery({
    queryKey: ["ipd-rad-results", admissionId],
    queryFn: async () => {
      const { data, error } = await db
        .from("radiology_orders")
        .select(
          "id,status,priority,ordered_at,clinical_indication,lab_test_catalog(name),radiology_results(id,findings,impression,radiologist,image_paths,reported_at)",
        )
        .eq("admission_id", admissionId)
        .order("ordered_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as RadResultFull[];
    },
  });

  function printResults() {
    window.print();
  }

  return (
    <div className="space-y-5">
      {/* ── Print button ── */}
      <div className="flex justify-end print:hidden">
        <Button variant="outline" size="sm" onClick={printResults}>
          <Printer className="h-4 w-4 mr-2" /> Print results
        </Button>
      </div>

      {/* ── Lab Results ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-blue-500" /> Lab Results
            {labQ.data && <Badge variant="secondary">{labQ.data.length}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {labQ.isLoading ? (
            <div className="flex items-center gap-2 py-4 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading lab results…
            </div>
          ) : !labQ.data || labQ.data.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No lab orders for this admission.
            </p>
          ) : (
            <ScrollArea className="h-[28rem]">
              <div className="space-y-3">
                {labQ.data.map((order) => {
                  const res = Array.isArray(order.lab_results)
                    ? order.lab_results[0]
                    : order.lab_results;
                  const resultData = res?.result as Record<
                    string,
                    { value: string; unit?: string; flag?: string }
                  > | null;
                  return (
                    <div key={order.id} className="rounded-lg border bg-card p-4 space-y-2">
                      {/* Header row */}
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div>
                          <p className="font-medium text-sm">
                            {order.lab_test_catalog?.name ?? "Lab test"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {fmtDate(order.ordered_at)} · {order.priority}
                            {order.order_number ? ` · ${order.order_number}` : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {res?.is_critical && (
                            <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100 text-xs">
                              ⚠ Critical
                            </Badge>
                          )}
                          <LabStatusBadge status={order.status} />
                        </div>
                      </div>

                      {/* Result body */}
                      {res && order.status === "completed" && (
                        <div className="rounded-lg bg-muted/30 p-3 space-y-2 text-sm">
                          {/* Structured parameters */}
                          {resultData && Object.keys(resultData).length > 0 ? (
                            <div className="grid gap-2 sm:grid-cols-2">
                              {Object.entries(resultData).map(([param, val]) => (
                                <div
                                  key={param}
                                  className={`rounded border px-3 py-2 text-xs ${
                                    val.flag === "High" || val.flag === "Low"
                                      ? "border-rose-200 bg-rose-50"
                                      : "bg-background"
                                  }`}
                                >
                                  <div className="font-medium text-foreground">{param}</div>
                                  <div className="flex items-center justify-between gap-2 mt-0.5">
                                    <span className="font-mono">
                                      {val.value}
                                      {val.unit ? ` ${val.unit}` : ""}
                                    </span>
                                    {val.flag && (
                                      <span
                                        className={
                                          val.flag === "High"
                                            ? "text-rose-600 font-semibold"
                                            : val.flag === "Low"
                                              ? "text-blue-600 font-semibold"
                                              : "text-emerald-600"
                                        }
                                      >
                                        {val.flag}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : res.result_value ? (
                            <p className="text-sm">{res.result_value}</p>
                          ) : null}

                          {/* Notes */}
                          {res.notes && (
                            <p className="text-xs text-muted-foreground italic">{res.notes}</p>
                          )}

                          {/* Footer */}
                          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground border-t pt-2">
                            {res.performed_by && <span>By: {res.performed_by}</span>}
                            {res.reported_at && <span>Reported: {fmt(res.reported_at)}</span>}
                            {res.verified_at && (
                              <span className="text-emerald-600">
                                ✓ Verified {fmt(res.verified_at)}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Awaiting result */}
                      {order.status !== "completed" &&
                        order.status !== "declined" &&
                        order.status !== "cancelled" && (
                          <p className="text-xs text-muted-foreground italic">Awaiting result…</p>
                        )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* ── Radiology Results ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Scan className="h-4 w-4 text-purple-500" /> Radiology Results
            {radQ.data && <Badge variant="secondary">{radQ.data.length}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {radQ.isLoading ? (
            <div className="flex items-center gap-2 py-4 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading radiology results…
            </div>
          ) : !radQ.data || radQ.data.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No radiology orders for this admission.
            </p>
          ) : (
            <ScrollArea className="h-[28rem]">
              <div className="space-y-3">
                {radQ.data.map((order) => {
                  const res = Array.isArray(order.radiology_results)
                    ? order.radiology_results[0]
                    : order.radiology_results;
                  const imagePaths = (res?.image_paths as string[] | null) ?? [];
                  return (
                    <div key={order.id} className="rounded-lg border bg-card p-4 space-y-2">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div>
                          <p className="font-medium text-sm">
                            {order.lab_test_catalog?.name ?? "Radiology study"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {fmtDate(order.ordered_at)} · {order.priority}
                            {order.clinical_indication ? ` · ${order.clinical_indication}` : ""}
                          </p>
                        </div>
                        <LabStatusBadge status={order.status} />
                      </div>

                      {/* Result body */}
                      {res && order.status === "completed" && (
                        <div className="rounded-lg bg-muted/30 p-3 space-y-2 text-sm">
                          {res.findings && (
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">
                                Findings
                              </p>
                              <p className="whitespace-pre-wrap">{res.findings}</p>
                            </div>
                          )}
                          {res.impression && (
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">
                                Impression
                              </p>
                              <p className="whitespace-pre-wrap">{res.impression}</p>
                            </div>
                          )}

                          {/* Images */}
                          {imagePaths.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                                Images ({imagePaths.length})
                              </p>
                              <div className="grid gap-2 sm:grid-cols-3">
                                {imagePaths.map((p) => (
                                  <RadImageTile key={p} path={p} />
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Footer */}
                          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground border-t pt-2">
                            {res.radiologist && <span>By: {res.radiologist}</span>}
                            {res.reported_at && <span>Reported: {fmt(res.reported_at)}</span>}
                          </div>
                        </div>
                      )}

                      {/* Awaiting */}
                      {order.status !== "completed" &&
                        order.status !== "declined" &&
                        order.status !== "cancelled" && (
                          <p className="text-xs text-muted-foreground italic">Awaiting result…</p>
                        )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Print layout */}
      <div className="hidden print:block space-y-4">
        <h2 className="text-lg font-bold">Lab & Radiology Results</h2>
        <p className="text-xs text-muted-foreground">
          Printed: {format(new Date(), "dd MMM yyyy, HH:mm")}
        </p>
      </div>
    </div>
  );
}

// ─── Services Tab ─────────────────────────────────────────────────────────────

function ServicesTab({
  encounterId,
  patientId,
  admissionId,
  userId,
  onSaved,
}: {
  encounterId: string;
  patientId: string;
  admissionId: string;
  userId: string | null;
  onSaved: () => void;
}) {
  const [labPriority, setLabPriority] = useState("routine");
  const [radPriority, setRadPriority] = useState("routine");
  const [radIndication, setRadIndication] = useState("");
  const [selectedLabId, setSelectedLabId] = useState<string>("");
  const [selectedRadId, setSelectedRadId] = useState<string>("");
  const [savingLab, setSavingLab] = useState(false);
  const [savingRad, setSavingRad] = useState(false);

  const catalogQ = useQuery({
    queryKey: ["ipd-catalog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lab_test_catalog")
        .select("id,name,kind,category,price,cash_price,insurance_price")
        .eq("is_active", true)
        .order("kind")
        .order("name");
      if (error) throw error;
      return (data ?? []) as CatalogItem[];
    },
  });

  const labOrdersQ = useQuery({
    queryKey: ["ipd-lab-orders", admissionId],
    queryFn: async () => {
      const { data, error } = await db
        .from("lab_orders")
        .select("id,status,priority,ordered_at,lab_test_catalog(name,category)")
        .eq("admission_id", admissionId)
        .order("ordered_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as LabOrderRow[];
    },
  });

  const radOrdersQ = useQuery({
    queryKey: ["ipd-rad-orders", admissionId],
    queryFn: async () => {
      const { data, error } = await db
        .from("radiology_orders")
        .select("id,status,priority,clinical_indication,ordered_at,lab_test_catalog(name,category)")
        .eq("admission_id", admissionId)
        .order("ordered_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as RadiologyOrderRow[];
    },
  });

  const labItems = catalogQ.data?.filter((i) => i.kind === "lab") ?? [];
  const radItems = catalogQ.data?.filter((i) => i.kind === "radiology") ?? [];

  async function orderLab() {
    if (!selectedLabId) {
      toast.error("Select a lab test");
      return;
    }
    setSavingLab(true);
    const { error } = await db.from("lab_orders").insert({
      encounter_id: encounterId,
      patient_id: patientId,
      catalog_id: selectedLabId,
      ordered_by: userId ?? null,
      priority: labPriority,
      status: "pending",
      encounter_type: "inpatient",
      admission_id: admissionId,
      ordered_at: new Date().toISOString(),
    });
    setSavingLab(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Lab order sent — INPATIENT · Bedside");
    setSelectedLabId("");
    onSaved();
  }

  async function orderRadiology() {
    if (!selectedRadId) {
      toast.error("Select a radiology study");
      return;
    }
    setSavingRad(true);
    const { error } = await db.from("radiology_orders").insert({
      encounter_id: encounterId,
      patient_id: patientId,
      catalog_id: selectedRadId,
      ordered_by: userId ?? null,
      priority: radPriority,
      clinical_indication: radIndication.trim() || null,
      status: "pending",
      encounter_type: "inpatient",
      admission_id: admissionId,
      ordered_at: new Date().toISOString(),
    });
    setSavingRad(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Radiology order sent — INPATIENT · Bedside");
    setSelectedRadId("");
    setRadIndication("");
    onSaved();
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Lab order form */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-blue-500" /> Lab Request
            <Badge className="bg-blue-50 text-blue-700 hover:bg-blue-50 text-xs">
              INPATIENT · Bedside
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>Test</Label>
            <Select value={selectedLabId} onValueChange={setSelectedLabId}>
              <SelectTrigger>
                <SelectValue placeholder="Select lab test…" />
              </SelectTrigger>
              <SelectContent>
                {labItems.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.name}
                    {i.category ? ` · ${i.category}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Priority</Label>
            <Select value={labPriority} onValueChange={setLabPriority}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="routine">Routine</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="stat">STAT</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={orderLab} disabled={savingLab || !selectedLabId} className="w-full">
            {savingLab ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <FlaskConical className="h-4 w-4 mr-2" />
            )}
            Send to lab queue
          </Button>

          {/* Recent lab orders */}
          <div className="pt-2 space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Orders for this admission
            </p>
            {labOrdersQ.isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : !labOrdersQ.data || labOrdersQ.data.length === 0 ? (
              <p className="text-xs text-muted-foreground">No lab orders yet.</p>
            ) : (
              <ScrollArea className="h-40">
                {labOrdersQ.data.map((o) => (
                  <div
                    key={o.id}
                    className="flex items-center justify-between py-1.5 border-b last:border-0 text-sm"
                  >
                    <div>
                      <p className="font-medium">{o.lab_test_catalog?.name ?? "Lab test"}</p>
                      <p className="text-xs text-muted-foreground">
                        {fmtDate(o.ordered_at)} · {o.priority}
                      </p>
                    </div>
                    <Badge className={`${statusBadge(o.status)} text-xs`}>{o.status}</Badge>
                  </div>
                ))}
              </ScrollArea>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Radiology order form */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Scan className="h-4 w-4 text-purple-500" /> Radiology Request
            <Badge className="bg-purple-50 text-purple-700 hover:bg-purple-50 text-xs">
              INPATIENT · Bedside
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>Study</Label>
            <Select value={selectedRadId} onValueChange={setSelectedRadId}>
              <SelectTrigger>
                <SelectValue placeholder="Select radiology study…" />
              </SelectTrigger>
              <SelectContent>
                {radItems.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.name}
                    {i.category ? ` · ${i.category}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Priority</Label>
            <Select value={radPriority} onValueChange={setRadPriority}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="routine">Routine</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="stat">STAT</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Clinical indication</Label>
            <Input
              placeholder="Reason for study…"
              value={radIndication}
              onChange={(e) => setRadIndication(e.target.value)}
            />
          </div>
          <Button
            onClick={orderRadiology}
            disabled={savingRad || !selectedRadId}
            className="w-full"
          >
            {savingRad ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Scan className="h-4 w-4 mr-2" />
            )}
            Send to radiology queue
          </Button>

          {/* Recent radiology orders */}
          <div className="pt-2 space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Orders for this admission
            </p>
            {radOrdersQ.isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : !radOrdersQ.data || radOrdersQ.data.length === 0 ? (
              <p className="text-xs text-muted-foreground">No radiology orders yet.</p>
            ) : (
              <ScrollArea className="h-40">
                {radOrdersQ.data.map((o) => (
                  <div
                    key={o.id}
                    className="flex items-center justify-between py-1.5 border-b last:border-0 text-sm"
                  >
                    <div>
                      <p className="font-medium">{o.lab_test_catalog?.name ?? "Radiology study"}</p>
                      <p className="text-xs text-muted-foreground">
                        {fmtDate(o.ordered_at)} · {o.priority}
                        {o.clinical_indication ? ` · ${o.clinical_indication}` : ""}
                      </p>
                    </div>
                    <Badge className={`${statusBadge(o.status)} text-xs`}>{o.status}</Badge>
                  </div>
                ))}
              </ScrollArea>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Medications Tab ──────────────────────────────────────────────────────────

function MedicationsTab({
  encounterId,
  admissionId,
  userId,
  userEmail,
  onSaved,
}: {
  encounterId: string;
  admissionId: string;
  userId: string | null;
  userEmail: string | null;
  onSaved: () => void;
}) {
  const [drugName, setDrugName] = useState("");
  const [selectedStockId, setSelectedStockId] = useState("");
  const [dosage, setDosage] = useState("");
  const [frequency, setFrequency] = useState("");
  const [duration, setDuration] = useState("");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [stock, setStock] = useState<StockItem[]>([]);

  useEffect(() => {
    supabase
      .from("stock_items")
      .select("id,name,kind,current_quantity,strength,strength_unit")
      .eq("kind", "pharmaceutical")
      .order("name")
      .then(({ data }) => setStock((data ?? []) as StockItem[]));
  }, []);

  const rxQ = useQuery({
    queryKey: ["ipd-prescriptions", admissionId],
    queryFn: async () => {
      const { data, error } = await db
        .from("prescriptions")
        .select(
          "id,drug_name,dosage,frequency,duration,quantity,notes,status,created_at,prescribed_by_name",
        )
        .eq("admission_id", admissionId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PrescriptionRow[];
    },
  });

  function resolvedDrugName() {
    if (selectedStockId) {
      const found = stock.find((s) => s.id === selectedStockId);
      if (found) {
        let label = found.name;
        if (found.strength && found.strength_unit)
          label += ` ${found.strength}${found.strength_unit}`;
        return label;
      }
    }
    return drugName.trim();
  }

  async function prescribe() {
    const drug = resolvedDrugName();
    if (!drug) {
      toast.error("Select a drug or enter a drug name");
      return;
    }
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      toast.error("Enter a valid quantity");
      return;
    }
    setSaving(true);
    const { error } = await db.from("prescriptions").insert({
      registration_id: encounterId,
      encounter_id: encounterId,
      admission_id: admissionId,
      encounter_type: "inpatient",
      stock_item_id: selectedStockId || null,
      drug_name: drug,
      dosage: dosage.trim() || null,
      frequency: frequency.trim() || null,
      duration: duration.trim() || null,
      quantity: qty,
      notes: notes.trim() || null,
      status: "pending",
      created_by: userId ?? null,
      prescribed_by_name: userEmail ?? null,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Prescription added — routed to pharmacy (INPATIENT)");
    setSelectedStockId("");
    setDrugName("");
    setDosage("");
    setFrequency("");
    setDuration("");
    setQuantity("");
    setNotes("");
    onSaved();
  }

  async function cancelRx(id: string) {
    const { error } = await supabase
      .from("prescriptions")
      .update({ status: "cancelled" } as never)
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    onSaved();
    toast.success("Prescription cancelled");
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Prescribe form */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Pill className="h-4 w-4 text-orange-500" /> Prescribe
            <Badge className="bg-orange-50 text-orange-700 hover:bg-orange-50 text-xs">
              INPATIENT
            </Badge>
          </CardTitle>
          <CardDescription>Select from stock or type a drug name manually.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>Drug (from stock)</Label>
            <Select
              value={selectedStockId}
              onValueChange={(v) => {
                setSelectedStockId(v);
                setDrugName("");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select from pharmacy stock…" />
              </SelectTrigger>
              <SelectContent>
                {stock.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                    {s.strength && s.strength_unit ? ` ${s.strength}${s.strength_unit}` : ""} · Qty:{" "}
                    {s.current_quantity}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {!selectedStockId && (
            <div className="space-y-1.5">
              <Label>Or type drug name manually</Label>
              <Input
                placeholder="e.g. Amoxicillin 500mg"
                value={drugName}
                onChange={(e) => setDrugName(e.target.value)}
              />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Dosage</Label>
              <Input
                placeholder="e.g. 500mg"
                value={dosage}
                onChange={(e) => setDosage(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Frequency</Label>
              <Input
                placeholder="e.g. TDS"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Duration</Label>
              <Input
                placeholder="e.g. 5 days"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Quantity</Label>
              <Input
                type="number"
                min="1"
                placeholder="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea
              placeholder="Special instructions…"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <Button
            onClick={prescribe}
            disabled={saving || (!selectedStockId && !drugName.trim())}
            className="w-full"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Pill className="h-4 w-4 mr-2" />
            )}
            Send to pharmacy
          </Button>
        </CardContent>
      </Card>

      {/* Prescription list */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Stethoscope className="h-4 w-4 text-primary" /> Prescriptions
            {rxQ.data && <Badge variant="secondary">{rxQ.data.length}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rxQ.isLoading ? (
            <div className="flex items-center gap-2 py-4 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : !rxQ.data || rxQ.data.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No prescriptions yet for this admission.
            </p>
          ) : (
            <ScrollArea className="h-96">
              <div className="space-y-3">
                {rxQ.data.map((rx) => (
                  <div key={rx.id} className="rounded-lg border bg-card p-3 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-sm">{rx.drug_name}</p>
                      <Badge className={`${statusBadge(rx.status)} text-xs shrink-0`}>
                        {rx.status}
                      </Badge>
                    </div>
                    {(rx.dosage || rx.frequency || rx.duration) && (
                      <p className="text-xs text-muted-foreground">
                        {[rx.dosage, rx.frequency, rx.duration].filter(Boolean).join(" · ")}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Qty: {rx.quantity} · {fmtDate(rx.created_at)}
                      {rx.prescribed_by_name ? ` · ${rx.prescribed_by_name}` : ""}
                    </p>
                    {rx.notes && <p className="text-xs text-muted-foreground italic">{rx.notes}</p>}
                    {rx.status === "pending" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-rose-500 hover:text-rose-600 h-7 px-2 text-xs mt-1"
                        onClick={() => cancelRx(rx.id)}
                      >
                        Cancel
                      </Button>
                    )}
                    {rx.status === "dispensed" && (
                      <AdministrationPanel
                        rx={rx}
                        admissionId={admissionId}
                        encounterId={encounterId}
                        userId={userId}
                        userEmail={userEmail}
                      />
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Administration Panel ────────────────────────────────────────────────────

type MedAdminRow = {
  id: string;
  administered_at: string;
  dose_given: string | null;
  route: string | null;
  administered_by_name: string | null;
  notes: string | null;
};

function AdministrationPanel({
  rx,
  admissionId,
  encounterId,
  userId,
  userEmail,
}: {
  rx: PrescriptionRow;
  admissionId: string;
  encounterId: string;
  userId: string | null;
  userEmail: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [doseGiven, setDoseGiven] = useState("");
  const [route, setRoute] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [records, setRecords] = useState<MedAdminRow[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);

  useEffect(() => {
    (async () => {
      setLoadingRecords(true);
      const { data } = await db
        .from("medication_administrations")
        .select("id,administered_at,dose_given,route,administered_by_name,notes")
        .eq("prescription_id", rx.id)
        .order("administered_at", { ascending: false })
        .limit(5);
      setRecords((data ?? []) as MedAdminRow[]);
      setLoadingRecords(false);
    })();
  }, [rx.id]);

  async function administer() {
    setSaving(true);
    const { error } = await db.from("medication_administrations").insert({
      prescription_id: rx.id,
      admission_id: admissionId,
      encounter_id: encounterId,
      administered_at: new Date().toISOString(),
      dose_given: doseGiven.trim() || null,
      route: route.trim() || null,
      administered_by: userId ?? null,
      administered_by_name: userEmail ?? null,
      notes: adminNotes.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Administration recorded");
    setDoseGiven("");
    setRoute("");
    setAdminNotes("");
    setOpen(false);
    // Refresh records
    const { data } = await db
      .from("medication_administrations")
      .select("id,administered_at,dose_given,route,administered_by_name,notes")
      .eq("prescription_id", rx.id)
      .order("administered_at", { ascending: false })
      .limit(5);
    setRecords((data ?? []) as MedAdminRow[]);
  }

  return (
    <div className="mt-2 space-y-2">
      {/* MAR history */}
      {loadingRecords ? (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Loading MAR…
        </div>
      ) : records.length > 0 ? (
        <div className="rounded-lg border bg-muted/30 p-2 space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Administration record
          </p>
          {records.map((r) => (
            <div key={r.id} className="text-xs text-muted-foreground border-t pt-1">
              <span className="font-medium text-foreground">
                {format(new Date(r.administered_at), "dd MMM, HH:mm")}
              </span>
              {r.dose_given && ` · ${r.dose_given}`}
              {r.route && ` · ${r.route}`}
              {r.administered_by_name && ` · by ${r.administered_by_name}`}
              {r.notes && <span className="italic"> · {r.notes}</span>}
            </div>
          ))}
        </div>
      ) : null}

      {/* Administer button */}
      {!open ? (
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50 w-full"
          onClick={() => setOpen(true)}
        >
          + Record administration
        </Button>
      ) : (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 space-y-2">
          <p className="text-xs font-medium text-emerald-700">Record administration</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Dose given</Label>
              <Input
                className="h-7 text-xs"
                placeholder={rx.dosage ?? "e.g. 500mg"}
                value={doseGiven}
                onChange={(e) => setDoseGiven(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Route</Label>
              <Select value={route} onValueChange={setRoute}>
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue placeholder="Route" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="oral">Oral (PO)</SelectItem>
                  <SelectItem value="iv">Intravenous (IV)</SelectItem>
                  <SelectItem value="im">Intramuscular (IM)</SelectItem>
                  <SelectItem value="sc">Subcutaneous (SC)</SelectItem>
                  <SelectItem value="topical">Topical</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs">Notes (optional)</Label>
            <Input
              className="h-7 text-xs"
              placeholder="e.g. patient tolerated well"
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-7 px-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={administer}
              disabled={saving}
            >
              {saving && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
              Confirm
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Billing Tab ──────────────────────────────────────────────────────────────

function BillingTab({ encounterId }: { encounterId: string }) {
  const [items, setItems] = useState<InvoiceLineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [invoiceNumber, setInvoiceNumber] = useState<string | null>(null);
  const [invoiceStatus, setInvoiceStatus] = useState<string | null>(null);
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [adjustItem, setAdjustItem] = useState<InvoiceLineItem | null>(null);
  const [adjustPrice, setAdjustPrice] = useState<string>("");
  const [adjustDesc, setAdjustDesc] = useState<string>("");
  const [adjustSaving, setAdjustSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    // Get invoice for this encounter
    const { data: invData } = await supabase
      .from("invoices")
      .select(
        "id,invoice_number,status,subtotal,discount,insurance_covered,total_due,amount_paid,balance",
      )
      .eq("encounter_id", encounterId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!invData) {
      setLoading(false);
      return;
    }

    setInvoiceNumber((invData as { invoice_number: string | null }).invoice_number);
    setInvoiceStatus((invData as { status: string | null }).status);
    setInvoiceId((invData as { id: string }).id);

    // Get line items
    const { data: lineData } = await supabase
      .from("invoice_line_items")
      .select(
        "id,item_type,description,quantity,unit_price,amount,insurance_covered_amount,created_at",
      )
      .eq("invoice_id", (invData as { id: string }).id)
      .order("created_at", { ascending: true });

    setItems((lineData ?? []) as InvoiceLineItem[]);
    setLoading(false);
  }, [encounterId]);

  useEffect(() => {
    load();
  }, [load]);

  // Group by calendar date
  const grouped: DayGroup[] = [];
  const seen = new Map<string, DayGroup>();
  for (const item of items) {
    const dateKey = item.created_at ? format(parseISO(item.created_at), "yyyy-MM-dd") : "Unknown";
    if (!seen.has(dateKey)) {
      const g: DayGroup = { date: dateKey, items: [], dayTotal: 0 };
      seen.set(dateKey, g);
      grouped.push(g);
    }
    const g = seen.get(dateKey)!;
    g.items.push(item);
    g.dayTotal += Number(item.amount ?? 0);
  }

  const runningTotal = items.reduce((s, i) => s + Number(i.amount ?? 0), 0);
  const insuranceCovered = items.reduce((s, i) => s + Number(i.insurance_covered_amount ?? 0), 0);
  const patientDue = runningTotal - insuranceCovered;

  async function saveAdjustment() {
    if (!adjustItem) return;
    const price = parseFloat(adjustPrice);
    if (isNaN(price) || price < 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setAdjustSaving(true);
    const { error } = await supabase
      .from("invoice_line_items")
      .update({
        unit_price: price,
        amount: price * Number(adjustItem.quantity ?? 1),
        description: adjustDesc.trim() || adjustItem.description,
      })
      .eq("id", adjustItem.id);
    setAdjustSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Charge adjusted — invoice recalculated");
    setAdjustItem(null);
    load();
  }

  function itemTypeBadge(type: string) {
    const map: Record<string, string> = {
      bed_day: "bg-emerald-100 text-emerald-700",
      lab: "bg-blue-100 text-blue-700",
      radiology: "bg-purple-100 text-purple-700",
      pharmacy: "bg-orange-100 text-orange-700",
      service: "bg-teal-100 text-teal-700",
    };
    return map[type] ?? "bg-muted text-muted-foreground";
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading billing…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Receipt className="h-4 w-4 text-primary" /> Invoice Summary
            {invoiceNumber && (
              <Badge variant="outline" className="font-mono text-xs">
                {invoiceNumber}
              </Badge>
            )}
            {invoiceStatus && (
              <Badge className={statusBadge(invoiceStatus) + " text-xs capitalize"}>
                {invoiceStatus}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>View-only · Updated in real time by accrual engine</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Total accrued</p>
              <p className="text-lg font-bold">KES {runningTotal.toLocaleString()}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Insurance covered</p>
              <p className="text-lg font-bold text-emerald-600">
                KES {insuranceCovered.toLocaleString()}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">Patient due</p>
              <p className="text-lg font-bold text-rose-600">KES {patientDue.toLocaleString()}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Day-by-day breakdown */}
      {grouped.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No billing entries yet for this admission.
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="h-[32rem]">
          <div className="space-y-4">
            {grouped.map((group) => {
              return (
                <Card key={group.date}>
                  <CardHeader className="pb-1">
                    <CardTitle className="text-xs text-muted-foreground flex items-center justify-between">
                      <span>{fmtDate(group.date + "T00:00:00")}</span>
                      <span className="font-semibold text-foreground">
                        KES {group.dayTotal.toLocaleString()}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-muted-foreground border-b">
                          <th className="text-left py-1.5 pr-3">Description</th>
                          <th className="text-left py-1.5 pr-3">Type</th>
                          <th className="text-right py-1.5 pr-3">Qty</th>
                          <th className="text-right py-1.5 pr-3">Unit</th>
                          <th className="text-right py-1.5">Amount</th>
                          <th className="py-1.5 w-8"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.items.map((item) => (
                          <tr key={item.id} className="border-b last:border-0">
                            <td className="py-1.5 pr-3 max-w-[200px] truncate">
                              {item.description ?? "—"}
                            </td>
                            <td className="py-1.5 pr-3">
                              <Badge className={`${itemTypeBadge(item.item_type)} text-xs`}>
                                {item.item_type.replace(/_/g, " ")}
                              </Badge>
                            </td>
                            <td className="py-1.5 pr-3 text-right">{item.quantity ?? 1}</td>
                            <td className="py-1.5 pr-3 text-right text-muted-foreground">
                              {item.unit_price != null
                                ? `KES ${Number(item.unit_price).toLocaleString()}`
                                : "—"}
                            </td>
                            <td className="py-1.5 text-right font-medium">
                              KES {Number(item.amount ?? 0).toLocaleString()}
                            </td>
                            <td className="py-1.5 text-right">
                              {item.item_type === "bed_day" && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => {
                                    setAdjustItem(item);
                                    setAdjustPrice(String(item.unit_price ?? ""));
                                    setAdjustDesc(item.description ?? "");
                                  }}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </ScrollArea>
      )}

      {adjustItem && (
        <Dialog open onOpenChange={(v: boolean) => !v && setAdjustItem(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Adjust Bed Charge</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-1">
              <div>
                <Label>Description</Label>
                <Input
                  value={adjustDesc}
                  onChange={(e) => setAdjustDesc(e.target.value)}
                  placeholder={adjustItem.description ?? ""}
                />
              </div>
              <div>
                <Label>Daily Rate (KES)</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={adjustPrice}
                  onChange={(e) => setAdjustPrice(e.target.value)}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Invoice total recalculates automatically on save.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setAdjustItem(null)}>
                Cancel
              </Button>
              <Button onClick={saveAdjustment} disabled={adjustSaving}>
                {adjustSaving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Save adjustment
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
