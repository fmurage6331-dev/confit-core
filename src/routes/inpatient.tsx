/**
 * LabTrack — Inpatient (IPD)
 * Copyright (c) 2026 Francis Muhoro. All rights reserved.
 */

import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { AccessDenied } from "@/lib/require-access";
import { useAuth } from "@/lib/auth-context";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { BedDouble, Search } from "lucide-react";

export const Route = createFileRoute("/inpatient")({
  component: () => (
    <AppShell>
      <InpatientGate />
    </AppShell>
  ),
});

function InpatientGate() {
  const { hasPerm } = useAuth();
  const canView =
    hasPerm("admissions_view") || hasPerm("admit_patient") || hasPerm("bed_management");
  if (!canView) return <AccessDenied />;
  return <Inpatient />;
}

type Ward = {
  id: string;
  name: string;
  ward_type: string | null;
  section: string | null;
  floor: string | null;
  daily_rate: number | null;
};
type Bed = { id: string; ward_id: string; bed_number: string; status: string | null };
type AdmissionRow = {
  id: string;
  patient_id: string | null;
  bed_id: string | null;
  ward_id: string | null;
  encounter_id: string | null;
  admitted_at: string | null;
  expected_discharge_date: string | null;
  discharged_at: string | null;
  admitting_doctor: string | null;
  admission_reason: string | null;
  admission_type: string | null;
  status: string | null;
  patients: { id: string; patient_name: string | null; file_number: string | null } | null;
  wards: { id: string; name: string } | null;
  beds: { id: string; bed_number: string } | null;
};

