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
  Activity, Stethoscope, Pill, Plus, Trash2, Check, X, Receipt, BedDouble,
} from "lucide-react";
import { toast } from "sonner";
import { DischargeButton, ReferOutButton } from "@/routes/inpatient";

export const Route = createFileRoute("/rooms/$id")({
  component: () => <AppShell><RoomPage /></AppShell>,
});

type RoomKind = "general" | "lab" | "triage" | "consultation" | "pharmacy" | "billing";
type Room = { id: string; name: string; code: string | null; kind: RoomKind };
type TestItem = { id: string; name: string; price: number; requested_by_room_id?: string | null };
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
  lab: "Lab requests sent here. Open a patient to perform the requested tests.",
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
              <th className="px-4 py-3">{kind === "pharmacy" ? "Diagnoses" : "Requested"}</th>
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
                      <div className="flex flex-wrap gap-1">
                        {r.tests.map((t) => <Badge key={t.id} variant="secondary" className="text-xs">{t.name}</Badge>)}
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
                      <Button size="sm" disabled={!cleared} onClick={() => startLab(r)}>
                        {actionLabel()} <ArrowRight className="ml-1 h-3.5 w-3.5" />
                      </Button>
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
        <ConsultationDialog reg={openReg} roomId={id} onClose={() => setOpenReg(null)} onSaved={() => { setOpenReg(null); loadRequests(); }} />
      )}
      {openReg && kind === "pharmacy" && (
        <PharmacyDialog reg={openReg} onClose={() => setOpenReg(null)} onSaved={() => { setOpenReg(null); loadRequests(); }} />
      )}
      {openReg && (kind === "general") && (
        <RequestServicesDialog reg={openReg} roomId={id} onClose={() => setOpenReg(null)} onSaved={() => { setOpenReg(null); loadRequests(); }} />
      )}
    </div>
  );
}

/* ============================ TRIAGE ============================ */

