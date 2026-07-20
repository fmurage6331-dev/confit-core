/**
 * LabTrack — Laboratory Records
 * Copyright (c) 2026 Francis Muhoro. All rights reserved.
 * Author: Francis Muhoro
 */

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/app-shell";
import { AccessDenied } from "@/lib/require-access";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  DoorOpen, FlaskConical, ArrowRight, ShieldAlert, ClipboardPlus,
  Activity, Stethoscope, Pill, Plus, Trash2, Check, X, Receipt, BedDouble, RefreshCw
} from "lucide-react";
import { toast } from "sonner";
import { DischargeButton } from "@/routes/inpatient";

export const Route = createFileRoute("/rooms/$id")({
  component: () => <AppShell><RoomPage /></AppShell>,
});

type RoomKind = "general" | "lab" | "triage" | "consultation" | "pharmacy" | "billing";
type Room = { id: string; name: string; code: string | null; kind: RoomKind };
type TestItem = { id: string; name: string; price: number; status?: "pending" | "completed" | "sent_back"; rejection_reason?: string };
type Vitals = {
  height_cm?: number | ""; weight_kg?: number | ""; bmi?: number | "";
  temperature_c?: number | ""; pulse_bpm?: number | ""; resp_rate?: number | "";
  bp_systolic?: number | ""; bp_diastolic?: number | ""; spo2?: number | "";
  head_circ_cm?: number | ""; muac_cm?: number | ""; growth_notes?: string;
  pain_score?: number | ""; general_appearance?: string;
};
type History = {
  presenting_complaint?: string; hpi?: string;
  past_medical?: string; past_surgical?: string; allergies?: string; current_meds?: string;
  smoking?: string; alcohol?: string; occupation_exposure?: string; family_history?: string;
  ros?: string;
};
type Diagnosis = { icd11_code: string; description: string; notes?: string };
type Reg = {
  id: string; patient_id: string | null; patient_name: string; file_number: string | null; from_room: string | null;
  tests: TestItem[];
  vitals: Vitals; history: History; diagnoses: Diagnosis[];
  payment_mode: "cash" | "insurance" | "free";
  insurance_coverage_percentage: number | null;
  payment_status: "unpaid" | "paid" | "waived" | "partial";
  status: "waiting" | "in_progress" | "done" | "cancelled";
  created_at: string;
};
type Service = {
  id: string; name: string; kind: string; category: string | null;
  price: number; cash_price: number | null; insurance_price: number | null;
};
// Added unit_price to StockItem so UI can surface pricing when prescribing
type StockItem = { id: string; name: string; kind: string | null; current_quantity: number | null; unit_price?: number | null };
type Prescription = {
  id: string; registration_id: string; stock_item_id: string | null;
  drug_name: string; dosage: string | null; frequency: string | null; duration: string | null;
  quantity: number; notes: string | null;
  status: "pending" | "dispensed" | "cancelled";
  created_at: string; dispensed_at: string | null;
};

const kindIcon: Record<RoomKind, React.ReactNode> = {
  general: <DoorOpen className="h-7 w-7 text-primary" />,
  lab: <FlaskConical className="h-7 w-7 text-primary" />,
  triage: <Activity className="h-7 w-7 text-primary" />,
  consultation: <Stethoscope className="h-7 w-7 text-primary" />,
  pharmacy: <Pill className="h-7 w-7 text-primary" />,
  billing: <Receipt className="h-7 w-7 text-primary" />,
};
const kindBlurb: Record<RoomKind, string> = {
  general: "Patients currently in this room. Request tests/services to send them for billing and the lab.",
  lab: "Lab requests sent here. Open a patient to perform requested tests or query feedback parameters.",
  triage: "Capture vitals and anthropometrics, then send the patient to consultation.",
  consultation: "Take history, diagnose (ICD-11), prescribe, and request lab / radiology / ward / theater.",
  pharmacy: "Dispense prescriptions. Dispensing deducts stock automatically.",
  billing: "Patients waiting for the accountant to acknowledge payment. Open Accounting to record payment or waive — the patient is then forwarded automatically.",
};
const KIND_LABELS: Record<string, string> = {
  service: "Services",
  lab: "Lab tests",
  radiology: "Radiology",
  ward: "Ward admission",
  theater: "Theater",
  consultation: "Consultation",
  procedure: "Procedure",
};
function kindLabel(k: string) { return KIND_LABELS[k] ?? k; }

