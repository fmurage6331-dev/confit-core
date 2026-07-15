/**
 * LabTrack — Encounter records detail.
 * Tabbed view of all documentation for a single encounter.
 * Sections render only when the current user has the relevant permission.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { PermGuard } from "@/lib/require-access";
import { useAuth } from "@/lib/auth-context";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, FolderOpen } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/encounter-records/$id")({
  component: () => (
    <AppShell>
      <PermGuard perm="records_view">
        <EncounterRecordDetail />
      </PermGuard>
    </AppShell>
  ),
});

function fmt(d?: string | null) {
  if (!d) return "—";
  try { return format(new Date(d), "dd MMM yyyy, HH:mm"); } catch { return "—"; }
}

function EncounterRecordDetail() {
  const { id } = Route.useParams();
  const { hasPerm, isAdmin } = useAuth();

  const canBill = hasPerm("accounting") || isAdmin;
  const canDoctorNote = hasPerm("records_view");
  const canDischargeNote = hasPerm("admissions_view") || hasPerm("admit_patient");
  const canRx = hasPerm("prescribe") || hasPerm("prescriptions_view");
  const canLab = hasPerm("records_view") || hasPerm("lab_results_entry");
  const canRad = hasPerm("radiology_view") || hasPerm("order_radiology");

  const canAddDoctorNote = hasPerm("clinical_notes_create") || hasPerm("doctor_note_create") || hasPerm("prescribe") || isAdmin;
  const canAddDischargeNote = hasPerm("clinical_notes_create") || hasPerm("discharge_patient") || hasPerm("admit_patient") || isAdmin;

  const tabs: { key: string; label: string; show: boolean }[] = [
    { key: "encounter", label: "Encounter", show: true },
    { key: "bill", label: "Bill", show: canBill },
    { key: "doctor", label: "Doctor note", show: canDoctorNote },
    { key: "discharge", label: "Discharge note", show: canDischargeNote },
    { key: "rx", label: "Prescriptions", show: canRx },
    { key: "lab", label: "Lab", show: canLab },
    { key: "rad", label: "Radiology", show: canRad },
  ].filter((t) => t.show);

  const [active, setActive] = useState(tabs[0]?.key ?? "encounter");

  const enc = useQuery({
    queryKey: ["encounter-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("encounters")
        .select("*, patients(patient_name,file_number,phone,sex,date_of_birth)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const patientName = (enc.data as { patients?: { patient_name?: string } } | null)?.patients?.patient_name ?? "Encounter";

  return (
    <div className="space-y-6">
      <div>
        <Link to={"/encounter-records" as never} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to encounter records
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <FolderOpen className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{patientName}</h1>
          <p className="text-sm text-muted-foreground">Encounter records</p>
        </div>
      </div>

      <Tabs value={active} onValueChange={setActive}>
        <TabsList className="flex-wrap h-auto">
          {tabs.map((t) => (
            <TabsTrigger key={t.key} value={t.key}>{t.label}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="encounter" className="mt-4">
          <EncounterSection data={enc.data} loading={enc.isLoading} />
        </TabsContent>

        {canBill && (
          <TabsContent value="bill" className="mt-4"><BillSection encounterId={id} /></TabsContent>
        )}
        {canDoctorNote && (
          <TabsContent value="doctor" className="mt-4">
            <NotesSection encounterId={id} noteType="doctor_note" title="Doctor notes" canAdd={canAddDoctorNote} />
          </TabsContent>
        )}
        {canDischargeNote && (
          <TabsContent value="discharge" className="mt-4">
            <NotesSection encounterId={id} noteType="discharge_note" title="Discharge notes" canAdd={canAddDischargeNote} />
          </TabsContent>
        )}
        {canRx && (
          <TabsContent value="rx" className="mt-4"><PrescriptionsSection encounterId={id} /></TabsContent>
        )}
        {canLab && (
          <TabsContent value="lab" className="mt-4"><LabSection encounterId={id} /></TabsContent>
        )}
        {canRad && (
          <TabsContent value="rad" className="mt-4"><RadiologySection encounterId={id} /></TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border bg-card p-5 shadow-[var(--shadow-card)]">{children}</div>;
}

function Empty({ label }: { label: string }) {
  return <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">{label}</div>;
}

// ---------- Encounter ----------
function EncounterSection({ data, loading }: { data: unknown; loading: boolean }) {
  if (loading) return <Empty label="Loading…" />;
  if (!data) return <Empty label="Encounter not found." />;
  const e = data as Record<string, unknown> & { patients?: Record<string, unknown> | null };
  const p = e.patients ?? {};
  return (
    <Card>
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Patient" value={String(p.patient_name ?? "—")} />
        <Field label="File #" value={String(p.file_number ?? "—")} />
        <Field label="Sex" value={String(p.sex ?? "—")} />
        <Field label="Phone" value={String(p.phone ?? "—")} />
        <Field label="Encounter status" value={String(e.status ?? "—")} />
        <Field label="Payment status" value={String(e.payment_status ?? "—")} />
        <Field label="Subtotal" value={Number(e.subtotal ?? 0).toFixed(2)} />
        <Field label="Amount paid" value={Number(e.amount_paid ?? 0).toFixed(2)} />
        <Field label="Created" value={fmt(e.created_at as string)} />
        <Field label="Acknowledged" value={fmt(e.acknowledged_at as string)} />
      </dl>
      {typeof e.notes === "string" && e.notes && (
        <div className="mt-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Notes</div>
          <div className="mt-1 whitespace-pre-wrap rounded-lg border bg-muted/30 p-3 text-sm">{e.notes}</div>
        </div>
      )}
    </Card>
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

// ---------- Bill ----------
function BillSection({ encounterId }: { encounterId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["enc-bill", encounterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("id,invoice_number,status,subtotal,discount,insurance_covered,total_due,amount_paid,balance,created_at,invoice_line_items(id,description,item_type,quantity,unit_price,amount)")
        .eq("encounter_id", encounterId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  if (isLoading) return <Empty label="Loading…" />;
  if (error) return <Empty label={(error as Error).message} />;
  if (!data || data.length === 0) return <Empty label="No invoice for this encounter." />;

  return (
    <div className="space-y-4">
      {data.map((inv) => (
        <Card key={inv.id}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="font-semibold">Invoice {inv.invoice_number ?? inv.id.slice(0, 8)}</div>
              <div className="text-xs text-muted-foreground">{fmt(inv.created_at)}</div>
            </div>
            <Badge variant="outline">{inv.status ?? "draft"}</Badge>
          </div>
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Item</th>
                  <th className="px-3 py-2 text-left font-medium">Type</th>
                  <th className="px-3 py-2 text-right font-medium">Qty</th>
                  <th className="px-3 py-2 text-right font-medium">Unit</th>
                  <th className="px-3 py-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(inv.invoice_line_items ?? []).length === 0 && (
                  <tr><td colSpan={5} className="px-3 py-4 text-center text-muted-foreground">No line items.</td></tr>
                )}
                {(inv.invoice_line_items ?? []).map((li: { id: string; description: string | null; item_type: string | null; quantity: number | null; unit_price: number | null; amount: number | null }) => (
                  <tr key={li.id}>
                    <td className="px-3 py-2">{li.description ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{li.item_type ?? "—"}</td>
                    <td className="px-3 py-2 text-right">{li.quantity ?? 1}</td>
                    <td className="px-3 py-2 text-right">{Number(li.unit_price ?? 0).toFixed(2)}</td>
                    <td className="px-3 py-2 text-right">{Number(li.amount ?? 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <Field label="Subtotal" value={Number(inv.subtotal ?? 0).toFixed(2)} />
            <Field label="Insurance" value={Number(inv.insurance_covered ?? 0).toFixed(2)} />
            <Field label="Total due" value={Number(inv.total_due ?? 0).toFixed(2)} />
            <Field label="Balance" value={Number(inv.balance ?? 0).toFixed(2)} />
          </div>
        </Card>
      ))}
    </div>
  );
}

// ---------- Notes (doctor / discharge) ----------
function NotesSection({ encounterId, noteType, title, canAdd }: { encounterId: string; noteType: "doctor_note" | "discharge_note"; title: string; canAdd: boolean }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [content, setContent] = useState("");

  const notesQ = useQuery({
    queryKey: ["enc-notes", encounterId, noteType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clinical_notes")
        .select("id,content,authored_at,authored_by,created_at")
        .eq("encounter_id", encounterId)
        .eq("note_type", noteType)
        .order("authored_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const body = content.trim();
      if (!body) throw new Error("Note cannot be empty");
      const { error } = await supabase.from("clinical_notes").insert({
        encounter_id: encounterId,
        note_type: noteType,
        content: body,
        authored_by: user?.id ?? null,
        authored_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Note saved");
      setContent("");
      qc.invalidateQueries({ queryKey: ["enc-notes", encounterId, noteType] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      {canAdd && (
        <Card>
          <div className="mb-2 text-sm font-semibold">Add {title.toLowerCase().replace(/s$/, "")}</div>
          <Textarea rows={4} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Type note…" />
          <div className="mt-3 flex justify-end">
            <Button onClick={() => add.mutate()} disabled={add.isPending || !content.trim()}>
              {add.isPending ? "Saving…" : "Save note"}
            </Button>
          </div>
        </Card>
      )}

      {notesQ.isLoading && <Empty label="Loading…" />}
      {!notesQ.isLoading && (notesQ.data ?? []).length === 0 && <Empty label={`No ${title.toLowerCase()} yet.`} />}
      {(notesQ.data ?? []).map((n) => (
        <Card key={n.id}>
          <div className="mb-2 text-xs text-muted-foreground">{fmt(n.authored_at ?? n.created_at)}</div>
          <div className="whitespace-pre-wrap text-sm">{n.content}</div>
        </Card>
      ))}
    </div>
  );
}

// ---------- Prescriptions ----------
function PrescriptionsSection({ encounterId }: { encounterId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["enc-rx", encounterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prescriptions")
        .select("id,drug_name,dosage,frequency,duration,quantity,status,notes,created_at,dispensed_at")
        .eq("registration_id", encounterId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  if (isLoading) return <Empty label="Loading…" />;
  if (error) return <Empty label={(error as Error).message} />;
  if (!data || data.length === 0) return <Empty label="No prescriptions for this encounter." />;

  return (
    <Card>
      <div className="overflow-hidden rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Drug</th>
              <th className="px-3 py-2 text-left font-medium">Dosage</th>
              <th className="px-3 py-2 text-left font-medium">Frequency</th>
              <th className="px-3 py-2 text-left font-medium">Duration</th>
              <th className="px-3 py-2 text-right font-medium">Qty</th>
              <th className="px-3 py-2 text-left font-medium">Status</th>
              <th className="px-3 py-2 text-left font-medium">Ordered</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {data.map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-2 font-medium">{r.drug_name}</td>
                <td className="px-3 py-2">{r.dosage ?? "—"}</td>
                <td className="px-3 py-2">{r.frequency ?? "—"}</td>
                <td className="px-3 py-2">{r.duration ?? "—"}</td>
                <td className="px-3 py-2 text-right">{r.quantity}</td>
                <td className="px-3 py-2"><Badge variant="outline">{r.status}</Badge></td>
                <td className="px-3 py-2 text-muted-foreground">{fmt(r.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ---------- Lab ----------
function LabSection({ encounterId }: { encounterId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["enc-lab", encounterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lab_tests")
        .select("id,test_name,lab_number,result,notes,test_date,sent_at,sent_to_room")
        .eq("registration_id", encounterId)
        .order("test_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  if (isLoading) return <Empty label="Loading…" />;
  if (error) return <Empty label={(error as Error).message} />;
  if (!data || data.length === 0) return <Empty label="No lab tests for this encounter." />;

  return (
    <div className="space-y-3">
      {data.map((t) => (
        <Card key={t.id}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="font-semibold">{t.test_name}</div>
              <div className="text-xs text-muted-foreground">Lab #{t.lab_number} · {fmt(t.test_date)}</div>
            </div>
            <Badge variant="outline">{t.result ? "Complete" : "Pending"}</Badge>
          </div>
          {t.result && (
            <div className="mt-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Result</div>
              <div className="mt-1 whitespace-pre-wrap rounded-lg border bg-muted/30 p-3 text-sm">{t.result}</div>
            </div>
          )}
          {t.notes && (
            <div className="mt-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Notes</div>
              <div className="mt-1 whitespace-pre-wrap rounded-lg border bg-muted/30 p-3 text-sm">{t.notes}</div>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

// ---------- Radiology ----------
function RadiologySection({ encounterId }: { encounterId: string }) {
  const ordersQ = useQuery({
    queryKey: ["enc-rad", encounterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("radiology_orders")
        .select("id,status,priority,clinical_indication,ordered_at,lab_test_catalog(name,category)")
        .eq("encounter_id", encounterId)
        .order("ordered_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const orderIds = useMemo(() => (ordersQ.data ?? []).map((o) => o.id), [ordersQ.data]);

  const resultsQ = useQuery({
    queryKey: ["enc-rad-results", encounterId, orderIds.join(",")],
    enabled: orderIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("radiology_results")
        .select("id,order_id,findings,impression,radiologist,reported_at,image_paths")
        .in("order_id", orderIds);
      if (error) throw error;
      return data ?? [];
    },
  });

  if (ordersQ.isLoading) return <Empty label="Loading…" />;
  if (ordersQ.error) return <Empty label={(ordersQ.error as Error).message} />;
  if ((ordersQ.data ?? []).length === 0) return <Empty label="No radiology orders for this encounter." />;

  const resultsByOrder = new Map<string, typeof resultsQ.data extends (infer U)[] | undefined ? U : never>();
  (resultsQ.data ?? []).forEach((r) => { if (r.order_id) resultsByOrder.set(r.order_id, r); });

  return (
    <div className="space-y-3">
      {(ordersQ.data ?? []).map((o) => {
        const res = resultsByOrder.get(o.id);
        return (
          <Card key={o.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-semibold">{o.lab_test_catalog?.name ?? "Radiology"}</div>
                <div className="text-xs text-muted-foreground">Ordered {fmt(o.ordered_at)}</div>
                {o.clinical_indication && (
                  <div className="mt-1 text-sm text-muted-foreground">{o.clinical_indication}</div>
                )}
              </div>
              <Badge variant="outline">{(o.status ?? "ordered").replace("_", " ")}</Badge>
            </div>
            {res && (
              <div className="mt-3 space-y-2">
                {res.findings && (
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Findings</div>
                    <div className="mt-1 whitespace-pre-wrap rounded-lg border bg-muted/30 p-3 text-sm">{res.findings}</div>
                  </div>
                )}
                {res.impression && (
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Impression</div>
                    <div className="mt-1 whitespace-pre-wrap rounded-lg border bg-muted/30 p-3 text-sm">{res.impression}</div>
                  </div>
                )}
                <div className="text-xs text-muted-foreground">
                  {res.radiologist ? `Reported by ${res.radiologist}` : "Reported"} · {fmt(res.reported_at)}
                </div>
                {Array.isArray(res.image_paths) && res.image_paths.length > 0 && (
                  <div className="text-xs text-muted-foreground">{res.image_paths.length} image(s) attached</div>
                )}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