function TriageDialog({ reg, onClose, onSaved }: { reg: Reg; onClose: () => void; onSaved: () => void }) {
  const [v, setV] = useState<Vitals>(reg.vitals ?? {});
  const [rooms, setRooms] = useState<{ id: string; name: string; kind: RoomKind }[]>([]);
  const [nextRoomId, setNextRoomId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("rooms").select("id,name,kind").eq("is_active", true).order("name")
      .then(({ data }) => {
        const list = (data ?? []) as unknown as { id: string; name: string; kind: RoomKind }[];
        setRooms(list);
        const consult = list.find((r) => r.kind === "consultation");
        if (consult) setNextRoomId(consult.id);
      });
  }, []);

  const bmi = useMemo(() => {
    const h = Number(v.height_cm); const w = Number(v.weight_kg);
    if (!h || !w) return "";
    return +(w / Math.pow(h / 100, 2)).toFixed(1);
  }, [v.height_cm, v.weight_kg]);

  function set<K extends keyof Vitals>(k: K, val: Vitals[K]) { setV((p) => ({ ...p, [k]: val })); }

  async function save() {
    setSaving(true);
    const vitals = { ...v, bmi: bmi === "" ? undefined : bmi };
    const patch: { vitals: Vitals; current_room_id?: string } = { vitals };
    if (nextRoomId) patch.current_room_id = nextRoomId;
    const { error } = await supabase.from("patient_registrations").update(patch as never).eq("id", reg.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Vitals saved");
    onSaved();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader><DialogTitle>Triage — {reg.patient_name}</DialogTitle></DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-6 pr-1">
          <Section title="Basic vitals">
            <Grid>
              <Num label="Height (cm)" value={v.height_cm} onChange={(n) => set("height_cm", n)} />
              <Num label="Weight (kg)" value={v.weight_kg} onChange={(n) => set("weight_kg", n)} />
              <ReadOnly label="BMI (auto)" value={bmi === "" ? "" : String(bmi)} />
              <Num label="Temperature (°C)" step="0.1" value={v.temperature_c} onChange={(n) => set("temperature_c", n)} />
              <Num label="Pulse (bpm)" value={v.pulse_bpm} onChange={(n) => set("pulse_bpm", n)} />
              <Num label="Respiratory rate" value={v.resp_rate} onChange={(n) => set("resp_rate", n)} />
              <Num label="BP systolic" value={v.bp_systolic} onChange={(n) => set("bp_systolic", n)} />
              <Num label="BP diastolic" value={v.bp_diastolic} onChange={(n) => set("bp_diastolic", n)} />
              <Num label="SpO₂ (%)" value={v.spo2} onChange={(n) => set("spo2", n)} />
            </Grid>
          </Section>
          <Section title="Pediatric">
            <Grid>
              <Num label="Head circumference (cm)" value={v.head_circ_cm} onChange={(n) => set("head_circ_cm", n)} />
              <Num label="MUAC (cm)" value={v.muac_cm} onChange={(n) => set("muac_cm", n)} />
            </Grid>
            <div className="mt-2">
              <Label>Growth / percentile notes</Label>
              <Textarea rows={2} value={v.growth_notes ?? ""} onChange={(e) => set("growth_notes", e.target.value)} />
            </div>
          </Section>
          <Section title="Pain & general">
            <Grid>
              <Num label="Pain score (0–10)" min={0} max={10} value={v.pain_score} onChange={(n) => set("pain_score", n)} />
            </Grid>
            <div className="mt-2">
              <Label>General appearance</Label>
              <Textarea rows={2} value={v.general_appearance ?? ""} onChange={(e) => set("general_appearance", e.target.value)} />
            </div>
          </Section>
          <Section title="Send to">
            <Select value={nextRoomId} onValueChange={setNextRoomId}>
              <SelectTrigger><SelectValue placeholder="Choose next room" /></SelectTrigger>
              <SelectContent>
                {rooms.map((r) => <SelectItem key={r.id} value={r.id}>{r.name} <span className="text-xs text-muted-foreground">({r.kind})</span></SelectItem>)}
              </SelectContent>
            </Select>
          </Section>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>Save & send</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ========================= CONSULTATION ========================= */

function ConsultationDialog({ reg, roomId, onClose, onSaved }: { reg: Reg; roomId: string; onClose: () => void; onSaved: () => void }) {
  const { user, hasPerm } = useAuth();
  const canAdmit = hasPerm("admit_patient");
  const [tab, setTab] = useState<"history" | "diagnosis" | "prescription" | "requests">("history");
  const [h, setH] = useState<History>(reg.history ?? {});
  const [dxs, setDxs] = useState<Diagnosis[]>(reg.diagnoses ?? []);
  const [rxs, setRxs] = useState<Prescription[]>([]);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [admitOpen, setAdmitOpen] = useState(false);
  const [admission, setAdmission] = useState<{ id: string; encounter_id: string | null; ward_name: string | null; bed_number: string | null } | null>(null);

  async function loadAdmission() {
    const { data } = await supabase
      .from("admissions")
      .select("id,encounter_id,wards(name),beds(bed_number)")
      .eq("encounter_id", reg.id)
      .eq("status", "admitted")
      .maybeSingle();
    if (data) {
      const d = data as unknown as { id: string; encounter_id: string | null; wards: { name: string } | null; beds: { bed_number: string } | null };
      setAdmission({ id: d.id, encounter_id: d.encounter_id, ward_name: d.wards?.name ?? null, bed_number: d.beds?.bed_number ?? null });
    } else setAdmission(null);
  }

  useEffect(() => {
    supabase.from("prescriptions").select("*").eq("registration_id", reg.id).order("created_at", { ascending: false })
      .then(({ data }) => setRxs((data ?? []) as Prescription[]));
    supabase.from("stock_items").select("id,name,kind,current_quantity").eq("kind", "pharmaceutical").order("name")
      .then(({ data }) => setStock((data ?? []) as StockItem[]));
    loadAdmission();
  }, [reg.id]);

  function setHK<K extends keyof History>(k: K, v: History[K]) { setH((p) => ({ ...p, [k]: v })); }

  async function saveNotes() {
    setSaving(true);
    const { error } = await supabase.from("patient_registrations").update({
      history: h, diagnoses: dxs,
    } as never).eq("id", reg.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Consultation saved");
  }

  async function addRx(rx: Omit<Prescription, "id" | "registration_id" | "status" | "created_at" | "dispensed_at">) {
    const { data, error } = await supabase.from("prescriptions").insert({
      registration_id: reg.id, ...rx, created_by: user?.id,
    }).select("*").single();
    if (error) { toast.error(error.message); return; }
    setRxs((p) => [data as Prescription, ...p]);
    toast.success("Prescription added — patient routed to pharmacy");
  }

  async function cancelRx(id: string) {
    const { error } = await supabase.from("prescriptions").update({ status: "cancelled" }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setRxs((p) => p.map((r) => r.id === id ? { ...r, status: "cancelled" } : r));
  }

  async function finishAndSend() {
    await saveNotes();
    if (rxs.some((r) => r.status === "pending")) {
      toast.info("Pending prescriptions will move the patient to pharmacy.");
    }
    onSaved();
  }

  const v = reg.vitals ?? {};

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[88vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-primary" /> Consultation — {reg.patient_name}
            {admission && (
              <Badge className="ml-2 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                <BedDouble className="mr-1 h-3 w-3" />
                Admitted{admission.ward_name ? ` · ${admission.ward_name}` : ""}{admission.bed_number ? ` bed ${admission.bed_number}` : ""}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {canAdmit && (
          <div className="flex flex-wrap items-center gap-2">
            {!admission ? (
              <Button size="sm" variant="outline" onClick={() => setAdmitOpen(true)}>
                <BedDouble className="mr-1 h-4 w-4" /> Admit to ward
              </Button>
            ) : (
              <DischargeButton
                admissionId={admission.id}
                encounterId={admission.encounter_id}
                onDone={() => { loadAdmission(); onSaved(); }}
              />
            )}
            <ReferOutButton encounterId={reg.id} onDone={() => onSaved()} />
          </div>
        )}

        {admitOpen && (
          <ConsultationAdmitDialog
            reg={reg}
            onClose={() => setAdmitOpen(false)}
            onAdmitted={() => { setAdmitOpen(false); loadAdmission(); }}
          />
        )}

        <div className="rounded-lg border bg-muted/30 p-2 text-xs grid grid-cols-2 md:grid-cols-4 gap-2">
          <VitalPill k="BP" v={v.bp_systolic && v.bp_diastolic ? `${v.bp_systolic}/${v.bp_diastolic}` : "—"} />
          <VitalPill k="Pulse" v={v.pulse_bpm ? `${v.pulse_bpm} bpm` : "—"} />
          <VitalPill k="Temp" v={v.temperature_c ? `${v.temperature_c} °C` : "—"} />
          <VitalPill k="SpO₂" v={v.spo2 ? `${v.spo2}%` : "—"} />
          <VitalPill k="Weight" v={v.weight_kg ? `${v.weight_kg} kg` : "—"} />
          <VitalPill k="Height" v={v.height_cm ? `${v.height_cm} cm` : "—"} />
          <VitalPill k="BMI" v={v.bmi ? String(v.bmi) : "—"} />
          <VitalPill k="Pain" v={v.pain_score !== undefined && v.pain_score !== "" ? `${v.pain_score}/10` : "—"} />
        </div>

        <div className="mt-2 flex gap-1 border-b">
          {(["history","diagnosis","prescription","requests"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-2 text-sm capitalize border-b-2 -mb-px ${tab === t ? "border-primary text-primary font-medium" : "border-transparent text-muted-foreground"}`}>
              {t === "requests" ? "Requests (Lab / Radiology / Ward / Theater)" : t}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto pt-3 pr-1 space-y-4">
          {tab === "history" && (
            <>
              <Section title="Presenting complaint & HPI">
                <TextField label="Chief complaint" value={h.presenting_complaint} onChange={(v) => setHK("presenting_complaint", v)} />
                <TextArea label="History of present illness" value={h.hpi} onChange={(v) => setHK("hpi", v)} />
              </Section>
              <Section title="Past medical / surgical">
                <TextArea label="Past medical" value={h.past_medical} onChange={(v) => setHK("past_medical", v)} />
                <TextArea label="Past surgical" value={h.past_surgical} onChange={(v) => setHK("past_surgical", v)} />
                <TextField label="Allergies" value={h.allergies} onChange={(v) => setHK("allergies", v)} />
                <TextField label="Current medications" value={h.current_meds} onChange={(v) => setHK("current_meds", v)} />
              </Section>
              <Section title="Social & family">
                <TextField label="Smoking" value={h.smoking} onChange={(v) => setHK("smoking", v)} />
                <TextField label="Alcohol" value={h.alcohol} onChange={(v) => setHK("alcohol", v)} />
                <TextField label="Occupational exposure" value={h.occupation_exposure} onChange={(v) => setHK("occupation_exposure", v)} />
                <TextArea label="Family history" value={h.family_history} onChange={(v) => setHK("family_history", v)} />
              </Section>
              <Section title="Review of systems">
                <TextArea label="ROS" value={h.ros} onChange={(v) => setHK("ros", v)} />
              </Section>
            </>
          )}

          {tab === "diagnosis" && (
            <DiagnosisEditor dxs={dxs} setDxs={setDxs} />
          )}

          {tab === "prescription" && (
            <PrescriptionEditor rxs={rxs} stock={stock} onAdd={addRx} onCancel={cancelRx} />
          )}

          {tab === "requests" && (
            <RequestServicesInline reg={reg} roomId={roomId} onSaved={onSaved} />
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={finishAndSend} disabled={saving}>Save consultation</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DiagnosisEditor({ dxs, setDxs }: { dxs: Diagnosis[]; setDxs: (d: Diagnosis[]) => void }) {
  const [code, setCode] = useState("");
  const [desc, setDesc] = useState("");
  const [notes, setNotes] = useState("");
  const [suggestions, setSuggestions] = useState<{ code: string; title: string; uri: string | null }[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searching, setSearching] = useState(false);

  // Debounced search: local icd11_codes cache first, WHO live API as fallback
  useEffect(() => {
    const q = desc.trim();
    if (q.length < 2) { setSuggestions([]); return; }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const { data: local } = await supabase
          .from("icd11_codes")
          .select("code,title,uri")
          .or(`title.ilike.%${q}%,code.ilike.${q}%`)
          .limit(10);

        let results = (local ?? []) as { code: string; title: string; uri: string | null }[];

        if (results.length < 5) {
          const { data: liveData, error: liveError } = await supabase.functions.invoke("icd11-search", {
            body: { query: q },
          });
          if (!liveError && liveData?.results) {
            const seen = new Set(results.map((r) => r.code));
            for (const r of liveData.results as { code: string; title: string; uri: string | null }[]) {
              if (!seen.has(r.code)) { results.push(r); seen.add(r.code); }
            }
          }
        }

        setSuggestions(results.slice(0, 10));
        setShowSuggestions(true);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [desc]);

  function pickSuggestion(s: { code: string; title: string; uri: string | null }) {
    setCode(s.code);
    setDesc(s.title);
    setShowSuggestions(false);
    // Cache/refresh this code locally so future searches are faster
    supabase.from("icd11_codes").upsert({
      code: s.code, title: s.title, uri: s.uri, validated_at: new Date().toISOString(),
    } as never, { onConflict: "code" }).then(() => {});
  }

  function add() {
    if (!code.trim() && !desc.trim()) { toast.error("Enter an ICD-11 code or description"); return; }
    setDxs([...dxs, { icd11_code: code.trim(), description: desc.trim(), notes: notes.trim() || undefined }]);
    setCode(""); setDesc(""); setNotes(""); setSuggestions([]);
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border p-3 space-y-2">
        <div className="grid gap-2 md:grid-cols-3">
          <div>
            <Label>ICD-11 code</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. CA22.0" />
          </div>
          <div className="md:col-span-2 relative">
            <Label>Diagnosis</Label>
            <Input
              value={desc}
              onChange={(e) => { setDesc(e.target.value); setShowSuggestions(true); }}
              onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              placeholder="e.g. Acute bronchitis"
              autoComplete="off"
            />
            {showSuggestions && (searching || suggestions.length > 0) && (
              <div className="absolute z-10 mt-1 w-full max-h-64 overflow-y-auto rounded-md border bg-popover shadow-md">
                {searching && suggestions.length === 0 && (
                  <div className="px-3 py-2 text-xs text-muted-foreground">Searching…</div>
                )}
                {suggestions.map((s) => (
                  <button
                    key={s.code}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pickSuggestion(s)}
                    className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                  >
                    <span className="shrink-0 font-mono text-xs text-primary">{s.code}</span>
                    <span>{s.title}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div><Label>Notes</Label><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        <div className="flex justify-end"><Button size="sm" onClick={add}><Plus className="mr-1 h-3.5 w-3.5" />Add diagnosis</Button></div>
      </div>
      {dxs.length === 0 && <p className="text-sm text-muted-foreground">No diagnoses added.</p>}
      {dxs.map((d, i) => (
        <div key={i} className="flex items-start justify-between rounded-lg border p-3">
          <div>
            <div className="text-sm font-medium">{d.icd11_code || <span className="text-muted-foreground">no code</span>} — {d.description}</div>
            {d.notes && <div className="text-xs text-muted-foreground mt-0.5">{d.notes}</div>}
          </div>
          <Button variant="ghost" size="icon" onClick={() => setDxs(dxs.filter((_, x) => x !== i))}><Trash2 className="h-4 w-4 text-destructive" /></Button>
        </div>
      ))}
    </div>
  );
}

function PrescriptionEditor({
  rxs, stock, onAdd, onCancel,
}: {
  rxs: Prescription[]; stock: StockItem[];
  onAdd: (rx: Omit<Prescription, "id" | "registration_id" | "status" | "created_at" | "dispensed_at">) => void | Promise<void>;
  onCancel: (id: string) => void;
}) {
  const [stockId, setStockId] = useState<string>("");
  const [drugName, setDrugName] = useState(""); const [dosage, setDosage] = useState("");
  const [freq, setFreq] = useState(""); const [duration, setDuration] = useState("");
  const [qty, setQty] = useState<number>(1); const [notes, setNotes] = useState("");

  function selectStock(id: string) {
    setStockId(id);
    const s = stock.find((x) => x.id === id);
    if (s && !drugName) setDrugName(s.name);
  }
  async function add() {
    if (!drugName.trim()) { toast.error("Drug name is required"); return; }
    await onAdd({
      stock_item_id: stockId || null, drug_name: drugName.trim(),
      dosage: dosage || null, frequency: freq || null, duration: duration || null,
      quantity: Number(qty) || 1, notes: notes || null,
    });
    setStockId(""); setDrugName(""); setDosage(""); setFreq(""); setDuration(""); setQty(1); setNotes("");
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border p-3 space-y-2">
        <div className="grid gap-2 md:grid-cols-2">
          <div>
            <Label>Pharmacy stock (optional)</Label>
            <Select value={stockId} onValueChange={selectStock}>
              <SelectTrigger><SelectValue placeholder="Link to a stock item" /></SelectTrigger>
              <SelectContent>
                {stock.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} <span className="text-xs text-muted-foreground">({s.current_quantity ?? 0})</span></SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Drug name</Label><Input value={drugName} onChange={(e) => setDrugName(e.target.value)} /></div>
          <div><Label>Dosage</Label><Input value={dosage} onChange={(e) => setDosage(e.target.value)} placeholder="500 mg" /></div>
          <div><Label>Frequency</Label><Input value={freq} onChange={(e) => setFreq(e.target.value)} placeholder="TDS" /></div>
          <div><Label>Duration</Label><Input value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="5 days" /></div>
          <div><Label>Quantity</Label><Input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} /></div>
        </div>
        <div><Label>Notes</Label><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        <div className="flex justify-end"><Button size="sm" onClick={add}><Plus className="mr-1 h-3.5 w-3.5" />Add prescription</Button></div>
      </div>

      {rxs.length === 0 && <p className="text-sm text-muted-foreground">No prescriptions yet.</p>}
      {rxs.map((rx) => (
        <div key={rx.id} className="flex items-start justify-between rounded-lg border p-3">
          <div>
            <div className="text-sm font-medium">{rx.drug_name} <span className="text-xs text-muted-foreground">×{rx.quantity}</span></div>
            <div className="text-xs text-muted-foreground">{[rx.dosage, rx.frequency, rx.duration].filter(Boolean).join(" · ") || "—"}</div>
            {rx.notes && <div className="text-xs mt-0.5">{rx.notes}</div>}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={rx.status === "pending" ? "secondary" : rx.status === "dispensed" ? "default" : "outline"}>{rx.status}</Badge>
            {rx.status === "pending" && (
              <Button variant="ghost" size="icon" onClick={() => onCancel(rx.id)}><X className="h-4 w-4 text-destructive" /></Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ============================ PHARMACY ============================ */

function PharmacyDialog({ reg, onClose, onSaved }: { reg: Reg; onClose: () => void; onSaved: () => void }) {
  const { user } = useAuth();
  const [rxs, setRxs] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from("prescriptions").select("*").eq("registration_id", reg.id).order("created_at", { ascending: false });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setRxs((data ?? []) as Prescription[]);
  }
  useEffect(() => { load(); }, [reg.id]);

  async function dispense(rx: Prescription) {
    const { error } = await supabase.from("prescriptions").update({
      status: "dispensed", dispensed_by: user?.id, dispensed_at: new Date().toISOString(),
    }).eq("id", rx.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Dispensed ${rx.drug_name}`);
    load();
  }
  async function cancel(rx: Prescription) {
    const { error } = await supabase.from("prescriptions").update({ status: "cancelled" }).eq("id", rx.id);
    if (error) { toast.error(error.message); return; }
    load();
  }
  async function finish() {
    const anyPending = rxs.some((r) => r.status === "pending");
    if (anyPending) { toast.error("Dispense or cancel all pending prescriptions first."); return; }
    const { error } = await supabase.from("patient_registrations").update({ status: "done" } as never).eq("id", reg.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Patient visit closed");
    onSaved();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Pill className="h-5 w-5 text-primary" /> Pharmacy — {reg.patient_name}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!loading && rxs.length === 0 && <p className="text-sm text-muted-foreground">No prescriptions for this patient.</p>}
          {rxs.map((rx) => (
            <div key={rx.id} className="flex items-start justify-between rounded-lg border p-3">
              <div>
                <div className="text-sm font-medium">{rx.drug_name} <span className="text-xs text-muted-foreground">×{rx.quantity}</span></div>
                <div className="text-xs text-muted-foreground">{[rx.dosage, rx.frequency, rx.duration].filter(Boolean).join(" · ") || "—"}</div>
                {rx.notes && <div className="text-xs mt-0.5">{rx.notes}</div>}
                {!rx.stock_item_id && <div className="text-[10px] uppercase text-amber-600 mt-1">No linked stock — no auto deduction</div>}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={rx.status === "pending" ? "secondary" : rx.status === "dispensed" ? "default" : "outline"}>{rx.status}</Badge>
                {rx.status === "pending" && (
                  <>
                    <Button size="sm" onClick={() => dispense(rx)}><Check className="h-4 w-4 mr-1" />Dispense</Button>
                    <Button size="sm" variant="ghost" onClick={() => cancel(rx)}><X className="h-4 w-4 text-destructive" /></Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={finish}>Close visit</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ======================== SERVICES (general room) ======================== */

function RequestServicesDialog({ reg, roomId, onClose, onSaved }: { reg: Reg; roomId: string; onClose: () => void; onSaved: () => void }) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader><DialogTitle>Request services for {reg.patient_name}</DialogTitle></DialogHeader>
        <div className="flex-1 overflow-y-auto pr-1"><RequestServicesInline reg={reg} roomId={roomId} onSaved={onSaved} /></div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RequestServicesInline({ reg, roomId, onSaved }: { reg: Reg; roomId: string; onSaved: () => void }) {
  const [services, setServices] = useState<Service[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set((reg.tests ?? []).map((t) => t.id)));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("lab_test_catalog")
      .select("id,name,kind,category,price,cash_price,insurance_price")
      .eq("is_active", true).order("kind").order("name")
      .then(({ data }) => setServices((data ?? []) as Service[]));
  }, []);

  const priceFor = (s: Service) => {
    if (reg.payment_mode === "insurance") return Number(s.insurance_price ?? s.cash_price ?? s.price ?? 0);
    return Number(s.cash_price ?? s.price ?? 0);
  };
  const picked = useMemo(() => services.filter((s) => selected.has(s.id)), [services, selected]);
  const subtotal = picked.reduce((sum, s) => sum + priceFor(s), 0);
  const coveragePct = reg.payment_mode === "insurance" ? Number(reg.insurance_coverage_percentage ?? 0) : 0;
  const insuranceCovered = reg.payment_mode === "insurance" ? +(subtotal * coveragePct / 100).toFixed(2) : 0;
  const patientDue = reg.payment_mode === "free" ? 0 : +(subtotal - insuranceCovered).toFixed(2);

  function toggle(id: string) {
    setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  async function save() {
    if (picked.length === 0) { toast.error("Pick at least one service"); return; }
    setSaving(true);
    // Preserve the room that originally requested each already-existing test (so a test
    // added earlier by another room keeps pointing back to that room), and tag any newly
    // picked test with this room. This is what lets overlapping requests — e.g. Room A
    // and Room B both ordering tests for the same visit — route results back correctly.
    const existingById = new Map((reg.tests ?? []).map((t) => [t.id, t]));
    const nextTests = picked.map((s) => ({
      id: s.id,
      name: s.name,
      price: priceFor(s),
      requested_by_room_id: existingById.get(s.id)?.requested_by_room_id ?? roomId ?? null,
    }));
    const { error } = await supabase.from("patient_registrations").update({
      tests: nextTests,
      subtotal, insurance_covered: insuranceCovered, patient_due: patientDue,
      payment_status: reg.payment_mode === "free" ? "waived" : (patientDue === 0 ? "waived" : "unpaid"),
      amount_paid: 0,
    } as never).eq("id", reg.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Services requested — patient routed for billing / lab");
    onSaved();
  }

  const grouped = useMemo(() => {
    const g: Record<string, Service[]> = {};
    services.forEach((s) => { const k = s.kind || "service"; (g[k] ??= []).push(s); });
    return g;
  }, [services]);

  return (
    <div className="space-y-4">
      <div className="text-xs text-muted-foreground">
        Payment mode: <span className="font-medium uppercase">{reg.payment_mode}</span>
        {reg.payment_mode === "insurance" && <> · Cover {coveragePct}%</>}
      </div>
      {services.length === 0 && <p className="text-sm text-muted-foreground">No services configured. Ask an admin to add them under Services.</p>}
      {Object.entries(grouped).map(([kind, list]) => (
        <div key={kind}>
          <div className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">{kindLabel(kind)}</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {list.map((s) => {
              const active = selected.has(s.id);
              return (
                <button key={s.id} type="button" onClick={() => toggle(s.id)}
                  className={`flex items-start justify-between rounded-lg border p-3 text-left transition ${active ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-accent"}`}>
                  <div>
                    <div className="text-sm font-medium">{s.name}</div>
                    {s.category && <div className="text-[10px] uppercase text-muted-foreground">{s.category}</div>}
                  </div>
                  <div className="text-xs tabular-nums">KSh {priceFor(s).toFixed(2)}</div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <div className="rounded-lg border bg-muted/30 p-3 text-sm">
        <div className="flex justify-between"><span>Subtotal</span><span className="tabular-nums">KSh {subtotal.toFixed(2)}</span></div>
        {reg.payment_mode === "insurance" && (
          <div className="flex justify-between text-muted-foreground"><span>Insurance ({coveragePct}%)</span><span className="tabular-nums">-KSh {insuranceCovered.toFixed(2)}</span></div>
        )}
        <div className="mt-1 flex justify-between border-t pt-1 font-semibold"><span>Patient pays</span><span className="tabular-nums">KSh {patientDue.toFixed(2)}</span></div>
      </div>
      <div className="flex justify-end"><Button onClick={save} disabled={saving}>Send request</Button></div>
    </div>
  );
}

/* ============================ helpers ============================ */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">{title}</div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">{children}</div>;
}
function Num({ label, value, onChange, step, min, max }: { label: string; value: number | "" | undefined; onChange: (n: number | "") => void; step?: string; min?: number; max?: number }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input type="number" step={step} min={min} max={max}
        value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))} />
    </div>
  );
}
function ReadOnly({ label, value }: { label: string; value: string }) {
  return <div><Label>{label}</Label><Input value={value} readOnly className="bg-muted/50" /></div>;
}
function TextField({ label, value, onChange }: { label: string; value?: string; onChange: (v: string) => void }) {
  return <div><Label>{label}</Label><Input value={value ?? ""} onChange={(e) => onChange(e.target.value)} /></div>;
}
function TextArea({ label, value, onChange }: { label: string; value?: string; onChange: (v: string) => void }) {
  return <div><Label>{label}</Label><Textarea rows={3} value={value ?? ""} onChange={(e) => onChange(e.target.value)} /></div>;
}
function VitalPill({ k, v }: { k: string; v: string }) {
  return <div className="flex items-center justify-between rounded-md bg-background px-2 py-1 border"><span className="text-muted-foreground">{k}</span><span className="font-medium">{v}</span></div>;
}

/* ==================== ADMIT (from Consultation) ==================== */

type WardOpt = { id: string; name: string };
type BedOpt = { id: string; ward_id: string; bed_number: string; status: string | null };

function ConsultationAdmitDialog({ reg, onClose, onAdmitted }: { reg: Reg; onClose: () => void; onAdmitted: () => void }) {
  const { user } = useAuth();
  const [wards, setWards] = useState<WardOpt[]>([]);
  const [beds, setBeds] = useState<BedOpt[]>([]);
  const [wardId, setWardId] = useState("");
  const [bedId, setBedId] = useState("");
  const [doctor, setDoctor] = useState(user?.email ?? "");
  const [reason, setReason] = useState("");
  const [type, setType] = useState<"elective" | "emergency">("elective");
  const [expected, setExpected] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from("wards").select("id,name").eq("is_active", true).order("name")
      .then(({ data }) => setWards((data ?? []) as WardOpt[]));
  }, []);

  async function loadBeds(wid: string) {
    const { data } = await supabase.from("beds").select("id,ward_id,bed_number,status")
      .eq("ward_id", wid).eq("status", "available").order("bed_number");
    setBeds((data ?? []) as BedOpt[]);
  }
  useEffect(() => { if (wardId) loadBeds(wardId); else setBeds([]); }, [wardId]);

  async function submit() {
    if (!reg.patient_id) { toast.error("Missing patient id on encounter"); return; }
    if (!wardId || !bedId) { toast.error("Select ward and bed"); return; }
    setBusy(true);
    const { error } = await supabase.from("admissions").insert({
      patient_id: reg.patient_id,
      encounter_id: reg.id,
      ward_id: wardId,
      bed_id: bedId,
      admitting_doctor: doctor || null,
      admission_reason: reason || null,
      admission_type: type,
      expected_discharge_date: expected || null,
      status: "admitted",
      admitted_at: new Date().toISOString(),
    });
    setBusy(false);
    if (error) {
      const msg = /exclu|conflict|overlap|unique/i.test(error.message)
        ? "This bed was just taken — please choose another."
        : error.message;
      toast.error(msg);
      setBedId("");
      loadBeds(wardId);
      return;
    }
    toast.success("Patient admitted");
    onAdmitted();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Admit {reg.patient_name} to ward</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Ward</Label>
              <Select value={wardId} onValueChange={(v) => { setWardId(v); setBedId(""); }}>
                <SelectTrigger><SelectValue placeholder="Select ward" /></SelectTrigger>
                <SelectContent>
                  {wards.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Bed (available)</Label>
              <Select value={bedId} onValueChange={setBedId} disabled={!wardId}>
                <SelectTrigger><SelectValue placeholder={wardId ? "Select bed" : "Select ward first"} /></SelectTrigger>
                <SelectContent>
                  {beds.map((b) => <SelectItem key={b.id} value={b.id}>{b.bed_number}</SelectItem>)}
                  {wardId && beds.length === 0 && <div className="px-3 py-2 text-xs text-muted-foreground">No available beds.</div>}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Admitting doctor</Label><Input value={doctor} onChange={(e) => setDoctor(e.target.value)} /></div>
            <div>
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as "elective" | "emergency")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="elective">Elective</SelectItem>
                  <SelectItem value="emergency">Emergency</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Expected discharge date</Label><Input type="date" value={expected} onChange={(e) => setExpected(e.target.value)} /></div>
          <div><Label>Reason for admission</Label><Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy}>{busy ? "Admitting…" : "Admit"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