function Inpatient() {
  const { hasPerm } = useAuth();
  const canAdmit = hasPerm("admit_patient") || hasPerm("bed_management");
  const canDischarge =
    hasPerm("discharge_patient") || hasPerm("bed_management") || hasPerm("admit_patient");
  const canManageBeds = hasPerm("bed_management");
  const qc = useQueryClient();

  const wardsQ = useQuery({
    queryKey: ["ipd-wards"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wards")
        .select("id,name,ward_type,section,floor,daily_rate")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data ?? []) as Ward[];
    },
  });

  const bedsQ = useQuery({
    queryKey: ["ipd-beds"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("beds")
        .select("id,ward_id,bed_number,status")
        .order("bed_number");
      if (error) throw error;
      return (data ?? []) as Bed[];
    },
  });

  const admissionsQ = useQuery({
    queryKey: ["ipd-admissions-current"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admissions")
        .select(
          "id,patient_id,bed_id,ward_id,encounter_id,admitted_at,expected_discharge_date,discharged_at,admitting_doctor,admission_reason,admission_type,status,patients(id,patient_name,file_number),wards(id,name),beds(id,bed_number)",
        )
        .eq("status", "admitted")
        .order("admitted_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as AdmissionRow[];
    },
  });

  function refreshAll() {
    qc.invalidateQueries({ queryKey: ["ipd-beds"] });
    qc.invalidateQueries({ queryKey: ["ipd-admissions-current"] });
  }

  const bedsByWard = useMemo(() => {
    const map = new Map<string, Bed[]>();
    (bedsQ.data ?? []).forEach((b) => {
      const arr = map.get(b.ward_id) ?? [];
      arr.push(b);
      map.set(b.ward_id, arr);
    });
    return map;
  }, [bedsQ.data]);

  const admissionByBed = useMemo(() => {
    const m = new Map<string, AdmissionRow>();
    (admissionsQ.data ?? []).forEach((a) => {
      if (a.bed_id) m.set(a.bed_id, a);
    });
    return m;
  }, [admissionsQ.data]);

  const [selectedBed, setSelectedBed] = useState<{ bed: Bed; ward: Ward | undefined } | null>(null);
  const [admitOpen, setAdmitOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <BedDouble className="h-6 w-6 text-primary" /> Inpatient (IPD)
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage ward beds, admissions and discharges.
          </p>
        </div>
        {canAdmit && <Button onClick={() => setAdmitOpen(true)}>Admit patient</Button>}
      </div>

      <Tabs defaultValue="beds">
        <TabsList>
          <TabsTrigger value="beds">Bed availability</TabsTrigger>
          <TabsTrigger value="inpatients">Current inpatients</TabsTrigger>
        </TabsList>

        <TabsContent value="beds" className="mt-4">
          {wardsQ.isLoading || bedsQ.isLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : (
            <div className="space-y-8">
              {groupBySection(wardsQ.data ?? []).map(([sectionKey, sectionWards]) => (
                <section key={sectionKey} className="space-y-3">
                  <h2 className="text-lg font-semibold border-b pb-1">
                    {sectionLabel(sectionKey)}
                  </h2>
                  <div className="space-y-4">
                    {sectionWards.map((w) => {
                      const beds = bedsByWard.get(w.id) ?? [];
                      const occ = beds.filter((b) => b.status === "occupied").length;
                      return (
                        <div key={w.id} className="rounded-lg border bg-card p-4">
                          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                            <div>
                              <h3 className="font-semibold">{w.name}</h3>
                              <div className="text-xs text-muted-foreground">
                                {w.floor && `Floor ${w.floor} · `}
                                {occ}/{beds.length} occupied
                                {w.daily_rate ? ` · KES ${w.daily_rate}/day` : ""}
                              </div>
                            </div>
                            {canManageBeds && (
                              <BedManageControls ward={w} beds={beds} onChanged={refreshAll} />
                            )}
                          </div>
                          {beds.length === 0 ? (
                            <div className="text-sm text-muted-foreground">No beds configured.</div>
                          ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                              {beds.map((b) => (
                                <button
                                  key={b.id}
                                  onClick={() => setSelectedBed({ bed: b, ward: w })}
                                  className={`rounded-md border p-2 text-center text-xs font-medium transition ${bedColor(b.status)}`}
                                  title={b.status ?? ""}
                                >
                                  <div className="font-semibold">{b.bed_number}</div>
                                  <div className="text-[10px] uppercase tracking-wide opacity-80">
                                    {b.status ?? "?"}
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
              {(wardsQ.data ?? []).length === 0 && (
                <div className="text-sm text-muted-foreground">No wards configured.</div>
              )}
              <Legend />
            </div>
          )}
        </TabsContent>

        <TabsContent value="inpatients" className="mt-4">
          <CurrentInpatients
            rows={admissionsQ.data ?? []}
            loading={admissionsQ.isLoading}
            canDischarge={canDischarge}
            onDischarged={refreshAll}
          />
        </TabsContent>
      </Tabs>

      {/* Bed detail dialog */}
      <Dialog open={!!selectedBed} onOpenChange={(o) => !o && setSelectedBed(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Bed {selectedBed?.bed.bed_number} — {selectedBed?.ward?.name}
            </DialogTitle>
          </DialogHeader>
          {selectedBed &&
            (() => {
              const admission = admissionByBed.get(selectedBed.bed.id);
              const status = selectedBed.bed.status ?? "unknown";
              return (
                <div className="space-y-3 text-sm">
                  <div>
                    Status: <Badge className={badgeClass(status)}>{status}</Badge>
                  </div>
                  {admission && admission.patients ? (
                    <div className="rounded-md border p-3 space-y-1">
                      <div className="font-medium">
                        {admission.patients.patient_name ?? "Patient"}
                      </div>
                      {admission.patients.file_number && (
                        <div className="text-xs text-muted-foreground">
                          File #{admission.patients.file_number}
                        </div>
                      )}
                      <div className="text-xs">Admitted: {fmt(admission.admitted_at)}</div>
                      {admission.admitting_doctor && (
                        <div className="text-xs">Doctor: {admission.admitting_doctor}</div>
                      )}
                      {admission.admission_reason && (
                        <div className="text-xs">Reason: {admission.admission_reason}</div>
                      )}
                      {admission.expected_discharge_date && (
                        <div className="text-xs">
                          Expected discharge: {admission.expected_discharge_date}
                        </div>
                      )}
                      {canDischarge && (
                        <div className="pt-2 flex gap-2">
                          <DischargeButton
                            admissionId={admission.id}
                            encounterId={admission.encounter_id}
                            onDone={() => {
                              setSelectedBed(null);
                              refreshAll();
                            }}
                          />
                          {admission.encounter_id && (
                            <ReferOutButton
                              encounterId={admission.encounter_id}
                              onDone={() => {
                                setSelectedBed(null);
                                refreshAll();
                              }}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  ) : status === "available" && canAdmit ? (
                    <Button
                      onClick={() => {
                        setAdmitOpen(true);
                        setSelectedBed(null);
                      }}
                    >
                      Admit patient to this bed
                    </Button>
                  ) : (
                    <div className="text-muted-foreground">No active admission on this bed.</div>
                  )}
                </div>
              );
            })()}
        </DialogContent>
      </Dialog>

      {canAdmit && (
        <AdmitDialog
          open={admitOpen}
          onOpenChange={setAdmitOpen}
          wards={wardsQ.data ?? []}
          beds={bedsQ.data ?? []}
          onAdmitted={refreshAll}
        />
      )}
    </div>
  );
}

function bedColor(status: string | null) {
  switch (status) {
    case "available":
      return "bg-emerald-500/10 border-emerald-500/40 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300";
    case "occupied":
      return "bg-red-500/10 border-red-500/40 text-red-700 hover:bg-red-500/20 dark:text-red-300";
    case "cleaning":
      return "bg-amber-500/10 border-amber-500/40 text-amber-700 hover:bg-amber-500/20 dark:text-amber-300";
    case "maintenance":
      return "bg-slate-500/10 border-slate-500/40 text-slate-700 hover:bg-slate-500/20 dark:text-slate-300";
    default:
      return "bg-muted border-border text-muted-foreground hover:bg-muted/70";
  }
}
function badgeClass(status: string) {
  switch (status) {
    case "available":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
    case "occupied":
      return "bg-red-500/15 text-red-700 dark:text-red-300";
    case "cleaning":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
    case "maintenance":
      return "bg-slate-500/15 text-slate-700 dark:text-slate-300";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function Legend() {
  const items = [
    { s: "available", label: "Available" },
    { s: "occupied", label: "Occupied" },
    { s: "cleaning", label: "Cleaning" },
    { s: "maintenance", label: "Maintenance" },
  ];
  return (
    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
      {items.map((i) => (
        <div key={i.s} className="flex items-center gap-1.5">
          <span className={`inline-block h-3 w-3 rounded ${bedColor(i.s)}`} /> {i.label}
        </div>
      ))}
    </div>
  );
}

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}
function daysSince(iso: string | null) {
  if (!iso) return 0;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

export function DischargeButton({
  admissionId,
  encounterId,
  onDone,
}: {
  admissionId: string;
  encounterId: string | null;
  onDone: () => void;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    const body = summary.trim();
    if (!body) {
      toast.error("Discharge summary is required.");
      return;
    }
    setBusy(true);
    // 1) Insert discharge_note first (DB trigger requires this before status change)
    const { error: noteErr } = await supabase.from("clinical_notes").insert({
      encounter_id: encounterId,
      admission_id: admissionId,
      note_type: "discharge_note",
      content: body,
      authored_by: user?.id ?? null,
      authored_at: new Date().toISOString(),
    });
    if (noteErr) {
      setBusy(false);
      toast.error(noteErr.message);
      return;
    }
    // 2) Then discharge
    const { error } = await supabase
      .from("admissions")
      .update({ status: "discharged", discharged_at: new Date().toISOString() })
      .eq("id", admissionId);
    setBusy(false);
    if (error) {
      toast.error(
        /discharge summary/i.test(error.message)
          ? error.message
          : `Failed to discharge: ${error.message}`,
      );
      return;
    }
    toast.success("Patient discharged");
    setOpen(false);
    setSummary("");
    onDone();
  }

  return (
    <>
      <Button size="sm" variant="destructive" onClick={() => setOpen(true)}>
        Discharge
      </Button>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (!busy) setOpen(o);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discharge patient</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>
              Discharge summary <span className="text-rose-600">*</span>
            </Label>
            <Textarea
              rows={6}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Reason for discharge, condition at discharge, follow-up plan, medications, instructions…"
            />
            <p className="text-xs text-muted-foreground">
              A discharge summary is required. The bed will be freed automatically.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={submit} disabled={busy || !summary.trim()}>
              {busy ? "Discharging…" : "Confirm discharge"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ReferOutButton({
  encounterId,
  currentFacility,
  currentReason,
  onDone,
}: {
  encounterId: string;
  currentFacility?: string | null;
  currentReason?: string | null;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [facility, setFacility] = useState(currentFacility ?? "");
  const [reason, setReason] = useState(currentReason ?? "");
  const [busy, setBusy] = useState(false);

  async function submit() {
    const fac = facility.trim();
    if (!fac) {
      toast.error("Destination hospital/facility is required.");
      return;
    }
    if (!reason.trim()) {
      toast.error("Reason for referral is required.");
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from("patient_registrations")
      .update({
        referral_direction: "out",
        referral_out_facility: fac,
        referral_out_reason: reason.trim(),
      } as never)
      .eq("id", encounterId);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Patient marked as referred out");
    setOpen(false);
    onDone();
  }

  const alreadyReferred = !!currentFacility;

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        {alreadyReferred ? "Referred out ✓" : "Refer out"}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (!busy) setOpen(o);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Refer patient out</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>
                Destination hospital / facility <span className="text-rose-600">*</span>
              </Label>
              <Input
                value={facility}
                onChange={(e) => setFacility(e.target.value)}
                placeholder="e.g. Kenyatta National Hospital"
              />
            </div>
            <div>
              <Label>
                Reason for referral <span className="text-rose-600">*</span>
              </Label>
              <Textarea
                rows={4}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why is this patient being referred out?"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={busy || !facility.trim() || !reason.trim()}>
              {busy ? "Saving…" : "Confirm referral"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function CurrentInpatients({
  rows,
  loading,
  canDischarge,
  onDischarged,
}: {
  rows: AdmissionRow[];
  loading: boolean;
  canDischarge: boolean;
  onDischarged: () => void;
}) {
  if (loading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (rows.length === 0)
    return <div className="text-sm text-muted-foreground">No current inpatients.</div>;
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left">
          <tr>
            <th className="p-3">Patient</th>
            <th className="p-3">Ward</th>
            <th className="p-3">Bed</th>
            <th className="p-3">Admitted</th>
            <th className="p-3">Days</th>
            <th className="p-3">Doctor</th>
            <th className="p-3">Type</th>
            {canDischarge && <th className="p-3"></th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id} className="border-t">
              <td className="p-3">
                <div className="font-medium">{a.patients?.patient_name ?? "—"}</div>
                {a.patients?.file_number && (
                  <div className="text-xs text-muted-foreground">#{a.patients.file_number}</div>
                )}
              </td>
              <td className="p-3">{a.wards?.name ?? "—"}</td>
              <td className="p-3">{a.beds?.bed_number ?? "—"}</td>
              <td className="p-3">{fmt(a.admitted_at)}</td>
              <td className="p-3">{daysSince(a.admitted_at)}</td>
              <td className="p-3">{a.admitting_doctor ?? "—"}</td>
              <td className="p-3 capitalize">{a.admission_type ?? "—"}</td>
              {canDischarge && (
                <td className="p-3 text-right">
                  <div className="flex justify-end gap-2">
                    <DischargeButton
                      admissionId={a.id}
                      encounterId={a.encounter_id}
                      onDone={onDischarged}
                    />
                    {a.encounter_id && (
                      <ReferOutButton encounterId={a.encounter_id} onDone={onDischarged} />
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type PatientOpt = {
  id: string;
  patient_name: string | null;
  file_number: string | null;
  phone: string | null;
};

function AdmitDialog({
  open,
  onOpenChange,
  wards,
  beds,
  onAdmitted,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  wards: Ward[];
  beds: Bed[];
  onAdmitted: () => void;
}) {
  const qc = useQueryClient();
  const [wardId, setWardId] = useState<string>("");
  const [bedId, setBedId] = useState<string>("");
  const [patientId, setPatientId] = useState<string>("");
  const [patientSearch, setPatientSearch] = useState("");
  const [doctor, setDoctor] = useState("");
  const [reason, setReason] = useState("");
  const [type, setType] = useState<"elective" | "emergency">("elective");
  const [expected, setExpected] = useState("");
  const [busy, setBusy] = useState(false);

  const availableBeds = beds.filter((b) => b.ward_id === wardId && b.status === "available");

  const patientsQ = useQuery({
    queryKey: ["ipd-patient-search", patientSearch],
    enabled: open,
    queryFn: async () => {
      const term = patientSearch.trim();
      let q = supabase
        .from("patients")
        .select("id,patient_name,file_number,phone")
        .order("created_at", { ascending: false })
        .limit(20);
      if (term) {
        const like = `%${term}%`;
        q = q.or(
          `file_number.ilike.${like},patient_name.ilike.${like},first_name.ilike.${like},family_name.ilike.${like},phone.ilike.${like}`,
        );
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as PatientOpt[];
    },
  });

  function reset() {
    setWardId("");
    setBedId("");
    setPatientId("");
    setPatientSearch("");
    setDoctor("");
    setReason("");
    setType("elective");
    setExpected("");
  }

  async function submit() {
    if (!patientId) {
      toast.error("Select a patient");
      return;
    }
    if (!wardId || !bedId) {
      toast.error("Select a ward and bed");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("admissions").insert({
      patient_id: patientId,
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
      // Postgres exclusion constraint on overlapping active admissions per bed
      const msg = /exclu|conflict|overlap|unique/i.test(error.message)
        ? "This bed was just taken — please choose another."
        : error.message;
      toast.error(msg);
      qc.invalidateQueries({ queryKey: ["ipd-beds"] });
      setBedId("");
      return;
    }
    toast.success("Patient admitted");
    onAdmitted();
    reset();
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Admit patient</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Patient</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={patientSearch}
                onChange={(e) => {
                  setPatientSearch(e.target.value);
                  setPatientId("");
                }}
                placeholder="Search by name, file # or phone"
                className="pl-9"
              />
            </div>
            <div className="mt-2 max-h-40 overflow-y-auto rounded-md border">
              {(patientsQ.data ?? []).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setPatientId(p.id);
                    setPatientSearch(p.patient_name ?? "");
                  }}
                  className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent ${patientId === p.id ? "bg-accent" : ""}`}
                >
                  <span>{p.patient_name ?? "—"}</span>
                  <span className="text-xs text-muted-foreground">
                    {p.file_number ? `#${p.file_number}` : (p.phone ?? "")}
                  </span>
                </button>
              ))}
              {(patientsQ.data ?? []).length === 0 && (
                <div className="px-3 py-2 text-xs text-muted-foreground">No matches.</div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Ward</Label>
              <Select
                value={wardId}
                onValueChange={(v) => {
                  setWardId(v);
                  setBedId("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select ward" />
                </SelectTrigger>
                <SelectContent>
                  {wards.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Bed (available)</Label>
              <Select value={bedId} onValueChange={setBedId} disabled={!wardId}>
                <SelectTrigger>
                  <SelectValue placeholder={wardId ? "Select bed" : "Select ward first"} />
                </SelectTrigger>
                <SelectContent>
                  {availableBeds.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.bed_number}
                    </SelectItem>
                  ))}
                  {wardId && availableBeds.length === 0 && (
                    <div className="px-3 py-2 text-xs text-muted-foreground">
                      No available beds.
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Admitting doctor</Label>
              <Input
                value={doctor}
                onChange={(e) => setDoctor(e.target.value)}
                placeholder="Dr. ..."
              />
            </div>
            <div>
              <Label>Admission type</Label>
              <Select value={type} onValueChange={(v) => setType(v as "elective" | "emergency")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="elective">Elective</SelectItem>
                  <SelectItem value="emergency">Emergency</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Expected discharge date</Label>
            <Input type="date" value={expected} onChange={(e) => setExpected(e.target.value)} />
          </div>

          <div>
            <Label>Reason for admission</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Admitting…" : "Admit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const SECTION_ORDER = ["female", "male", "paediatrics", "other"] as const;
function groupBySection(wards: Ward[]): Array<[string, Ward[]]> {
  const map = new Map<string, Ward[]>();
  for (const w of wards) {
    const key = w.section ?? "other";
    const arr = map.get(key) ?? [];
    arr.push(w);
    map.set(key, arr);
  }
  return SECTION_ORDER.filter((k) => map.has(k))
    .map((k) => [k, map.get(k)!] as [string, Ward[]])
    .concat(
      Array.from(map.entries()).filter(
        ([k]) => !SECTION_ORDER.includes(k as (typeof SECTION_ORDER)[number]),
      ) as Array<[string, Ward[]]>,
    );
}
function sectionLabel(key: string) {
  switch (key) {
    case "female":
      return "Female Wards";
    case "male":
      return "Male Wards";
    case "paediatrics":
      return "Paediatrics (under 13)";
    default:
      return "Other Wards";
  }
}

function BedManageControls({
  ward,
  beds,
  onChanged,
}: {
  ward: Ward;
  beds: Bed[];
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);

  function nextBedNumber(): string {
    const nums = beds
      .map((b) => parseInt((b.bed_number.match(/\d+/) ?? ["0"])[0], 10))
      .filter((n) => !Number.isNaN(n));
    const next = (nums.length ? Math.max(...nums) : 0) + 1;
    return String(next).padStart(2, "0");
  }

  async function addBed() {
    setBusy(true);
    const { error } = await supabase.from("beds").insert({
      ward_id: ward.id,
      bed_number: nextBedNumber(),
      status: "available",
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Bed added");
    onChanged();
  }

  async function removeLastFreeBed() {
    const removable = [...beds]
      .filter((b) => b.status !== "occupied")
      .sort((a, b) => (a.bed_number < b.bed_number ? 1 : -1))[0];
    if (!removable) {
      toast.error("No free bed to remove (occupied beds can't be removed).");
      return;
    }
    if (!confirm(`Remove bed ${removable.bed_number} from ${ward.name}?`)) return;
    setBusy(true);
    const { error } = await supabase.from("beds").delete().eq("id", removable.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Bed removed");
    onChanged();
  }

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="outline" disabled={busy} onClick={removeLastFreeBed}>
        − Remove bed
      </Button>
      <Button size="sm" disabled={busy} onClick={addBed}>
        + Add bed
      </Button>
    </div>
  );
}