function RoomPage() {
  const { id } = Route.useParams();
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [room, setRoom] = useState<Room | null>(null);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [rows, setRows] = useState<Reg[]>([]);
  const [loading, setLoading] = useState(true);
  const [openReg, setOpenReg] = useState<Reg | null>(null);

  useEffect(() => {
    (async () => {
      if (!user) return;
      const { data: r } = await supabase.from("rooms").select("id,name,code,kind").eq("id", id).maybeSingle();
      setRoom(r as unknown as Room | null);
      if (isAdmin) { setAllowed(true); }
      else {
        const { data: a } = await supabase.from("user_room_access")
          .select("room_id").eq("user_id", user.id).eq("room_id", id).maybeSingle();
        setAllowed(!!a);
      }
    })();
  }, [id, user, isAdmin]);

  async function loadRequests() {
    setLoading(true);
    const { data, error } = await supabase
      .from("patient_registrations")
      .select("id,patient_id,patient_name,file_number,from_room,tests,vitals,history,diagnoses,payment_mode,insurance_coverage_percentage,payment_status,status,created_at")
      .eq("current_room_id", id)
      .neq("status", "done")
      .neq("status", "cancelled")
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setRows(((data ?? []) as unknown as Reg[]).map((r) => ({
      ...r,
      tests: (r.tests ?? []) as TestItem[],
      vitals: (r.vitals ?? {}) as Vitals,
      history: (r.history ?? {}) as History,
      diagnoses: (r.diagnoses ?? []) as Diagnosis[],
    })));
  }
  useEffect(() => { if (allowed && room) loadRequests(); }, [allowed, room]);

  if (allowed === false) return <AccessDenied message="You don't have access to this room. Ask an admin to grant access." />;
  if (!room) return <div className="text-sm text-muted-foreground">Loading room…</div>;

  const kind = room.kind;

  function startLab(reg: Reg) {
    if (reg.payment_status !== "paid" && reg.payment_status !== "waived") {
      toast.error("Patient has not been cleared by accounting.");
      return;
    }
    navigate({ to: "/records/new", search: { reg: reg.file_number ?? "" } as never });
  }

  function actionLabel(): string {
    if (kind === "lab") return "Perform tests";
    if (kind === "triage") return "Take vitals";
    if (kind === "consultation") return "Consult";
    if (kind === "pharmacy") return "Dispense";
    if (kind === "billing") return "Open in Accounting";
    return "Request services";
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold">
            {kindIcon[kind]}{room.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{kindBlurb[kind]}</p>
        </div>
        <Button variant="outline" onClick={loadRequests}>Refresh</Button>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Patient</th>
              <th className="px-4 py-3">From</th>
              <th className="px-4 py-3">{kind === "pharmacy" ? "Diagnoses" : "Requested Items"}</th>
              <th className="px-4 py-3">Payment</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">No active patients.</td></tr>}
            {rows.map((r) => {
              const cleared = r.payment_status === "paid" || r.payment_status === "waived";
              const hasTests = (r.tests ?? []).length > 0;
              return (
                <tr key={r.id} className="border-t">
                  <td className="px-4 py-3">
                    <div className="font-medium">{r.patient_name}</div>
                    <div className="text-xs text-muted-foreground">{r.file_number ? `#${r.file_number}` : "—"}</div>
                  </td>
                  <td className="px-4 py-3">{r.from_room ?? <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-4 py-3">
                    {kind === "pharmacy" ? (
                      r.diagnoses.length > 0
                        ? <div className="flex flex-wrap gap-1">{r.diagnoses.slice(0,3).map((d,i) => <Badge key={i} variant="secondary" className="text-xs">{d.icd11_code || "—"} {d.description}</Badge>)}</div>
                        : <span className="text-xs text-muted-foreground">—</span>
                    ) : hasTests ? (
                      <div className="flex flex-wrap gap-1 items-center">
                        {r.tests.map((t) => (
                          <Badge key={t.id} variant={t.status === "sent_back" ? "destructive" : "secondary"} className="text-xs">
                            {t.name} {t.status === "sent_back" && "(Returned)"}
                          </Badge>
                        ))}
                      </div>
                    ) : <span className="text-xs text-muted-foreground">No services requested</span>}
                  </td>
                  <td className="px-4 py-3">
                    {cleared
                      ? <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">{r.payment_status}</Badge>
                      : <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100 flex w-fit items-center gap-1"><ShieldAlert className="h-3 w-3" />{r.payment_status}</Badge>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {kind === "lab" ? (
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => setOpenReg(r)}>
                          Manage Request Flow
                        </Button>
                        <Button size="sm" disabled={!cleared} onClick={() => startLab(r)}>
                          {actionLabel()} <ArrowRight className="ml-1 h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : kind === "billing" ? (
                      <Link to="/accounting" className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/5 px-3 py-1.5 text-sm text-primary hover:bg-primary/10">
                        <Receipt className="h-3.5 w-3.5" />{actionLabel()}
                      </Link>
                    ) : (
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => setOpenReg(r)}>
                          <ClipboardPlus className="mr-1 h-3.5 w-3.5" />{actionLabel()}
                        </Button>
                        <Link to="/queue" className="text-xs text-primary underline self-center">Queue</Link>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {openReg && kind === "triage" && (
        <TriageDialog reg={openReg} onClose={() => setOpenReg(null)} onSaved={() => { setOpenReg(null); loadRequests(); }} />
      )}
      {openReg && kind === "consultation" && (
        <ConsultationDialog reg={openReg} onClose={() => setOpenReg(null)} onSaved={() => { setOpenReg(null); loadRequests(); }} />
      )}
      {openReg && kind === "pharmacy" && (
        <PharmacyDialog reg={openReg} onClose={() => setOpenReg(null)} onSaved={() => { setOpenReg(null); loadRequests(); }} />
      )}
      {openReg && kind === "lab" && (
        <LabManagementDialog reg={openReg} onClose={() => setOpenReg(null)} onSaved={() => { setOpenReg(null); loadRequests(); }} />
      )}
      {openReg && (kind === "general") && (
        <RequestServicesDialog reg={openReg} onClose={() => setOpenReg(null)} onSaved={() => { setOpenReg(null); loadRequests(); }} />
      )}
    </div>
  );
}

/* ============================ LAB PANEL MANAGEMENT & DYNAMIC ROUTING ============================ */

function LabManagementDialog({ reg, onClose, onSaved }: { reg: Reg; onClose: () => void; onSaved: () => void }) {
  const [routingLoading, setRoutingLoading] = useState(false);
  const [selectedTest, setSelectedTest] = useState<TestItem | null>(null);

  async function handleSendResultsBack() {
    setRoutingLoading(true);
    
    // Primary Task: Call database RPC logic engine to dynamically calculate origin clinical station
    const { data: targetRoomId, error } = await supabase
      .rpc('send_lab_results_to_requesting_room', { p_encounter_id: reg.id });

    setRoutingLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Diagnostic profile metrics successfully routed to active clinician workspace.");
    onSaved();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Laboratory Request Workspace — {reg.patient_name}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-2">
          <p className="text-xs text-muted-foreground">Manage return metrics or perform pipeline routing for outstanding items.</p>
          
          <div className="space-y-2">
            <Label>Requested Profile Investigations</Label>
            {reg.tests.map((test) => (
              <div key={test.id} className="flex items-center justify-between border rounded-lg p-3 bg-card text-sm">
                <div>
                  <span className="font-medium">{test.name}</span>
                  {test.status === "sent_back" && (
                    <p className="text-xs text-destructive mt-0.5 font-medium">Returned: {test.rejection_reason}</p>
                  )}
                </div>
                {test.status !== "sent_back" && test.status !== "completed" && (
                  <Button size="sm" variant="destructive" onClick={() => setSelectedTest(test)}>
                    Return to Doctor
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>

        <DialogFooter className="flex justify-between items-center w-full sm:justify-between">
          <Button variant="outline" onClick={onClose}>Close panel</Button>
          <Button onClick={handleSendResultsBack} disabled={routingLoading} className="gap-1.5">
            <RefreshCw className={`h-4 w-4 ${routingLoading ? 'animate-spin' : ''}`} />
            Send results back
          </Button>
        </DialogFooter>

        {selectedTest && (
          <LabSendBackDialog 
            registrationId={reg.id}
            testItem={selectedTest} 
            allTests={reg.tests}
            onClose={() => setSelectedTest(null)} 
            onSuccess={() => {
              setSelectedTest(null);
              onSaved();
            }} 
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function LabSendBackDialog(_props: { registrationId: string; testItem: TestItem; allTests: TestItem[]; onClose: () => void; onSuccess: () => void }) {
  return null;
}

function TriageDialog(_props: { reg: Reg; onClose: () => void; onSaved: () => void }) { return null; }
function PharmacyDialog(_props: { reg: Reg; onClose: () => void; onSaved: () => void }) { return null; }
function RequestServicesDialog(_props: { reg: Reg; onClose: () => void; onSaved: () => void }) { return null; }

/* ============================ CONSULTATION DIALOG ============================ */

type LabCatalog = { id: string; name: string; price: number; cash_price: number | null; insurance_price: number | null; kind: string };

function ConsultationDialog({ reg, onClose, onSaved }: { reg: Reg; onClose: () => void; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  const [catalog, setCatalog] = useState<LabCatalog[]>([]);
  const [search, setSearch] = useState("");
  const [tests, setTests] = useState<TestItem[]>(reg.tests ?? []);
  const [history, setHistory] = useState<History>(reg.history ?? {});
  const [diagnoses, setDiagnoses] = useState<Diagnosis[]>(reg.diagnoses ?? []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("lab_test_catalog")
        .select("id,name,price,cash_price,insurance_price,kind")
        .eq("is_active", true)
        .order("name");
      setCatalog((data ?? []) as LabCatalog[]);
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return catalog.slice(0, 20);
    return catalog.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 30);
  }, [catalog, search]);

  function addTest(c: LabCatalog) {
    if (tests.some((t) => t.id === c.id)) return;
    const price = reg.payment_mode === "insurance" ? (c.insurance_price ?? c.price) : (c.cash_price ?? c.price);
    setTests([...tests, { id: c.id, name: c.name, price: Number(price) || 0, status: "pending" }]);
  }
  function removeTest(id: string) { setTests(tests.filter((t) => t.id !== id)); }

  function updateDx(i: number, patch: Partial<Diagnosis>) {
    setDiagnoses(diagnoses.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  }
  function addDx() { setDiagnoses([...diagnoses, { icd11_code: "", description: "", notes: "" }]); }
  function removeDx(i: number) { setDiagnoses(diagnoses.filter((_, idx) => idx !== i)); }

  async function save(sendToLab: boolean) {
    setSaving(true);
    const payload: Record<string, unknown> = { history, diagnoses, tests };
    const newLabTests = tests.filter((t) => !(reg.tests ?? []).some((rt) => rt.id === t.id));
    if (sendToLab && newLabTests.length > 0) {
      payload.payment_status = "unpaid";
      payload.from_room = "Consultation";
    }
    const { error } = await (supabase.from("patient_registrations") as any).update(payload).eq("id", reg.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(sendToLab && newLabTests.length > 0 ? "Consultation saved. Lab request sent." : "Consultation saved.");
    onSaved();
  }

  async function markDone() {
    setSaving(true);
    const { error } = await supabase.from("patient_registrations")
      .update({ history, diagnoses, tests, status: "done" }).eq("id", reg.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Consultation complete.");
    onSaved();
  }

  const hasPendingLab = tests.some((t) => t.status === "pending" || !t.status);
  const hasNewLab = tests.some((t) => !(reg.tests ?? []).some((rt) => rt.id === t.id));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-primary" />
            Consultation — {reg.patient_name}
            {reg.file_number && <Badge variant="secondary" className="ml-2">#{reg.file_number}</Badge>}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <section className="space-y-2">
            <h3 className="font-semibold text-sm">Clinical History</h3>
            <div>
              <Label className="text-xs">Presenting Complaint</Label>
              <Textarea rows={2} value={history.presenting_complaint ?? ""}
                onChange={(e) => setHistory({ ...history, presenting_complaint: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">History of Presenting Illness</Label>
              <Textarea rows={2} value={history.hpi ?? ""}
                onChange={(e) => setHistory({ ...history, hpi: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Past Medical</Label>
                <Textarea rows={2} value={history.past_medical ?? ""}
                  onChange={(e) => setHistory({ ...history, past_medical: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Allergies</Label>
                <Textarea rows={2} value={history.allergies ?? ""}
                  onChange={(e) => setHistory({ ...history, allergies: e.target.value })} />
              </div>
            </div>
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Diagnoses (ICD-11)</h3>
              <Button size="sm" variant="outline" onClick={addDx}><Plus className="h-3.5 w-3.5 mr-1" />Add</Button>
            </div>
            {diagnoses.length === 0 && <p className="text-xs text-muted-foreground">No diagnoses recorded.</p>}
            {diagnoses.map((d, i) => (
              <div key={i} className="flex gap-2 items-start">
                <Input placeholder="ICD-11 code" className="w-32" value={d.icd11_code}
                  onChange={(e) => updateDx(i, { icd11_code: e.target.value })} />
                <Input placeholder="Description" value={d.description}
                  onChange={(e) => updateDx(i, { description: e.target.value })} />
                <Button size="icon" variant="ghost" onClick={() => removeDx(i)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
          </section>

          <section className="space-y-2">
            <h3 className="font-semibold text-sm flex items-center gap-1"><FlaskConical className="h-4 w-4" />Request Lab Tests / Services</h3>
            <Input placeholder="Search tests…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <div className="max-h-40 overflow-y-auto border rounded-md divide-y">
              {filtered.map((c) => {
                const selected = tests.some((t) => t.id === c.id);
                return (
                  <button type="button" key={c.id} disabled={selected}
                    onClick={() => addTest(c)}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-muted/40 disabled:opacity-50">
                    <span>{c.name} <span className="text-xs text-muted-foreground">({c.kind})</span></span>
                    <span className="text-xs">{selected ? <Check className="h-4 w-4 text-emerald-600" /> : `KES ${c.price}`}</span>
                  </button>
                );
              })}
              {filtered.length === 0 && <div className="px-3 py-4 text-xs text-muted-foreground text-center">No matches.</div>}
            </div>
            {tests.length > 0 && (
              <div className="space-y-1">
                <Label className="text-xs">Selected</Label>
                {tests.map((t) => (
                  <div key={t.id} className="flex items-center justify-between text-sm border rounded-md px-3 py-1.5">
                    <span className="flex items-center gap-2">
                      {t.name}
                      {t.status === "completed" && <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">completed</Badge>}
                      {t.status === "sent_back" && <Badge variant="destructive">returned</Badge>}
                    </span>
                    <Button size="icon" variant="ghost" onClick={() => removeTest(t.id)}
                      disabled={t.status === "completed"}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={markDone} disabled={saving || hasPendingLab}>
              Complete Consultation
            </Button>
            <Button onClick={() => save(true)} disabled={saving || !hasNewLab} className="gap-1.5">
              <FlaskConical className="h-4 w-4" />Send Lab Request
            </Button>
            <Button variant="outline" onClick={() => save(false)} disabled={saving}>Save</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

