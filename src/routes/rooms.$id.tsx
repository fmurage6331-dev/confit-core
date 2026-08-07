/**
 * LabTrack — Laboratory Records
 * Copyright (c) 2026 Francis Muhoro. All rights reserved.
 * Author: Francis Muhoro
 */

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/app-shell";
import { AccessDenied } from "@/lib/require-access";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  DoorOpen,
  FlaskConical,
  ScanLine,
  ArrowRight,
  ShieldAlert,
  ShieldHalf,
  ClipboardPlus,
  Activity,
  Stethoscope,
  Pill,
  Plus,
  Trash2,
  Check,
  X,
  Receipt,
  BedDouble,
  Printer,
  Clock,
  Scissors,
  Archive,
  Baby,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ServicePicker } from "@/components/service-picker";
import { DischargeButton, ReferOutButton } from "@/routes/inpatient";

export const Route = createFileRoute("/rooms/$id")({
  component: () => (
    <AppShell>
      <RoomPage />
    </AppShell>
  ),
});

type RoomKind =
  | "general"
  | "lab"
  | "radiology"
  | "triage"
  | "consultation"
  | "pharmacy"
  | "billing"
  | "insurance"
  | "ward"
  | "theatre"
  | "mortuary"
  | "mch";
type Room = {
  id: string;
  name: string;
  code: string | null;
  kind: RoomKind;
  ward_id: string | null;
};
type TestItem = { id: string; name: string; price: number; requested_by_room_id?: string | null };
type Vitals = {
  height_cm?: number | "";
  weight_kg?: number | "";
  bmi?: number | "";
  temperature_c?: number | "";
  pulse_bpm?: number | "";
  resp_rate?: number | "";
  bp_systolic?: number | "";
  bp_diastolic?: number | "";
  spo2?: number | "";
  head_circ_cm?: number | "";
  muac_cm?: number | "";
  growth_notes?: string;
  pain_score?: number | "";
  general_appearance?: string;
};
type History = {
  presenting_complaint?: string;
  hpi?: string;
  past_medical?: string;
  past_surgical?: string;
  allergies?: string;
  current_meds?: string;
  smoking?: string;
  alcohol?: string;
  occupation_exposure?: string;
  family_history?: string;
  ros?: string;
};
type Diagnosis = {
  icd11_code: string;
  description: string;
  notes?: string;
  idsr_indicator_code?: string;
};
type Reg = {
  id: string;
  patient_id: string | null;
  patient_name: string;
  file_number: string | null;
  from_room: string | null;
  tests: TestItem[];
  vitals: Vitals;
  history: History;
  diagnoses: Diagnosis[];
  payment_mode: "cash" | "insurance" | "free";
  insurance_coverage_percentage: number | null;
  payment_status: "unpaid" | "paid" | "waived" | "partial";
  status: "waiting" | "in_progress" | "done" | "cancelled";
  created_at: string;
  sha_member_number: string | null;
  sha_relationship_to_principal: string | null;
  sha_notification_number: string | null;
  preauth_number: string | null;
  claim_number: string | null;
  claim_status: string | null;
  insurance_provider_id: string | null;
  insurer_type: string | null;
};
type Service = {
  id: string;
  name: string;
  kind: string;
  category: string | null;
  price: number;
  cash_price: number | null;
  insurance_price: number | null;
};
type StockItem = {
  id: string;
  name: string;
  kind: string | null;
  current_quantity: number | null;
  unit_price?: number | null;
  strength: number | null;
  strength_unit: string | null;
};
type Prescription = {
  id: string;
  registration_id: string;
  stock_item_id: string | null;
  drug_name: string;
  dosage: string | null;
  frequency: string | null;
  duration: string | null;
  quantity: number;
  notes: string | null;
  status: "pending" | "dispensed" | "cancelled";
  prescribed_by_name: string | null;
  dispensed_by_name: string | null;
  created_at: string;
  dispensed_at: string | null;
};

const kindIcon: Record<RoomKind, React.ReactNode> = {
  general: <DoorOpen className="h-7 w-7 text-primary" />,
  lab: <FlaskConical className="h-7 w-7 text-primary" />,
  radiology: <ScanLine className="h-7 w-7 text-primary" />,
  triage: <Activity className="h-7 w-7 text-primary" />,
  consultation: <Stethoscope className="h-7 w-7 text-primary" />,
  pharmacy: <Pill className="h-7 w-7 text-primary" />,
  billing: <Receipt className="h-7 w-7 text-primary" />,
  insurance: <ShieldHalf className="h-7 w-7 text-primary" />,
  ward: <BedDouble className="h-7 w-7 text-primary" />,
  theatre: <Scissors className="h-7 w-7 text-primary" />,
  mortuary: <Archive className="h-7 w-7 text-primary" />,
  mch: <Baby className="h-7 w-7 text-primary" />,
};
const kindBlurb: Record<RoomKind, string> = {
  general:
    "Patients currently in this room. Request tests/services to send them for billing and the lab.",
  lab: "Lab requests sent here. Open a patient to perform the requested tests.",
  radiology: "This room's imaging requests are handled on the dedicated Radiology worklist.",
  triage: "Capture vitals and anthropometrics, then send the patient to consultation.",
  consultation:
    "Take history, diagnose (ICD-11), prescribe, and request lab / radiology / ward / theater.",
  pharmacy: "Dispense prescriptions. Dispensing deducts stock automatically.",
  billing:
    "Patients waiting for the accountant to acknowledge payment. Open Accounting to record payment or waive — the patient is then forwarded automatically.",
  insurance:
    "SHA / Insurance desk. Review member details, pre-authorization, FHIR preview and submit claims to the queue.",
  ward: "Inpatient ward. View bed occupancy, active admissions and open patient clinical charts.",
  theatre: "Surgical theatre. Manage active cases and pre-op patients.",
  mortuary: "Deceased storage and release management. Daily charges accrue automatically.",
  mch: "Maternal and Child Health / Family Planning. MOH 642 and FP reports draw from this room.",
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
function kindLabel(k: string) {
  return KIND_LABELS[k] ?? k;
}

function RoomPage() {
  const { id } = Route.useParams();
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [room, setRoom] = useState<Room | null>(null);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [rows, setRows] = useState<Reg[]>([]);
  const [loading, setLoading] = useState(true);
  const [openReg, setOpenReg] = useState<Reg | null>(null);
  const [rxByReg, setRxByReg] = useState<Map<string, Prescription[]>>(new Map());
  const [consultFilter, setConsultFilter] = useState<ConsultPriority | null>(null);

  useEffect(() => {
    (async () => {
      if (!user) return;
      const { data: r } = await supabase
        .from("rooms")
        .select("id,name,code,kind,ward_id")
        .eq("id", id)
        .maybeSingle();
      setRoom(r as unknown as Room | null);
      if (isAdmin) {
        setAllowed(true);
      } else {
        const { data: a } = await supabase
          .from("user_room_access")
          .select("room_id")
          .eq("user_id", user.id)
          .eq("room_id", id)
          .maybeSingle();
        setAllowed(!!a);
      }
    })();
  }, [id, user, isAdmin]);

  async function loadRequests() {
    setLoading(true);
    const { data, error } = await supabase
      .from("patient_registrations")
      .select(
        "id,patient_id,patient_name,file_number,from_room,tests,vitals,history,diagnoses,payment_mode,insurance_coverage_percentage,payment_status,status,created_at,sha_member_number,sha_relationship_to_principal,sha_notification_number,preauth_number,claim_number,claim_status,insurance_provider_id,insurer_type",
      )
      .eq("current_room_id", id)
      .neq("status", "done")
      .neq("status", "cancelled")
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const regs = ((data ?? []) as unknown as Reg[]).map((r) => ({
      ...r,
      tests: (r.tests ?? []) as TestItem[],
      vitals: (r.vitals ?? {}) as Vitals,
      history: (r.history ?? {}) as History,
      diagnoses: (r.diagnoses ?? []) as Diagnosis[],
    }));
    setRows(regs);

    if (room?.kind === "pharmacy" && regs.length > 0) {
      const { data: rxData, error: rxError } = await supabase
        .from("prescriptions")
        .select("*")
        .in(
          "registration_id",
          regs.map((r) => r.id),
        )
        .order("created_at", { ascending: true });
      if (rxError) {
        toast.error(rxError.message);
        return;
      }
      const map = new Map<string, Prescription[]>();
      for (const rx of (rxData ?? []) as Prescription[]) {
        const arr = map.get(rx.registration_id) ?? [];
        arr.push(rx);
        map.set(rx.registration_id, arr);
      }
      setRxByReg(map);
    } else {
      setRxByReg(new Map());
    }
  }
  useEffect(() => {
    if (allowed && room) loadRequests();
  }, [allowed, room]);

  if (allowed === false)
    return (
      <AccessDenied message="You don't have access to this room. Ask an admin to grant access." />
    );
  if (!room) return <div className="text-sm text-muted-foreground">Loading room…</div>;

  const kind = room.kind;

  function startLab(reg: Reg) {
    if (reg.payment_status !== "paid" && reg.payment_status !== "waived") {
      toast.error("Patient has not been cleared by accounting.");
      return;
    }
    navigate({ to: "/records/new", search: { reg: reg.file_number ?? "" } as never });
  }

  function pharmacyPrescriber(rxs: Prescription[]): string {
    const names = Array.from(
      new Set(rxs.map((r) => r.prescribed_by_name).filter((n): n is string => !!n)),
    );
    return names.length > 0 ? names.join(", ") : "—";
  }
  function pharmacyLastDispenser(rxs: Prescription[]): string {
    const dispensed = rxs
      .filter((r) => r.dispensed_by_name)
      .sort((a, b) => (a.dispensed_at ?? "").localeCompare(b.dispensed_at ?? ""));
    return dispensed.length > 0 ? dispensed[dispensed.length - 1].dispensed_by_name! : "—";
  }
  function pharmacyStatus(rxs: Prescription[]): { label: string; cls: string } {
    if (rxs.length === 0)
      return { label: "No prescriptions", cls: "bg-muted text-muted-foreground" };
    if (rxs.some((r) => r.status === "pending"))
      return { label: "Pending", cls: "bg-amber-100 text-amber-700" };
    if (rxs.every((r) => r.status === "cancelled"))
      return { label: "Cancelled", cls: "bg-muted text-muted-foreground" };
    return { label: "Dispensed", cls: "bg-emerald-100 text-emerald-700" };
  }
  async function closeVisit(reg: Reg) {
    const rxs = rxByReg.get(reg.id) ?? [];
    if (rxs.some((r) => r.status === "pending")) {
      toast.error("Dispense or cancel all pending prescriptions first.");
      return;
    }
    const { error } = await supabase
      .from("patient_registrations")
      .update({ status: "done" } as never)
      .eq("id", reg.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Patient visit closed");
    loadRequests();
  }

  function actionLabel(): string {
    if (kind === "lab") return "Perform tests";
    if (kind === "radiology") return "Open Radiology";
    if (kind === "triage") return "Take vitals";
    if (kind === "consultation") return "Consult";
    if (kind === "pharmacy") return "Dispense";
    if (kind === "billing") return "Open in Accounting";
    if (
      kind === "general" &&
      (room?.name?.toLowerCase().includes("insurance") || room?.name?.toLowerCase().includes("sha"))
    )
      return "Process Claim";
    return "Request services";
  }

  if (kind === "ward") {
    return <WardRoomView room={room} navigate={navigate} />;
  }

  if (kind === "theatre") {
    return (
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center gap-3">
          <Scissors className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">{room.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Surgical theatre. Manage active cases and pre-op patients.
            </p>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
          Theatre workflow coming in next sprint.
        </div>
      </div>
    );
  }

  if (kind === "mortuary") {
    return (
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center gap-3">
          <Archive className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">{room.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Deceased storage and release management. Daily charges accrue automatically.
            </p>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
          Mortuary workflow coming in next sprint.
        </div>
      </div>
    );
  }

  if (kind === "mch") {
    return (
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold">
              <Baby className="h-7 w-7 text-primary" />
              {room.name}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Maternal and Child Health / Family Planning. MOH 642 and FP reports draw from this
              room.
            </p>
          </div>
          <Button variant="outline" onClick={loadRequests}>
            Refresh
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold">
            {kindIcon[kind]}
            {room.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{kindBlurb[kind]}</p>
        </div>
        <Button variant="outline" onClick={loadRequests}>
          Refresh
        </Button>
      </div>

      {kind === "pharmacy" ? (
        <div className="overflow-hidden rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Patient name</th>
                <th className="px-4 py-3">Prescriber</th>
                <th className="px-4 py-3">Drugs</th>
                <th className="px-4 py-3">Last dispenser</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    No active patients.
                  </td>
                </tr>
              )}
              {rows.map((r) => {
                const rxs = rxByReg.get(r.id) ?? [];
                const created = rxs.length > 0 ? rxs[0].created_at : r.created_at;
                const status = pharmacyStatus(rxs);
                const anyPending = rxs.some((x) => x.status === "pending");
                return (
                  <tr key={r.id} className="border-t">
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(created).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{r.patient_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.file_number ? `#${r.file_number}` : "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3">{pharmacyPrescriber(rxs)}</td>
                    <td className="px-4 py-3">
                      {rxs.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {rxs.map((rx) => (
                            <Badge key={rx.id} variant="secondary" className="text-xs">
                              {rx.drug_name}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">No prescriptions</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{pharmacyLastDispenser(rxs)}</td>
                    <td className="px-4 py-3">
                      <Badge className={`${status.cls} hover:${status.cls}`}>{status.label}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => setOpenReg(r)}>
                          <ClipboardPlus className="mr-1 h-3.5 w-3.5" />
                          Dispense
                        </Button>
                        <Button size="sm" disabled={anyPending} onClick={() => closeVisit(r)}>
                          Close visit
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div
          className={
            kind === "consultation" ? "space-y-3" : "overflow-hidden rounded-xl border bg-card"
          }
        >
          {kind !== "consultation" && (
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Patient</th>
                  <th className="px-4 py-3">From</th>
                  <th className="px-4 py-3">Requested</th>
                  <th className="px-4 py-3">Payment</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      Loading…
                    </td>
                  </tr>
                )}
                {!loading && rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                      No active patients.
                    </td>
                  </tr>
                )}
                {rows.map((r) => {
                  const cleared = r.payment_status === "paid" || r.payment_status === "waived";
                  const hasTests = (r.tests ?? []).length > 0;

                  return (
                    <tr key={r.id} className="border-t">
                      <td className="px-4 py-3">
                        <div className="font-medium">{r.patient_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {r.file_number ? `#${r.file_number}` : "—"}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {r.from_room ?? <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {hasTests ? (
                          <div className="flex flex-wrap gap-1">
                            {r.tests.map((t) => (
                              <Badge key={t.id} variant="secondary" className="text-xs">
                                {t.name}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            No services requested
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {cleared ? (
                          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                            {r.payment_status}
                          </Badge>
                        ) : (
                          <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100 flex w-fit items-center gap-1">
                            <ShieldAlert className="h-3 w-3" />
                            {r.payment_status}
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {kind === "lab" ? (
                          <Button size="sm" disabled={!cleared} onClick={() => startLab(r)}>
                            {actionLabel()} <ArrowRight className="ml-1 h-3.5 w-3.5" />
                          </Button>
                        ) : kind === "radiology" ? (
                          <Link
                            to="/radiology"
                            className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/5 px-3 py-1.5 text-sm text-primary hover:bg-primary/10"
                          >
                            <ArrowRight className="h-3.5 w-3.5" />
                            {actionLabel()}
                          </Link>
                        ) : kind === "billing" ? (
                          <Link
                            to="/accounting"
                            className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/5 px-3 py-1.5 text-sm text-primary hover:bg-primary/10"
                          >
                            <Receipt className="h-3.5 w-3.5" />
                            {actionLabel()}
                          </Link>
                        ) : (
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="outline" onClick={() => setOpenReg(r)}>
                              <ClipboardPlus className="mr-1 h-3.5 w-3.5" />
                              {actionLabel()}
                            </Button>
                            <Link
                              to="/queue"
                              className="text-xs text-primary underline self-center"
                            >
                              Queue
                            </Link>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {kind === "consultation" && (
            <>
              <ConsultationOverview
                rows={rows}
                roomName={room.name}
                roomId={id}
                filter={consultFilter}
                onFilter={setConsultFilter}
                onRefresh={loadRequests}
              />
              {rows
                .filter((r) => !consultFilter || consultPriority(r) === consultFilter)
                .map((r) => (
                  <ConsultationPatientCard key={r.id} reg={r} onOpen={() => setOpenReg(r)} />
                ))}
              {rows.length === 0 && (
                <div className="rounded-lg bg-muted/40 px-4 py-6 text-sm text-muted-foreground">
                  No patients awaiting service
                </div>
              )}
            </>
          )}
        </div>
      )}

      {openReg && kind === "triage" && (
        <TriageDialog
          reg={openReg}
          onClose={() => setOpenReg(null)}
          onSaved={() => {
            setOpenReg(null);
            loadRequests();
          }}
        />
      )}
      {openReg && kind === "consultation" && (
        <ConsultationDialog
          reg={openReg}
          roomId={id}
          onClose={() => setOpenReg(null)}
          onSaved={() => {
            setOpenReg(null);
            loadRequests();
          }}
        />
      )}
      {openReg && kind === "pharmacy" && (
        <PharmacyDialog
          reg={openReg}
          onClose={() => setOpenReg(null)}
          onSaved={() => {
            setOpenReg(null);
            loadRequests();
          }}
        />
      )}
      {openReg &&
        kind === "general" &&
        !room.name.toLowerCase().includes("insurance") &&
        !room.name.toLowerCase().includes("sha") && (
          <RequestServicesDialog
            reg={openReg}
            roomId={id}
            onClose={() => setOpenReg(null)}
            onSaved={() => {
              setOpenReg(null);
              loadRequests();
            }}
          />
        )}
      {openReg &&
        (kind === "insurance" ||
          (kind === "general" &&
            (room.name.toLowerCase().includes("insurance") ||
              room.name.toLowerCase().includes("sha")))) && (
          <InsuranceDialog
            reg={openReg}
            onClose={() => setOpenReg(null)}
            onSaved={() => {
              setOpenReg(null);
              loadRequests();
            }}
          />
        )}
    </div>
  );
}

/* ============================ TRIAGE ============================ */

function TriageDialog({
  reg,
  onClose,
  onSaved,
}: {
  reg: Reg;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [v, setV] = useState<Vitals>(reg.vitals ?? {});
  const [rooms, setRooms] = useState<{ id: string; name: string; kind: RoomKind }[]>([]);
  const [nextRoomId, setNextRoomId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("rooms")
      .select("id,name,kind")
      .eq("is_active", true)
      .order("name")
      .then(({ data }) => {
        const list = (data ?? []) as unknown as { id: string; name: string; kind: RoomKind }[];
        setRooms(list);
        const consult = list.find((r) => r.kind === "consultation");
        if (consult) setNextRoomId(consult.id);
      });
  }, []);

  const bmi = useMemo(() => {
    const h = Number(v.height_cm);
    const w = Number(v.weight_kg);
    if (!h || !w) return "";
    return +(w / Math.pow(h / 100, 2)).toFixed(1);
  }, [v.height_cm, v.weight_kg]);

  const alerts = useMemo(() => {
    const a: { severity: "critical" | "warning"; message: string }[] = [];
    const sys = Number(v.bp_systolic);
    const dia = Number(v.bp_diastolic);
    const temp = Number(v.temperature_c);
    const spo2 = Number(v.spo2);
    const pulse = Number(v.pulse_bpm);
    const pain = Number(v.pain_score);

    if (sys > 140) a.push({ severity: "critical", message: "Systolic BP elevated (>140 mmHg)" });
    if (dia > 90) a.push({ severity: "critical", message: "Diastolic BP elevated (>90 mmHg)" });
    if (temp > 38.5) a.push({ severity: "critical", message: "Fever detected (>38.5°C)" });
    if (spo2 > 0 && spo2 < 94)
      a.push({ severity: "critical", message: "Low oxygen saturation (<94%)" });
    if (pulse > 100) a.push({ severity: "warning", message: "Tachycardia (pulse >100 bpm)" });
    if (pulse > 0 && pulse < 60)
      a.push({ severity: "warning", message: "Bradycardia (pulse <60 bpm)" });
    if (pain > 7) a.push({ severity: "warning", message: "Severe pain reported (>7/10)" });

    return a;
  }, [v]);
  function set<K extends keyof Vitals>(k: K, val: Vitals[K]) {
    setV((p) => ({ ...p, [k]: val }));
  }

  async function save() {
    setSaving(true);
    const vitals = { ...v, bmi: bmi === "" ? undefined : bmi };
    const patch: { vitals: Vitals; current_room_id?: string } = { vitals };
    if (nextRoomId) patch.current_room_id = nextRoomId;
    const { error } = await supabase
      .from("patient_registrations")
      .update(patch as never)
      .eq("id", reg.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Vitals saved");
    onSaved();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Triage — {reg.patient_name}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-6 pr-1">
          <Section title="Basic vitals">
            <Grid>
              <Num label="Height (cm)" value={v.height_cm} onChange={(n) => set("height_cm", n)} />
              <Num label="Weight (kg)" value={v.weight_kg} onChange={(n) => set("weight_kg", n)} />
              <ReadOnly label="BMI (auto)" value={bmi === "" ? "" : String(bmi)} />
              <Num
                label="Temperature (°C)"
                step="0.1"
                value={v.temperature_c}
                onChange={(n) => set("temperature_c", n)}
              />
              <Num label="Pulse (bpm)" value={v.pulse_bpm} onChange={(n) => set("pulse_bpm", n)} />
              <Num
                label="Respiratory rate"
                value={v.resp_rate}
                onChange={(n) => set("resp_rate", n)}
              />
              <Num
                label="BP systolic"
                value={v.bp_systolic}
                onChange={(n) => set("bp_systolic", n)}
              />
              <Num
                label="BP diastolic"
                value={v.bp_diastolic}
                onChange={(n) => set("bp_diastolic", n)}
              />
              <Num label="SpO₂ (%)" value={v.spo2} onChange={(n) => set("spo2", n)} />
            </Grid>
          </Section>
          <Section title="Pediatric">
            <Grid>
              <Num
                label="Head circumference (cm)"
                value={v.head_circ_cm}
                onChange={(n) => set("head_circ_cm", n)}
              />
              <Num label="MUAC (cm)" value={v.muac_cm} onChange={(n) => set("muac_cm", n)} />
            </Grid>
            <div className="mt-2">
              <Label>Growth / percentile notes</Label>
              <Textarea
                rows={2}
                value={v.growth_notes ?? ""}
                onChange={(e) => set("growth_notes", e.target.value)}
              />
            </div>
          </Section>
          <Section title="Pain & general">
            <Grid>
              <Num
                label="Pain score (0–10)"
                min={0}
                max={10}
                value={v.pain_score}
                onChange={(n) => set("pain_score", n)}
              />
            </Grid>
            <div className="mt-2">
              <Label>General appearance</Label>
              <Textarea
                rows={2}
                value={v.general_appearance ?? ""}
                onChange={(e) => set("general_appearance", e.target.value)}
              />
            </div>
          </Section>
          {alerts.length > 0 && (
            <Section title="⚠️ Clinical Alerts">
              <div className="space-y-2">
                {alerts.map((alert, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-2 rounded-md border p-3 ${
                      alert.severity === "critical"
                        ? "border-red-600 bg-red-50 text-red-900"
                        : "border-amber-600 bg-amber-50 text-amber-900"
                    }`}
                  >
                    <span className="text-lg">{alert.severity === "critical" ? "🔴" : "⚠️"}</span>
                    <div className="flex-1 text-sm font-medium">{alert.message}</div>
                  </div>
                ))}
              </div>
            </Section>
          )}
          <Section title="Send to">
            <Select value={nextRoomId} onValueChange={setNextRoomId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose next room" />
              </SelectTrigger>
              <SelectContent>
                {rooms.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name} <span className="text-xs text-muted-foreground">({r.kind})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Section>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            Save & send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ========================= CONSULTATION ========================= */

function ConsultationDialog({
  reg,
  roomId,
  onClose,
  onSaved,
}: {
  reg: Reg;
  roomId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user, hasPerm } = useAuth();
  const canAdmit = hasPerm("admit_patient");
  // ── CHANGE 1: added "results" to the tab union type ──
  const [tab, setTab] = useState<"history" | "diagnosis" | "prescription" | "requests" | "results">(
    "history",
  );
  const [h, setH] = useState<History>(reg.history ?? {});
  const [dxs, setDxs] = useState<Diagnosis[]>(reg.diagnoses ?? []);
  const [rxs, setRxs] = useState<Prescription[]>([]);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [admitOpen, setAdmitOpen] = useState(false);
  const [admission, setAdmission] = useState<{
    id: string;
    encounter_id: string | null;
    ward_name: string | null;
    bed_number: string | null;
  } | null>(null);

  async function loadAdmission() {
    const { data } = await supabase
      .from("admissions")
      .select("id,encounter_id,wards(name),beds(bed_number)")
      .eq("encounter_id", reg.id)
      .eq("status", "admitted")
      .maybeSingle();
    if (data) {
      const d = data as unknown as {
        id: string;
        encounter_id: string | null;
        wards: { name: string } | null;
        beds: { bed_number: string } | null;
      };
      setAdmission({
        id: d.id,
        encounter_id: d.encounter_id,
        ward_name: d.wards?.name ?? null,
        bed_number: d.beds?.bed_number ?? null,
      });
    } else setAdmission(null);
  }

  useEffect(() => {
    supabase
      .from("prescriptions")
      .select("*")
      .eq("registration_id", reg.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setRxs((data ?? []) as Prescription[]));
    supabase
      .from("stock_items")
      .select("id,name,kind,current_quantity,strength,strength_unit")
      .eq("kind", "pharmaceutical")
      .order("name")
      .then(({ data }) => setStock((data ?? []) as unknown as StockItem[]));
    loadAdmission();
  }, [reg.id]);

  function setHK<K extends keyof History>(k: K, v: History[K]) {
    setH((p) => ({ ...p, [k]: v }));
  }

  async function saveNotes() {
    setSaving(true);

    const { error } = await supabase
      .from("patient_registrations")
      .update({
        history: h,
        diagnoses: dxs,
      } as never)
      .eq("id", reg.id);

    if (error) {
      setSaving(false);
      toast.error(error.message);
      return;
    }

    // Write IDSR indicator tags for any flagged diagnoses (idempotent)
    const idsrDxs = dxs.filter((d) => d.idsr_indicator_code);
    if (idsrDxs.length > 0) {
      // Remove existing IDSR tags for this encounter before re-inserting
      await supabase
        .from("encounter_indicator_tags")
        .delete()
        .eq("encounter_id", reg.id)
        .like("indicator_code", "IDSR_%");

      const tags = idsrDxs.map((d) => ({
        encounter_id: reg.id,
        indicator_code: d.idsr_indicator_code!,
        tagged_by: user?.email ?? "unknown",
        tagged_at: new Date().toISOString(),
      }));

      const { error: tagError } = await supabase
        .from("encounter_indicator_tags")
        .insert(tags as never);

      if (tagError) {
        setSaving(false);
        toast.error("Consultation saved but IDSR tag failed: " + tagError.message);
        return;
      }
    }

    setSaving(false);
    toast.success("Consultation saved");
  }

  async function addRx(
    rx: Omit<
      Prescription,
      | "id"
      | "registration_id"
      | "status"
      | "created_at"
      | "dispensed_at"
      | "prescribed_by_name"
      | "dispensed_by_name"
    >,
  ) {
    const { data, error } = await supabase
      .from("prescriptions")
      .insert({
        registration_id: reg.id,
        ...rx,
        created_by: user?.id,
        prescribed_by_name: user?.email ?? null,
      })
      .select("*")
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    setRxs((p) => [data as Prescription, ...p]);
    toast.success("Prescription added — patient routed to pharmacy");
  }

  async function cancelRx(id: string) {
    const { error } = await supabase
      .from("prescriptions")
      .update({ status: "cancelled" })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setRxs((p) => p.map((r) => (r.id === id ? { ...r, status: "cancelled" } : r)));
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
                Admitted{admission.ward_name ? ` · ${admission.ward_name}` : ""}
                {admission.bed_number ? ` bed ${admission.bed_number}` : ""}
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
                onDone={() => {
                  loadAdmission();
                  onSaved();
                }}
              />
            )}
            <ReferOutButton encounterId={reg.id} onDone={() => onSaved()} />
          </div>
        )}

        {admitOpen && (
          <ConsultationAdmitDialog
            reg={reg}
            onClose={() => setAdmitOpen(false)}
            onAdmitted={() => {
              setAdmitOpen(false);
              loadAdmission();
            }}
          />
        )}

        <div className="rounded-lg border bg-muted/30 p-2 text-xs grid grid-cols-2 md:grid-cols-4 gap-2">
          <VitalPill
            k="BP"
            v={v.bp_systolic && v.bp_diastolic ? `${v.bp_systolic}/${v.bp_diastolic}` : "—"}
          />
          <VitalPill k="Pulse" v={v.pulse_bpm ? `${v.pulse_bpm} bpm` : "—"} />
          <VitalPill k="Temp" v={v.temperature_c ? `${v.temperature_c} °C` : "—"} />
          <VitalPill k="SpO₂" v={v.spo2 ? `${v.spo2}%` : "—"} />
          <VitalPill k="Weight" v={v.weight_kg ? `${v.weight_kg} kg` : "—"} />
          <VitalPill k="Height" v={v.height_cm ? `${v.height_cm} cm` : "—"} />
          <VitalPill k="BMI" v={v.bmi ? String(v.bmi) : "—"} />
          <VitalPill
            k="Pain"
            v={v.pain_score !== undefined && v.pain_score !== "" ? `${v.pain_score}/10` : "—"}
          />
        </div>

        {/* ── CHANGE 2 & 3: added "results" tab to the array and its label ── */}
        <div className="mt-2 flex gap-1 border-b">
          {(["history", "diagnosis", "prescription", "requests", "results"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-2 text-sm capitalize border-b-2 -mb-px ${tab === t ? "border-primary text-primary font-medium" : "border-transparent text-muted-foreground"}`}
            >
              {t === "requests"
                ? "Requests (Lab / Radiology / Ward / Theater)"
                : t === "results"
                  ? "Results"
                  : t}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto pt-3 pr-1 space-y-4">
          {tab === "history" && (
            <>
              <Section title="Presenting complaint & HPI">
                <TextField
                  label="Chief complaint"
                  value={h.presenting_complaint}
                  onChange={(v) => setHK("presenting_complaint", v)}
                />
                <TextArea
                  label="History of present illness"
                  value={h.hpi}
                  onChange={(v) => setHK("hpi", v)}
                />
              </Section>
              <Section title="Past medical / surgical">
                <TextArea
                  label="Past medical"
                  value={h.past_medical}
                  onChange={(v) => setHK("past_medical", v)}
                />
                <TextArea
                  label="Past surgical"
                  value={h.past_surgical}
                  onChange={(v) => setHK("past_surgical", v)}
                />
                <TextField
                  label="Allergies"
                  value={h.allergies}
                  onChange={(v) => setHK("allergies", v)}
                />
                <TextField
                  label="Current medications"
                  value={h.current_meds}
                  onChange={(v) => setHK("current_meds", v)}
                />
              </Section>
              <Section title="Social & family">
                <TextField
                  label="Smoking"
                  value={h.smoking}
                  onChange={(v) => setHK("smoking", v)}
                />
                <TextField
                  label="Alcohol"
                  value={h.alcohol}
                  onChange={(v) => setHK("alcohol", v)}
                />
                <TextField
                  label="Occupational exposure"
                  value={h.occupation_exposure}
                  onChange={(v) => setHK("occupation_exposure", v)}
                />
                <TextArea
                  label="Family history"
                  value={h.family_history}
                  onChange={(v) => setHK("family_history", v)}
                />
              </Section>
              <Section title="Review of systems">
                <TextArea label="ROS" value={h.ros} onChange={(v) => setHK("ros", v)} />
              </Section>
            </>
          )}

          {tab === "diagnosis" && <DiagnosisEditor dxs={dxs} setDxs={setDxs} />}

          {tab === "prescription" && (
            <PrescriptionEditor
              rxs={rxs}
              stock={stock}
              onAdd={addRx}
              onCancel={cancelRx}
              allergies={(reg.history as { allergies?: string })?.allergies ?? ""}
            />
          )}

          {tab === "requests" && (
            <RequestServicesInline reg={reg} roomId={roomId} onSaved={onSaved} />
          )}

          {/* ── CHANGE 4: results tab panel ── */}
          {tab === "results" && <EncounterResultsTab encounterId={reg.id} />}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={finishAndSend} disabled={saving}>
            Save consultation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DiagnosisEditor({ dxs, setDxs }: { dxs: Diagnosis[]; setDxs: (d: Diagnosis[]) => void }) {
  const [code, setCode] = useState("");
  const [desc, setDesc] = useState("");
  const [notes, setNotes] = useState("");
  const [suggestions, setSuggestions] = useState<
    { code: string; title: string; uri: string | null }[]
  >([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searching, setSearching] = useState(false);
  const [idsr, setIdsr] = useState<string>("");

  // Debounced search: local icd11_codes cache first, WHO live API as fallback
  useEffect(() => {
    const q = desc.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const { data: local } = await supabase
          .from("icd11_codes")
          .select("code,title,uri")
          .or(`title.ilike.%${q}%,code.ilike.${q}%`)
          .limit(10);

        const results = (local ?? []) as { code: string; title: string; uri: string | null }[];

        if (results.length < 5) {
          const { data: liveData, error: liveError } = await supabase.functions.invoke(
            "icd11-search",
            {
              body: { query: q },
            },
          );
          if (!liveError && liveData?.results) {
            const seen = new Set(results.map((r) => r.code));
            for (const r of liveData.results as {
              code: string;
              title: string;
              uri: string | null;
            }[]) {
              if (!seen.has(r.code)) {
                results.push(r);
                seen.add(r.code);
              }
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
    supabase
      .from("icd11_codes")
      .upsert(
        {
          code: s.code,
          title: s.title,
          uri: s.uri,
          validated_at: new Date().toISOString(),
        } as never,
        { onConflict: "code" },
      )
      .then(() => {});
  }

  function add() {
    if (!code.trim() && !desc.trim()) {
      toast.error("Enter an ICD-11 code or description");
      return;
    }
    setDxs([
      ...dxs,
      {
        icd11_code: code.trim(),
        description: desc.trim(),
        notes: notes.trim() || undefined,
        idsr_indicator_code: idsr || undefined,
      },
    ]);
    setCode("");
    setDesc("");
    setNotes("");
    setIdsr("");
    setSuggestions([]);
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border p-3 space-y-2">
        <div className="grid gap-2 md:grid-cols-3">
          <div>
            <Label>ICD-11 code</Label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. CA22.0"
            />
          </div>
          <div className="md:col-span-2 relative">
            <Label>Diagnosis</Label>
            <Input
              value={desc}
              onChange={(e) => {
                setDesc(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => {
                if (suggestions.length > 0) setShowSuggestions(true);
              }}
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
        <div>
          <Label>Notes</Label>
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div>
          <Label className="flex items-center gap-1.5">
            IDSR Reportable Condition
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              MOH 505
            </span>
          </Label>
          <select
            value={idsr}
            onChange={(e) => setIdsr(e.target.value)}
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">— Not a reportable condition —</option>
            <option value="IDSR_MEASLES">Measles (suspected)</option>
            <option value="IDSR_CHOLERA">Acute Watery Diarrhoea / Cholera</option>
            <option value="IDSR_AFP">Acute Flaccid Paralysis</option>
            <option value="IDSR_NEONATAL_TETANUS">Neonatal Tetanus</option>
            <option value="IDSR_BLOODY_DIARRHOEA">Bloody Diarrhoea (Dysentery)</option>
            <option value="IDSR_MENINGITIS">Meningitis (suspected)</option>
            <option value="IDSR_VHF">Viral Haemorrhagic Fever (suspected)</option>
            <option value="IDSR_PLAGUE">Plague (suspected)</option>
            <option value="IDSR_RABIES">Animal Bites / Suspected Rabies</option>
            <option value="IDSR_MALARIA">Malaria (confirmed)</option>
            <option value="IDSR_TYPHOID">Typhoid Fever</option>
            <option value="IDSR_SARI">Severe Acute Respiratory Infection</option>
          </select>
          {idsr && (
            <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
              ⚠ This diagnosis will be flagged in the IDSR weekly report (MOH 505).
            </p>
          )}
        </div>
        <div className="flex justify-end">
          <Button size="sm" onClick={add}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add diagnosis
          </Button>
        </div>
      </div>
      {dxs.length === 0 && <p className="text-sm text-muted-foreground">No diagnoses added.</p>}
      {dxs.map((d, i) => (
        <div key={i} className="flex items-start justify-between rounded-lg border p-3">
          <div>
            <div className="text-sm font-medium">
              {d.icd11_code || <span className="text-muted-foreground">no code</span>} —{" "}
              {d.description}
            </div>
            {d.notes && <div className="text-xs text-muted-foreground mt-0.5">{d.notes}</div>}
          </div>
          <Button variant="ghost" size="icon" onClick={() => setDxs(dxs.filter((_, x) => x !== i))}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ))}
    </div>
  );
}

const FREQUENCIES: { value: string; label: string }[] = [
  { value: "STAT", label: "STAT - Immediately (×1 total)" },
  { value: "OD", label: "OD - Once daily (×1/day)" },
  { value: "BD", label: "BD - Twice daily (×2/day)" },
  { value: "TDS", label: "TDS - Three times daily (×3/day)" },
  { value: "QID", label: "QID - Four times daily (×4/day)" },
  { value: "QHS", label: "QHS - At bedtime (×1/day)" },
  { value: "PRN", label: "PRN - As needed (manual quantity)" },
];

const FREQUENCY_MAP: Record<string, number> = {
  STAT: 0,
  OD: 1,
  BD: 2,
  TDS: 3,
  QID: 4,
  QHS: 1,
  PRN: 0,
};

const DURATIONS: number[] = [1, 2, 3, 4, 5, 6, 7, 10, 14, 21, 28, 30];

function calcQuantity(unitsPerDose: number, freq: string, durationDays: number): number | null {
  if (freq === "PRN") return null;
  if (freq === "STAT") return unitsPerDose;
  const timesPerDay = FREQUENCY_MAP[freq] ?? 0;
  if (!timesPerDay || !durationDays) return null;
  return unitsPerDose * timesPerDay * durationDays;
}

function PrescriptionEditor({
  rxs,
  stock,
  onAdd,
  onCancel,
  allergies,
}: {
  rxs: Prescription[];
  stock: StockItem[];
  allergies?: string;
  onAdd: (
    rx: Omit<
      Prescription,
      | "id"
      | "registration_id"
      | "status"
      | "created_at"
      | "dispensed_at"
      | "prescribed_by_name"
      | "dispensed_by_name"
    >,
  ) => void | Promise<void>;
  onCancel: (id: string) => void;
}) {
  const [stockId, setStockId] = useState<string>("");
  const [drugName, setDrugName] = useState("");
  const [customDose, setCustomDose] = useState("");
  const [unitsPerDose, setUnitsPerDose] = useState<number>(1);
  const [freq, setFreq] = useState("TDS");
  const [durationDays, setDurationDays] = useState<number>(5);
  const [qty, setQty] = useState<number>(1);
  const [qtyTouched, setQtyTouched] = useState(false);
  const [notes, setNotes] = useState("");

  const stockItem = stock.find((x) => x.id === stockId) ?? null;
  const hasStrength = !!(stockItem && stockItem.strength);
  const unitWord = stockItem?.strength_unit === "ml" ? "ml" : "tablet(s)";
  const autoQty = hasStrength ? calcQuantity(unitsPerDose, freq, durationDays) : null;

  useEffect(() => {
    if (autoQty != null && !qtyTouched) setQty(autoQty);
  }, [autoQty, qtyTouched]);

  function selectStock(id: string) {
    setStockId(id);
    const s = stock.find((x) => x.id === id);
    if (s && !drugName) setDrugName(s.name);
  }

  const freqLabel = FREQUENCIES.find((f) => f.value === freq)?.label ?? freq;
  const durationStr = `${durationDays} day${durationDays === 1 ? "" : "s"}`;
  const dosageStr = hasStrength
    ? `${unitsPerDose} ${unitWord} (${unitsPerDose * (stockItem!.strength ?? 0)}${stockItem!.strength_unit ?? ""})`
    : customDose;

  async function add() {
    if (!drugName.trim()) {
      toast.error("Drug name is required");
      return;
    }
    if (allergies) {
      const words = drugName.toLowerCase().split(/\s+/);
      const match = words.some((w) => allergies.toLowerCase().includes(w));
      if (match) {
        const ok = window.confirm(
          `⚠️ Allergy warning: "${drugName}" may match a known allergy (${allergies}).\n\nPrescribe anyway?`,
        );
        if (!ok) return;
      }
    }
    await onAdd({
      stock_item_id: stockId || null,
      drug_name: drugName.trim(),
      dosage: dosageStr || null,
      frequency: freqLabel || null,
      duration: freq === "STAT" ? "Single dose" : durationStr,
      quantity: Number(qty) || 1,
      notes: notes || null,
    });
    setStockId("");
    setDrugName("");
    setCustomDose("");
    setUnitsPerDose(1);
    setFreq("TDS");
    setDurationDays(5);
    setQty(1);
    setQtyTouched(false);
    setNotes("");
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border p-3 space-y-2">
        <div className="grid gap-2 md:grid-cols-2">
          <div>
            <Label>Pharmacy stock (optional)</Label>
            <Select value={stockId} onValueChange={selectStock}>
              <SelectTrigger>
                <SelectValue placeholder="Select drug from stock" />
              </SelectTrigger>
              <SelectContent>
                {stock.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                    {s.strength ? ` ${s.strength}${s.strength_unit ?? ""}` : ""}{" "}
                    <span className="text-xs text-muted-foreground">
                      ({s.current_quantity ?? 0})
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Drug name</Label>
            <Input value={drugName} onChange={(e) => setDrugName(e.target.value)} />
          </div>

          {hasStrength ? (
            <div>
              <Label>Units per dose</Label>
              <Input
                type="number"
                min={0.5}
                step="0.5"
                value={unitsPerDose}
                onChange={(e) => {
                  setUnitsPerDose(Number(e.target.value));
                  setQtyTouched(false);
                }}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                = {unitsPerDose * (stockItem!.strength ?? 0)}
                {stockItem!.strength_unit ?? ""} per dose
              </p>
            </div>
          ) : (
            <div>
              <Label>Dose</Label>
              <Input
                value={customDose}
                onChange={(e) => setCustomDose(e.target.value)}
                placeholder="500 mg"
              />
            </div>
          )}

          <div>
            <Label>Frequency</Label>
            <Select
              value={freq}
              onValueChange={(v) => {
                setFreq(v);
                setQtyTouched(false);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FREQUENCIES.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Duration</Label>
            <Select
              value={String(durationDays)}
              onValueChange={(v) => {
                setDurationDays(Number(v));
                setQtyTouched(false);
              }}
              disabled={freq === "STAT"}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DURATIONS.map((d) => (
                  <SelectItem key={d} value={String(d)}>
                    {d} day{d === 1 ? "" : "s"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Quantity {autoQty != null ? "(auto-calculated)" : ""}</Label>
            <Input
              type="number"
              min={1}
              value={qty}
              onChange={(e) => {
                setQty(Number(e.target.value));
                setQtyTouched(true);
              }}
            />
            {autoQty != null && (
              <p className="mt-1 text-xs text-muted-foreground">
                ℹ {unitsPerDose} {unitWord}
                {freq === "STAT"
                  ? " once"
                  : ` × ${FREQUENCY_MAP[freq]}×/day × ${durationDays} days`}{" "}
                = {autoQty}
              </p>
            )}
            {freq === "PRN" && (
              <p className="mt-1 text-xs text-muted-foreground">
                As needed — enter quantity manually.
              </p>
            )}
          </div>
        </div>
        <div>
          <Label>Notes</Label>
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="flex justify-end">
          <Button size="sm" onClick={add}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add prescription
          </Button>
        </div>
      </div>

      {rxs.length === 0 && <p className="text-sm text-muted-foreground">No prescriptions yet.</p>}
      {rxs.map((rx) => (
        <div key={rx.id} className="flex items-start justify-between rounded-lg border p-3">
          <div>
            <div className="text-sm font-medium">
              {rx.drug_name} <span className="text-xs text-muted-foreground">×{rx.quantity}</span>
            </div>
            <div className="text-xs text-muted-foreground">
              {[rx.dosage, rx.frequency, rx.duration].filter(Boolean).join(" · ") || "—"}
            </div>
            {rx.notes && <div className="text-xs mt-0.5">{rx.notes}</div>}
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant={
                rx.status === "pending"
                  ? "secondary"
                  : rx.status === "dispensed"
                    ? "default"
                    : "outline"
              }
            >
              {rx.status}
            </Badge>
            {rx.status === "pending" && (
              <Button variant="ghost" size="icon" onClick={() => onCancel(rx.id)}>
                <X className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ============================ PHARMACY ============================ */

function PharmacyDialog({
  reg,
  onClose,
  onSaved,
}: {
  reg: Reg;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [rxs, setRxs] = useState<Prescription[]>([]);
  const [stockMap, setStockMap] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);

  async function load() {
    setLoading(true);
    const [rxRes, stockRes] = await Promise.all([
      supabase
        .from("prescriptions")
        .select("*")
        .eq("registration_id", reg.id)
        .order("created_at", { ascending: true }),
      supabase.from("stock_items").select("id,current_quantity").eq("kind", "pharmaceutical"),
    ]);
    setLoading(false);
    setRxs((rxRes.data ?? []) as Prescription[]);
    const sm = new Map<string, number>();
    (stockRes.data ?? []).forEach((s) => {
      sm.set(s.id, Number(s.current_quantity ?? 0));
    });
    setStockMap(sm);
  }

  useEffect(() => {
    load();
  }, [reg.id]);

  async function dispense(rx: Prescription) {
    const available = rx.stock_item_id ? (stockMap.get(rx.stock_item_id) ?? 0) : Infinity;
    if (rx.stock_item_id && available < Number(rx.quantity)) {
      const ok = window.confirm(
        `Warning: Only ${available} units of ${rx.drug_name} in stock but ${rx.quantity} requested. Dispense anyway?`,
      );
      if (!ok) return;
    }
    const { error } = await supabase
      .from("prescriptions")
      .update({
        status: "dispensed",
        dispensed_by: user?.id,
        dispensed_by_name: user?.email ?? null,
        dispensed_at: new Date().toISOString(),
      })
      .eq("id", rx.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Dispensed ${rx.drug_name}`);
    load();
  }

  async function cancel(rx: Prescription) {
    const { error } = await supabase
      .from("prescriptions")
      .update({ status: "cancelled" })
      .eq("id", rx.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    load();
  }

  async function finish() {
    const anyPending = rxs.some((r) => r.status === "pending");
    if (anyPending) {
      toast.error("Dispense or cancel all pending prescriptions first.");
      return;
    }
    const { error } = await supabase
      .from("patient_registrations")
      .update({ status: "done" } as never)
      .eq("id", reg.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Patient visit closed");
    onSaved();
  }

  const allergies = (reg.history as { allergies?: string })?.allergies ?? "";

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pill className="h-5 w-5 text-primary" /> Pharmacy — {reg.patient_name}
          </DialogTitle>
        </DialogHeader>

        {/* Allergy banner */}
        {allergies && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 flex items-center gap-2">
            <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
            <span>
              <span className="font-semibold">Known allergies:</span> {allergies}
            </span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!loading && rxs.length === 0 && (
            <p className="text-sm text-muted-foreground">No prescriptions for this patient.</p>
          )}
          {rxs.map((rx) => {
            const available = rx.stock_item_id ? (stockMap.get(rx.stock_item_id) ?? null) : null;
            const stockLow = available !== null && available < Number(rx.quantity);
            const allergyMatch =
              allergies &&
              rx.drug_name
                .toLowerCase()
                .split(/\s+/)
                .some((w) => allergies.toLowerCase().includes(w));
            return (
              <div
                key={rx.id}
                className={`rounded-xl border p-4 space-y-2 ${
                  allergyMatch ? "border-rose-300 bg-rose-50/50" : "bg-card"
                }`}
              >
                {/* Drug header */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-sm">
                      {rx.drug_name}
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        ×{rx.quantity}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {[rx.dosage, rx.frequency, rx.duration].filter(Boolean).join(" · ") || "—"}
                    </div>
                    {rx.notes && (
                      <div className="text-xs text-muted-foreground mt-0.5 italic">{rx.notes}</div>
                    )}
                  </div>
                  <Badge
                    variant={
                      rx.status === "pending"
                        ? "secondary"
                        : rx.status === "dispensed"
                          ? "default"
                          : "outline"
                    }
                  >
                    {rx.status}
                  </Badge>
                </div>

                {/* Allergy warning */}
                {allergyMatch && (
                  <div className="flex items-center gap-1 text-xs text-rose-600 font-medium">
                    <ShieldAlert className="h-3 w-3" />
                    Possible allergy match — verify with prescriber
                  </div>
                )}

                {/* Stock warning */}
                {stockLow && rx.status === "pending" && (
                  <div className="flex items-center gap-1 text-xs text-amber-600 font-medium">
                    <ShieldAlert className="h-3 w-3" />
                    Only {available} in stock — {rx.quantity} requested
                  </div>
                )}

                {/* Prescriber / dispenser info */}
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground border-t pt-2">
                  <div>
                    <div className="font-medium text-foreground">Prescribed by</div>
                    <div>{rx.prescribed_by_name ?? "—"}</div>
                    <div>
                      {rx.created_at ? format(new Date(rx.created_at), "dd MMM, HH:mm") : "—"}
                    </div>
                  </div>
                  {rx.status === "dispensed" && (
                    <div>
                      <div className="font-medium text-foreground">Dispensed by</div>
                      <div>{rx.dispensed_by_name ?? "—"}</div>
                      <div>
                        {rx.dispensed_at ? format(new Date(rx.dispensed_at), "dd MMM, HH:mm") : "—"}
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                {rx.status === "pending" && (
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" onClick={() => dispense(rx)}>
                      <Check className="h-4 w-4 mr-1" /> Dispense
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => cancel(rx)}>
                      <X className="h-4 w-4 text-destructive" /> Cancel
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <DialogFooter className="flex-wrap gap-2">
          {/* Print slip */}
          {rxs.length > 0 && (
            <Button
              variant="outline"
              onClick={() => {
                setPrinting(true);
                setTimeout(() => {
                  window.print();
                  setPrinting(false);
                }, 100);
              }}
              disabled={printing}
            >
              <Printer className="mr-2 h-4 w-4" />
              Print prescription slip
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button onClick={finish}>Close visit</Button>
        </DialogFooter>
      </DialogContent>

      {/* Print-only prescription slip */}
      <div className="hidden print:block fixed inset-0 bg-white p-8 z-50">
        <PrescriptionPrintSlip reg={reg} rxs={rxs} />
      </div>
    </Dialog>
  );
}

/* ======================== SHA / INSURANCE DESK ======================== */

function InsuranceDialog({
  reg,
  onClose,
  onSaved,
}: {
  reg: Reg;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [shaMemberNumber, setShaMemberNumber] = useState(reg.sha_member_number ?? "");
  const [shaRelationship, setShaRelationship] = useState(reg.sha_relationship_to_principal ?? "");
  const [shaNotificationNumber, setShaNotificationNumber] = useState(
    reg.sha_notification_number ?? "",
  );
  const [preauthNumber, setPreauthNumber] = useState(reg.preauth_number ?? "");
  const [claimNumber, setClaimNumber] = useState(reg.claim_number ?? "");
  const [claimStatus, setClaimStatus] = useState(reg.claim_status ?? "pending");
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fhirPayload, setFhirPayload] = useState<Record<string, unknown> | null>(null);
  const [fhirLoading, setFhirLoading] = useState(false);
  const [fhirOpen, setFhirOpen] = useState(false);

  const isSha = reg.insurer_type === "sha_shif" || reg.payment_mode === "insurance";

  // Pre-authorization enforcement — SHA requires preauth for major procedures
  const PREAUTH_KEYWORDS = [
    { keyword: "surgery", label: "Surgery" },
    { keyword: "theater", label: "Theater / Surgery" },
    { keyword: "theatre", label: "Theater / Surgery" },
    { keyword: "icu", label: "ICU / Intensive Care" },
    { keyword: "intensive care", label: "ICU / Intensive Care" },
    { keyword: "dialysis", label: "Dialysis" },
    { keyword: "specialist", label: "Specialist Referral" },
    { keyword: "ct scan", label: "CT Scan" },
    { keyword: "mri", label: "MRI" },
    { keyword: "ct/mri", label: "CT / MRI" },
  ];

  const tests = (reg.tests ?? []) as { name?: string; id?: string }[];

  const preauthProcedures: string[] = [];
  for (const test of tests) {
    const name = (test.name ?? "").toLowerCase();
    for (const { keyword, label } of PREAUTH_KEYWORDS) {
      if (name.includes(keyword) && !preauthProcedures.includes(label)) {
        preauthProcedures.push(label);
      }
    }
  }

  const requiresPreauth = preauthProcedures.length > 0;
  const preauthMissing = requiresPreauth && !preauthNumber.trim();

  async function previewFhir() {
    setFhirLoading(true);
    setFhirOpen(true);
    setFhirPayload(null);
    const { data, error } = await supabase.rpc(
      "generate_fhir_encounter" as never,
      { p_encounter_id: reg.id } as never,
    );
    setFhirLoading(false);
    if (error) {
      toast.error(error.message);
      setFhirOpen(false);
      return;
    }
    setFhirPayload(data as Record<string, unknown>);
  }

  async function save() {
    setSaving(true);

    if (reg.patient_id) {
      await supabase
        .from("patients")
        .update({
          sha_member_number: shaMemberNumber.trim() || null,
          sha_relationship_to_principal: shaRelationship || null,
        } as never)
        .eq("id", reg.patient_id);
    }

    // Update encounter claim fields (must update encounters directly — patient_registrations is a view)
    const { error } = await supabase
      .from("encounters")
      .update({
        sha_notification_number: shaNotificationNumber.trim() || null,
        preauth_number: preauthNumber.trim() || null,
        claim_number: claimNumber.trim() || null,
        claim_status: claimStatus || null,
      } as never)
      .eq("id", reg.id);

    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Claim details saved");
    onSaved();
  }

  async function submitClaim() {
    if (!shaNotificationNumber.trim() && isSha) {
      toast.error("SHA notification number is required before submitting");
      return;
    }
    setSubmitting(true);

    // Generate FHIR payload to include in queue
    let fhirEncounter: Record<string, unknown> | null = null;
    const { data: fhirData } = await supabase.rpc(
      "generate_fhir_encounter" as never,
      { p_encounter_id: reg.id } as never,
    );
    if (fhirData) fhirEncounter = fhirData as Record<string, unknown>;

    const { error } = await supabase.from("dha_outbound_queue" as never).insert({
      encounter_id: reg.id,
      patient_id: reg.patient_id,
      queue_type: reg.insurer_type === "sha_shif" ? "sha_claim" : "private_claim",
      insurer_type: reg.insurer_type,
      payload: {
        sha_member_number: shaMemberNumber,
        sha_notification_number: shaNotificationNumber,
        preauth_number: preauthNumber,
        claim_number: claimNumber,
        patient_name: reg.patient_name,
        file_number: reg.file_number,
        submitted_from: "insurance_desk",
        fhir_encounter: fhirEncounter,
      },
      status: "pending",
      attempts: 0,
    } as never);

    if (error) {
      toast.error(error.message);
      setSubmitting(false);
      return;
    }

    // Update claim status on encounter
    await supabase
      .from("encounters")
      .update({ claim_status: "submitted", claim_submitted_at: new Date().toISOString() } as never)
      .eq("id", reg.id);

    setClaimStatus("submitted");
    setSubmitting(false);
    toast.success("Claim submitted to queue — awaiting Phase 3 API activation");
    onSaved();
  }

  return (
    <>
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>SHA / Insurance Desk — {reg.patient_name}</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-6 pr-1">
            <div className="rounded-lg bg-muted/30 border p-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs uppercase text-muted-foreground">File #</div>
                <div className="font-medium">{reg.file_number ?? "—"}</div>
              </div>
              <div>
                <div className="text-xs uppercase text-muted-foreground">Payment mode</div>
                <div className="font-medium capitalize">{reg.payment_mode}</div>
              </div>
              <div>
                <div className="text-xs uppercase text-muted-foreground">Claim status</div>
                <div
                  className={`font-medium capitalize ${
                    claimStatus === "approved"
                      ? "text-emerald-600"
                      : claimStatus === "rejected"
                        ? "text-red-600"
                        : claimStatus === "submitted"
                          ? "text-blue-600"
                          : "text-amber-600"
                  }`}
                >
                  {claimStatus ?? "—"}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase text-muted-foreground">Payment status</div>
                <div className="font-medium capitalize">{reg.payment_status}</div>
              </div>
            </div>

            {isSha && (
              <Section title="SHA Member Details">
                <Grid>
                  <div>
                    <Label>SHA Member Number</Label>
                    <Input
                      value={shaMemberNumber}
                      onChange={(e) => setShaMemberNumber(e.target.value)}
                      placeholder="e.g. SHA/M/123456"
                    />
                  </div>
                  <div>
                    <Label>Relationship to Principal</Label>
                    <Select value={shaRelationship} onValueChange={setShaRelationship}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select relationship" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="self">Self (Principal)</SelectItem>
                        <SelectItem value="spouse">Spouse</SelectItem>
                        <SelectItem value="child">Child</SelectItem>
                        <SelectItem value="other_dependent">Other Dependent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>SHA Notification Number</Label>
                    <Input
                      value={shaNotificationNumber}
                      onChange={(e) => setShaNotificationNumber(e.target.value)}
                      placeholder="e.g. SHA/N/2026/001234"
                    />
                  </div>
                  <div>
                    <Label>Pre-authorization Number</Label>
                    <Input
                      value={preauthNumber}
                      onChange={(e) => setPreauthNumber(e.target.value)}
                      placeholder="e.g. PA/2026/001234"
                    />
                  </div>
                </Grid>
              </Section>
            )}

            <Section title="Claim Details">
              <Grid>
                <div>
                  <Label>Claim Number</Label>
                  <Input
                    value={claimNumber}
                    onChange={(e) => setClaimNumber(e.target.value)}
                    placeholder="Auto-assigned or manual"
                  />
                </div>
                <div>
                  <Label>Claim Status</Label>
                  <Select value={claimStatus} onValueChange={setClaimStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="submitted">Submitted</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                      <SelectItem value="appealed">Appealed</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </Grid>
            </Section>

            {preauthMissing && isSha && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950/20 dark:border-red-900 dark:text-red-400">
                <div className="font-semibold mb-1 flex items-center gap-1.5">
                  <span>⚠ Pre-Authorization Required</span>
                </div>
                <div className="text-xs space-y-1">
                  <p>
                    This encounter includes a procedure that requires SHA pre-authorization before a
                    claim can be submitted:
                  </p>
                  <ul className="list-disc pl-4 space-y-0.5">
                    {preauthProcedures.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                  <p className="mt-1 font-medium">
                    Enter the Pre-authorization Number above to unlock claim submission.
                  </p>
                </div>
              </div>
            )}

            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
              <div className="font-semibold mb-1">Phase 3 — API Integration Pending</div>
              <div className="text-xs">
                Claims are queued locally. External submission to SHA portal and private insurer
                systems will activate automatically when API credentials are configured.
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="outline" onClick={previewFhir} disabled={fhirLoading}>
              {fhirLoading ? "Loading…" : "Preview FHIR"}
            </Button>
            <Button variant="outline" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save details"}
            </Button>
            <Button
              onClick={submitClaim}
              disabled={submitting || claimStatus === "submitted" || (preauthMissing && isSha)}
              title={
                preauthMissing && isSha
                  ? "Pre-authorization number required before submitting"
                  : undefined
              }
            >
              {submitting
                ? "Submitting…"
                : claimStatus === "submitted"
                  ? "Already submitted"
                  : "Submit claim"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {fhirOpen && (
        <Dialog open onOpenChange={(o) => !o && setFhirOpen(false)}>
          <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>FHIR R4 Encounter Preview</DialogTitle>
            </DialogHeader>
            <p className="text-xs text-muted-foreground">
              This payload will be sent to DHA AfyaLink HIE when Phase 3 is activated.
            </p>
            <div className="flex-1 overflow-y-auto pr-1">
              {fhirLoading && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Generating FHIR payload…
                </div>
              )}
              {!fhirLoading && fhirPayload && (
                <>
                  <pre className="rounded-lg bg-muted p-3 text-xs overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(fhirPayload, null, 2)}
                  </pre>
                  <Button
                    className="mt-3 w-full"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify(fhirPayload, null, 2));
                      toast.success("Copied to clipboard");
                    }}
                  >
                    Copy to clipboard
                  </Button>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

/* ======================== SERVICES (general room) ======================== */

function RequestServicesDialog({
  reg,
  roomId,
  onClose,
  onSaved,
}: {
  reg: Reg;
  roomId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Request services for {reg.patient_name}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto pr-1">
          <RequestServicesInline reg={reg} roomId={roomId} onSaved={onSaved} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RequestServicesInline({
  reg,
  roomId,
  onSaved,
}: {
  reg: Reg;
  roomId: string;
  onSaved: () => void;
}) {
  const [services, setServices] = useState<Service[]>([]);
  const [selected, setSelected] = useState<Set<string>>(
    new Set((reg.tests ?? []).map((t) => t.id)),
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("lab_test_catalog")
      .select("id,name,kind,category,price,cash_price,insurance_price")
      .eq("is_active", true)
      .order("kind")
      .order("name")
      .then(({ data }) => setServices((data ?? []) as Service[]));
  }, []);

  const priceFor = (s: Service) => {
    if (reg.payment_mode === "insurance")
      return Number(s.insurance_price ?? s.cash_price ?? s.price ?? 0);
    return Number(s.cash_price ?? s.price ?? 0);
  };
  const picked = useMemo(() => services.filter((s) => selected.has(s.id)), [services, selected]);
  const subtotal = picked.reduce((sum, s) => sum + priceFor(s), 0);
  const coveragePct =
    reg.payment_mode === "insurance" ? Number(reg.insurance_coverage_percentage ?? 0) : 0;
  const insuranceCovered =
    reg.payment_mode === "insurance" ? +((subtotal * coveragePct) / 100).toFixed(2) : 0;
  const patientDue = reg.payment_mode === "free" ? 0 : +(subtotal - insuranceCovered).toFixed(2);

  function toggle(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function save() {
    if (picked.length === 0) {
      toast.error("Pick at least one service");
      return;
    }
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
    const { error } = await supabase
      .from("patient_registrations")
      .update({
        tests: nextTests,
        subtotal,
        insurance_covered: insuranceCovered,
        patient_due: patientDue,
        payment_status:
          reg.payment_mode === "free" ? "waived" : patientDue === 0 ? "waived" : "unpaid",
        amount_paid: 0,
      } as never)
      .eq("id", reg.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Services requested — patient routed for billing / lab");
    onSaved();
  }

  return (
    <div className="space-y-4">
      <div className="text-xs text-muted-foreground">
        Payment mode: <span className="font-medium uppercase">{reg.payment_mode}</span>
        {reg.payment_mode === "insurance" && <> · Cover {coveragePct}%</>}
      </div>
      <ServicePicker
        items={services}
        selectedIds={selected}
        onToggle={toggle}
        priceFor={priceFor}
        placeholder="Search and add services or tests…"
        emptyLabel="No services configured. Ask an admin to add them under Services."
      />

      <div className="rounded-lg border bg-muted/30 p-3 text-sm">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span className="tabular-nums">KSh {subtotal.toFixed(2)}</span>
        </div>
        {reg.payment_mode === "insurance" && (
          <div className="flex justify-between text-muted-foreground">
            <span>Insurance ({coveragePct}%)</span>
            <span className="tabular-nums">-KSh {insuranceCovered.toFixed(2)}</span>
          </div>
        )}
        <div className="mt-1 flex justify-between border-t pt-1 font-semibold">
          <span>Patient pays</span>
          <span className="tabular-nums">KSh {patientDue.toFixed(2)}</span>
        </div>
      </div>
      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          Send request
        </Button>
      </div>
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
function Num({
  label,
  value,
  onChange,
  step,
  min,
  max,
}: {
  label: string;
  value: number | "" | undefined;
  onChange: (n: number | "") => void;
  step?: string;
  min?: number;
  max?: number;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Input
        type="number"
        step={step}
        min={min}
        max={max}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
      />
    </div>
  );
}
function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input value={value} readOnly className="bg-muted/50" />
    </div>
  );
}
function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Input value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
function TextArea({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Textarea rows={3} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
function VitalPill({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between rounded-md bg-background px-2 py-1 border">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium">{v}</span>
    </div>
  );
}

/* ==================== ADMIT (from Consultation) ==================== */

type WardOpt = { id: string; name: string };
type BedOpt = { id: string; ward_id: string; bed_number: string; status: string | null };

function ConsultationAdmitDialog({
  reg,
  onClose,
  onAdmitted,
}: {
  reg: Reg;
  onClose: () => void;
  onAdmitted: () => void;
}) {
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
    supabase
      .from("wards")
      .select("id,name")
      .eq("is_active", true)
      .order("name")
      .then(({ data }) => setWards((data ?? []) as WardOpt[]));
  }, []);

  async function loadBeds(wid: string) {
    const { data } = await supabase
      .from("beds")
      .select("id,ward_id,bed_number,status")
      .eq("ward_id", wid)
      .eq("status", "available")
      .order("bed_number");
    setBeds((data ?? []) as BedOpt[]);
  }
  useEffect(() => {
    if (wardId) loadBeds(wardId);
    else setBeds([]);
  }, [wardId]);

  async function submit() {
    if (!reg.patient_id) {
      toast.error("Missing patient id on encounter");
      return;
    }
    if (!wardId || !bedId) {
      toast.error("Select ward and bed");
      return;
    }
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
        <DialogHeader>
          <DialogTitle>Admit {reg.patient_name} to ward</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
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
                  {beds.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.bed_number}
                    </SelectItem>
                  ))}
                  {wardId && beds.length === 0 && (
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
              <Input value={doctor} onChange={(e) => setDoctor(e.target.value)} />
            </div>
            <div>
              <Label>Type</Label>
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
            <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
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

/* ==================== CHANGE 5: Results tab component ==================== */

type LabResultRow = {
  id: string;
  status: string | null;
  lab_test_catalog: { name: string | null; category: string | null } | null;
  lab_results: {
    result: {
      parameters?: {
        name: string;
        value: string;
        unit?: string;
        low?: string;
        high?: string;
      }[];
      summary?: string;
    } | null;
    performed_by: string | null;
    reported_at: string | null;
  }[];
};

type RadiologyResultRow = {
  id: string;
  status: string | null;
  priority: string | null;
  clinical_indication: string | null;
  ordered_at: string;
  lab_test_catalog: { name: string | null; category: string | null } | null;
};

function EncounterResultsTab({ encounterId }: { encounterId: string }) {
  const [labRows, setLabRows] = useState<LabResultRow[]>([]);
  const [radRows, setRadRows] = useState<RadiologyResultRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const [labRes, radRes] = await Promise.all([
        supabase
          .from("lab_orders")
          .select(
            "id,status,lab_test_catalog(name,category),lab_results(result,performed_by,reported_at)",
          )
          .eq("encounter_id", encounterId)
          .eq("status", "completed")
          .order("created_at", { ascending: true }),
        supabase
          .from("radiology_orders")
          .select(
            "id,status,priority,clinical_indication,ordered_at,lab_test_catalog(name,category)",
          )
          .eq("encounter_id", encounterId)
          .eq("status", "completed")
          .order("ordered_at", { ascending: true }),
      ]);
      if (cancelled) return;
      setLabRows((labRes.data ?? []) as unknown as LabResultRow[]);
      setRadRows((radRes.data ?? []) as unknown as RadiologyResultRow[]);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [encounterId]);

  if (loading) {
    return <p className="text-sm text-muted-foreground py-4">Loading results…</p>;
  }

  if (labRows.length === 0 && radRows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        No completed lab or radiology results for this visit yet.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Lab results ── */}
      {labRows.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Laboratory
          </h3>
          {labRows.map((order) => {
            const r = order.lab_results?.[0] ?? null;
            const params = r?.result?.parameters ?? [];
            const summary = r?.result?.summary ?? "";
            return (
              <div key={order.id} className="rounded-xl border bg-card p-4 shadow-sm space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{order.lab_test_catalog?.name ?? "Lab test"}</p>
                    <p className="text-xs text-muted-foreground">
                      {order.lab_test_catalog?.category ?? ""}
                    </p>
                  </div>
                  <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                    Completed
                  </Badge>
                </div>

                {r ? (
                  <>
                    {params.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm border rounded-lg overflow-hidden">
                          <thead>
                            <tr className="bg-muted/40 text-xs uppercase text-muted-foreground">
                              <th className="px-3 py-2 text-left">Parameter</th>
                              <th className="px-3 py-2 text-left">Result</th>
                              <th className="px-3 py-2 text-left">Unit</th>
                              <th className="px-3 py-2 text-left">Reference</th>
                              <th className="px-3 py-2 text-left">Flag</th>
                            </tr>
                          </thead>
                          <tbody>
                            {params.map((p, i) => {
                              const numVal = parseFloat(p.value);
                              const low = parseFloat(p.low ?? "");
                              const high = parseFloat(p.high ?? "");
                              const flagLow = !isNaN(numVal) && !isNaN(low) && numVal < low;
                              const flagHigh = !isNaN(numVal) && !isNaN(high) && numVal > high;
                              return (
                                <tr key={i} className="border-t">
                                  <td className="px-3 py-2">{p.name}</td>
                                  <td
                                    className={`px-3 py-2 font-medium ${
                                      flagLow || flagHigh ? "text-rose-600" : ""
                                    }`}
                                  >
                                    {p.value || "—"}
                                  </td>
                                  <td className="px-3 py-2 text-muted-foreground">
                                    {p.unit ?? "—"}
                                  </td>
                                  <td className="px-3 py-2 text-muted-foreground">
                                    {p.low && p.high
                                      ? `${p.low} – ${p.high}`
                                      : p.low
                                        ? `≥ ${p.low}`
                                        : p.high
                                          ? `≤ ${p.high}`
                                          : "—"}
                                  </td>
                                  <td className="px-3 py-2">
                                    {flagHigh && (
                                      <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100 text-xs">
                                        High
                                      </Badge>
                                    )}
                                    {flagLow && (
                                      <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 text-xs">
                                        Low
                                      </Badge>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {params.length === 0 && summary && (
                      <p className="text-sm whitespace-pre-wrap">{summary}</p>
                    )}

                    {params.length > 0 && summary && (
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                          Summary / comment
                        </p>
                        <p className="text-sm whitespace-pre-wrap">{summary}</p>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground border-t pt-2">
                      {r.performed_by && <span>Performed by: {r.performed_by}</span>}
                      {r.reported_at && (
                        <span>
                          Reported: {format(new Date(r.reported_at), "dd MMM yyyy, HH:mm")}
                        </span>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    Order completed — no result record saved.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Radiology results ── */}
      {radRows.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Radiology
          </h3>
          {radRows.map((order) => (
            <div key={order.id} className="rounded-xl border bg-card p-4 shadow-sm space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{order.lab_test_catalog?.name ?? "Radiology study"}</p>
                  <p className="text-xs text-muted-foreground">
                    {order.lab_test_catalog?.category ?? ""}
                    {order.priority ? ` · ${order.priority}` : ""}
                  </p>
                </div>
                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                  Completed
                </Badge>
              </div>
              {order.clinical_indication && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Clinical indication
                  </p>
                  <p className="text-sm">{order.clinical_indication}</p>
                </div>
              )}
              <p className="text-xs text-muted-foreground border-t pt-2">
                Ordered: {format(new Date(order.ordered_at), "dd MMM yyyy, HH:mm")}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
/* ==================== CONSULTATION PATIENT CARD ==================== */

function ConsultationPatientCard({ reg, onOpen }: { reg: Reg; onOpen: () => void }) {
  const waitMinutes = Math.floor((Date.now() - new Date(reg.created_at).getTime()) / 60000);
  const waitColor =
    waitMinutes > 60
      ? "border-l-rose-500 bg-rose-50/30"
      : waitMinutes > 30
        ? "border-l-amber-500 bg-amber-50/30"
        : "border-l-emerald-500 bg-emerald-50/30";

  const waitLabel =
    waitMinutes > 60 ? `${Math.floor(waitMinutes / 60)}h ${waitMinutes % 60}m` : `${waitMinutes}m`;

  const v = reg.vitals ?? {};
  const cleared = reg.payment_status === "paid" || reg.payment_status === "waived";
  const diagnoses = (reg.diagnoses ?? []) as { icd11_code: string; description: string }[];
  const tests = reg.tests ?? [];

  return (
    <div
      className={`rounded-xl border-l-4 border border-border p-4 cursor-pointer hover:shadow-md transition-shadow ${waitColor}`}
      onClick={onOpen}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-base">{reg.patient_name}</div>
          <div className="text-xs text-muted-foreground">
            {reg.file_number ? `#${reg.file_number}` : "—"}
            {reg.from_room ? ` · from ${reg.from_room}` : ""}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="text-xs font-medium text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {waitLabel} waiting
          </div>
          {cleared ? (
            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-xs">
              {reg.payment_status}
            </Badge>
          ) : (
            <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100 text-xs flex items-center gap-1">
              <ShieldAlert className="h-3 w-3" />
              {reg.payment_status}
            </Badge>
          )}
        </div>
      </div>

      {/* Vitals row */}
      {Object.values(v).some((val) => val !== undefined && val !== "") && (
        <div className="mt-3 flex flex-wrap gap-2">
          {v.bp_systolic && v.bp_diastolic && (
            <VitalChip
              label="BP"
              value={`${v.bp_systolic}/${v.bp_diastolic}`}
              alert={Number(v.bp_systolic) > 140 || Number(v.bp_diastolic) > 90}
            />
          )}
          {v.pulse_bpm && (
            <VitalChip
              label="Pulse"
              value={`${v.pulse_bpm} bpm`}
              alert={Number(v.pulse_bpm) > 100 || Number(v.pulse_bpm) < 60}
            />
          )}
          {v.temperature_c && (
            <VitalChip
              label="Temp"
              value={`${v.temperature_c}°C`}
              alert={Number(v.temperature_c) > 38.5}
            />
          )}
          {v.spo2 && <VitalChip label="SpO₂" value={`${v.spo2}%`} alert={Number(v.spo2) < 94} />}
          {v.pain_score !== undefined && v.pain_score !== "" && (
            <VitalChip label="Pain" value={`${v.pain_score}/10`} alert={Number(v.pain_score) > 7} />
          )}
        </div>
      )}

      {/* Services requested */}
      {tests.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {tests.map((t) => (
            <Badge key={t.id} variant="secondary" className="text-xs">
              {t.name}
            </Badge>
          ))}
        </div>
      )}

      {/* Diagnoses */}
      {diagnoses.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {diagnoses.map((d, i) => (
            <Badge key={i} className="bg-blue-100 text-blue-700 hover:bg-blue-100 text-xs">
              {d.icd11_code} {d.description}
            </Badge>
          ))}
        </div>
      )}

      {/* Open button */}
      <div className="mt-3 flex justify-end">
        <Button size="sm" variant="outline">
          <Stethoscope className="mr-1 h-3.5 w-3.5" />
          Consult
        </Button>
      </div>
    </div>
  );
}

function VitalChip({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div
      className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-xs border ${
        alert
          ? "bg-rose-100 border-rose-300 text-rose-700 font-semibold"
          : "bg-background border-border text-muted-foreground"
      }`}
    >
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

/* ==================== PRESCRIPTION PRINT SLIP ==================== */

function PrescriptionPrintSlip({ reg, rxs }: { reg: Reg; rxs: Prescription[] }) {
  return (
    <div className="text-sm font-sans space-y-4">
      {/* Header */}
      <div className="border-b-2 border-black pb-3">
        <div className="text-xl font-bold">AegisCare — Prescription</div>
        <div className="text-xs text-gray-500">
          Printed: {format(new Date(), "dd MMM yyyy, HH:mm")}
        </div>
      </div>

      {/* Patient details */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-xs text-gray-500 uppercase">Patient</div>
          <div className="font-semibold">{reg.patient_name}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500 uppercase">File #</div>
          <div className="font-semibold">{reg.file_number ?? "—"}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500 uppercase">Date</div>
          <div>{format(new Date(), "dd MMM yyyy")}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500 uppercase">Payment mode</div>
          <div className="capitalize">{reg.payment_mode}</div>
        </div>
      </div>

      {/* Prescriptions table */}
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-gray-300 text-xs uppercase text-gray-500">
            <th className="py-1 text-left pr-3">#</th>
            <th className="py-1 text-left pr-3">Drug</th>
            <th className="py-1 text-left pr-3">Dosage</th>
            <th className="py-1 text-left pr-3">Frequency</th>
            <th className="py-1 text-left pr-3">Duration</th>
            <th className="py-1 text-right">Qty</th>
          </tr>
        </thead>
        <tbody>
          {rxs.map((rx, i) => (
            <tr key={rx.id} className="border-b border-gray-100">
              <td className="py-1.5 pr-3 text-gray-500">{i + 1}</td>
              <td className="py-1.5 pr-3 font-medium">{rx.drug_name}</td>
              <td className="py-1.5 pr-3">{rx.dosage ?? "—"}</td>
              <td className="py-1.5 pr-3">{rx.frequency ?? "—"}</td>
              <td className="py-1.5 pr-3">{rx.duration ?? "—"}</td>
              <td className="py-1.5 text-right">{rx.quantity}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Prescriber */}
      {rxs[0]?.prescribed_by_name && (
        <div className="text-xs text-gray-500">
          Prescribed by: <span className="font-medium text-black">{rxs[0].prescribed_by_name}</span>
        </div>
      )}

      {/* Signature lines */}
      <div className="mt-8 grid grid-cols-2 gap-8 text-xs text-gray-500">
        <div>
          <div className="border-b border-black pb-8" />
          <div className="mt-1">Prescriber signature</div>
        </div>
        <div>
          <div className="border-b border-black pb-8" />
          <div className="mt-1">Dispenser signature</div>
        </div>
      </div>
    </div>
  );
}

/* ==================== CONSULTATION OVERVIEW (stats header) ==================== */

export type ConsultPriority = "emergency" | "urgent" | "not_urgent";

export function consultPriority(reg: Reg): ConsultPriority {
  const v = reg.vitals ?? {};
  const n = (x: number | "" | undefined) => (x === "" || x === undefined ? undefined : Number(x));
  const spo2 = n(v.spo2);
  const temp = n(v.temperature_c);
  const pulse = n(v.pulse_bpm);
  const sys = n(v.bp_systolic);
  const dia = n(v.bp_diastolic);
  const pain = n(v.pain_score);
  if (
    (spo2 !== undefined && spo2 < 90) ||
    (temp !== undefined && temp >= 39.5) ||
    (pulse !== undefined && (pulse > 130 || pulse < 45)) ||
    (sys !== undefined && (sys >= 180 || sys < 90)) ||
    (pain !== undefined && pain >= 8)
  )
    return "emergency";
  if (
    (spo2 !== undefined && spo2 < 94) ||
    (temp !== undefined && temp > 38) ||
    (pulse !== undefined && (pulse > 100 || pulse < 60)) ||
    (sys !== undefined && sys >= 140) ||
    (dia !== undefined && dia >= 90) ||
    (pain !== undefined && pain >= 5)
  )
    return "urgent";
  return "not_urgent";
}

type InvestigationCounts = { lab: number; radiology: number; procedures: number };

function StatCard({
  title,
  total,
  items,
  onPick,
  active,
}: {
  title: string;
  total: number;
  items: { key: string; label: string; value: number }[];
  onPick?: (key: string) => void;
  active?: string | null;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-3 flex items-end gap-5">
        <div className="text-3xl font-light leading-none">{total}</div>
        <div className="flex flex-wrap gap-4">
          {items.map((it) => (
            <button
              key={it.key}
              type="button"
              onClick={() => onPick?.(it.key)}
              className={`text-left ${onPick ? "cursor-pointer" : "cursor-default"}`}
            >
              <div
                className={`text-xs ${
                  active === it.key ? "font-semibold text-primary underline" : "text-primary"
                }`}
              >
                {it.label} →
              </div>
              <div className="text-xl font-light">{it.value}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ConsultationOverview({
  rows,
  roomName,
  roomId,
  filter,
  onFilter,
  onRefresh,
}: {
  rows: Reg[];
  roomName: string;
  roomId: string;
  filter: ConsultPriority | null;
  onFilter: (p: ConsultPriority | null) => void;
  onRefresh: () => void;
}) {
  const [awaiting, setAwaiting] = useState<InvestigationCounts>({
    lab: 0,
    radiology: 0,
    procedures: 0,
  });
  const [completed, setCompleted] = useState<InvestigationCounts>({
    lab: 0,
    radiology: 0,
    procedures: 0,
  });
  const [totalVisits, setTotalVisits] = useState(0);

  async function loadStats() {
    const [{ data: roomsData }, { data: sentOut }] = await Promise.all([
      supabase.from("rooms").select("id,kind"),
      supabase
        .from("patient_registrations")
        .select("id,current_room_id,status,tests,from_room")
        .eq("from_room", roomName)
        .neq("status", "cancelled"),
    ]);
    const kindById = new Map<string, string>(
      ((roomsData ?? []) as { id: string; kind: string }[]).map((r) => [r.id, r.kind]),
    );
    const a: InvestigationCounts = { lab: 0, radiology: 0, procedures: 0 };
    const c: InvestigationCounts = { lab: 0, radiology: 0, procedures: 0 };
    for (const reg of (sentOut ?? []) as {
      current_room_id: string | null;
      status: string;
      tests: unknown;
    }[]) {
      const kind = reg.current_room_id ? kindById.get(reg.current_room_id) : undefined;
      const bucket: keyof InvestigationCounts =
        kind === "lab" ? "lab" : kind === "radiology" ? "radiology" : "procedures";
      if (reg.current_room_id === roomId) {
        // returned to this consultation room → investigation completed
        const has = Array.isArray(reg.tests) && reg.tests.length > 0;
        if (has) c.lab += 1;
      } else if (reg.status !== "done" && kind) {
        a[bucket] += 1;
      }
    }
    setAwaiting(a);
    setCompleted(c);

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const { count } = await supabase
      .from("patient_registrations")
      .select("id", { count: "exact", head: true })
      .gte("created_at", startOfDay.toISOString());
    setTotalVisits(count ?? 0);
  }

  useEffect(() => {
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, roomName, rows.length]);

  const byPriority = useMemo(() => {
    const out = { emergency: 0, urgent: 0, not_urgent: 0 };
    for (const r of rows) out[consultPriority(r)] += 1;
    return out;
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Awaiting consultation"
          total={rows.length}
          active={filter}
          onPick={(k) => onFilter(filter === k ? null : (k as ConsultPriority))}
          items={[
            { key: "emergency", label: "Emergency", value: byPriority.emergency },
            { key: "urgent", label: "Urgent", value: byPriority.urgent },
            { key: "not_urgent", label: "Not Urgent", value: byPriority.not_urgent },
          ]}
        />
        <StatCard
          title="Investigation Awaiting"
          total={awaiting.lab + awaiting.radiology + awaiting.procedures}
          items={[
            { key: "lab", label: "Lab", value: awaiting.lab },
            { key: "radiology", label: "Radiology", value: awaiting.radiology },
            { key: "procedures", label: "Procedures", value: awaiting.procedures },
          ]}
        />
        <StatCard
          title="Investigation Completed"
          total={completed.lab + completed.radiology + completed.procedures}
          items={[
            { key: "lab", label: "Lab", value: completed.lab },
            { key: "radiology", label: "Radiology", value: completed.radiology },
            { key: "procedures", label: "Procedures", value: completed.procedures },
          ]}
        />
        <div className="rounded-xl border bg-card p-4">
          <div className="text-sm font-semibold">Total Visits</div>
          <div className="mt-3 text-3xl font-light leading-none">{totalVisits}</div>
          <div className="mt-1 text-xs text-muted-foreground">today</div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 text-sm">
        <span className="font-medium">Filters:</span>
        {filter ? (
          <Badge
            className="cursor-pointer bg-rose-100 text-rose-700 hover:bg-rose-100"
            onClick={() => onFilter(null)}
          >
            {filter.replace("_", " ")} <X className="ml-1 h-3 w-3" />
          </Badge>
        ) : (
          <Badge variant="secondary">No filters</Badge>
        )}
        <Button size="sm" variant="ghost" onClick={onRefresh}>
          Refresh
        </Button>
      </div>

      <div className="border-b">
        <div className="inline-block border-b-2 border-primary px-4 py-2 text-sm font-semibold text-primary">
          {roomName}
        </div>
      </div>
    </div>
  );
}

// ─── WardRoomView ─────────────────────────────────────────────────────────────
// Renders when room.kind === 'ward'. Shows bed grid for the specific ward
// linked via rooms.ward_id → wards.id. Click a bed → /inpatient/$admissionId

type WardBed = {
  id: string;
  ward_id: string;
  bed_number: string;
  status: string | null;
};

type WardAdmission = {
  id: string;
  bed_id: string | null;
  encounter_id: string | null;
  admitted_at: string | null;
  expected_discharge_date: string | null;
  admitting_doctor: string | null;
  admission_reason: string | null;
  status: string | null;
  patients: {
    patient_name: string | null;
    file_number: string | null;
  } | null;
};

function bedColor(status: string | null) {
  if (status === "occupied") return "bg-rose-100 border-rose-300 text-rose-800";
  if (status === "available") return "bg-emerald-50 border-emerald-200 text-emerald-800";
  return "bg-muted border-border text-muted-foreground";
}

function WardRoomView({
  room,
  navigate,
}: {
  room: Room;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const [beds, setBeds] = useState<WardBed[]>([]);
  const [admissions, setAdmissions] = useState<WardAdmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBed, setSelectedBed] = useState<WardBed | null>(null);

  const wardId = room.ward_id;

  const load = useCallback(async () => {
    if (!wardId) return;
    setLoading(true);
    const [bedRes, admRes] = await Promise.all([
      supabase
        .from("beds")
        .select("id,ward_id,bed_number,status")
        .eq("ward_id", wardId)
        .order("bed_number"),
      supabase
        .from("admissions")
        .select(
          "id,bed_id,encounter_id,admitted_at,expected_discharge_date,admitting_doctor,admission_reason,status,patients(patient_name,file_number)",
        )
        .eq("ward_id", wardId)
        .eq("status", "admitted"),
    ]);
    setBeds((bedRes.data ?? []) as WardBed[]);
    setAdmissions((admRes.data ?? []) as unknown as WardAdmission[]);
    setLoading(false);
  }, [wardId]);

  useEffect(() => {
    load();
  }, [load]);

  const admissionByBed = useMemo(() => {
    const map = new Map<string, WardAdmission>();
    admissions.forEach((a) => {
      if (a.bed_id) map.set(a.bed_id, a);
    });
    return map;
  }, [admissions]);

  const occupied = beds.filter((b) => b.status === "occupied").length;
  const available = beds.filter((b) => b.status === "available").length;

  const selectedAdmission = selectedBed ? (admissionByBed.get(selectedBed.id) ?? null) : null;

  if (!wardId) {
    return (
      <div className="mx-auto max-w-5xl p-8 text-center text-muted-foreground">
        <BedDouble className="h-10 w-10 mx-auto mb-3 opacity-20" />
        <p>This ward room is not linked to a ward record.</p>
        <p className="text-xs mt-1">Ask an admin to link it in Admin → Rooms.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <BedDouble className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">{room.name}</h1>
            <p className="text-sm text-muted-foreground">
              Inpatient ward · View bed occupancy and open patient clinical charts.
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={load}>
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border bg-card p-4 text-center">
          <p className="text-xs text-muted-foreground">Total beds</p>
          <p className="text-3xl font-light mt-1">{beds.length}</p>
        </div>
        <div className="rounded-xl border bg-rose-50 p-4 text-center">
          <p className="text-xs text-rose-600">Occupied</p>
          <p className="text-3xl font-light mt-1 text-rose-700">{occupied}</p>
        </div>
        <div className="rounded-xl border bg-emerald-50 p-4 text-center">
          <p className="text-xs text-emerald-600">Available</p>
          <p className="text-3xl font-light mt-1 text-emerald-700">{available}</p>
        </div>
      </div>

      {/* Bed grid */}
      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground py-8">
          <Archive className="h-4 w-4 animate-pulse" />
          Loading beds…
        </div>
      ) : beds.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
          No beds configured for this ward yet.
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
          {beds.map((bed) => {
            const adm = admissionByBed.get(bed.id);
            return (
              <button
                key={bed.id}
                onClick={() => setSelectedBed(bed)}
                className={`rounded-lg border p-3 text-center text-xs font-medium transition hover:opacity-80 ${bedColor(bed.status)}`}
              >
                <BedDouble className="h-5 w-5 mx-auto mb-1 opacity-60" />
                <div className="font-semibold">{bed.bed_number}</div>
                <div className="mt-0.5 truncate">
                  {adm?.patients?.patient_name
                    ? adm.patients.patient_name.split(" ")[0]
                    : (bed.status ?? "—")}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Bed detail dialog */}
      <Dialog open={!!selectedBed} onOpenChange={(o) => !o && setSelectedBed(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Bed {selectedBed?.bed_number} — {room.name}
            </DialogTitle>
          </DialogHeader>
          {selectedBed && (
            <div className="space-y-3 text-sm">
              <div>
                Status:{" "}
                <Badge
                  className={
                    selectedBed.status === "occupied"
                      ? "bg-rose-100 text-rose-700 hover:bg-rose-100"
                      : "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                  }
                >
                  {selectedBed.status ?? "unknown"}
                </Badge>
              </div>
              {selectedAdmission && selectedAdmission.patients ? (
                <div className="rounded-md border p-3 space-y-1">
                  <div className="font-medium">
                    {selectedAdmission.patients.patient_name ?? "Patient"}
                  </div>
                  {selectedAdmission.patients.file_number && (
                    <div className="text-xs text-muted-foreground">
                      File #{selectedAdmission.patients.file_number}
                    </div>
                  )}
                  {selectedAdmission.admitted_at && (
                    <div className="text-xs">
                      Admitted: {format(new Date(selectedAdmission.admitted_at), "dd MMM yyyy")}
                    </div>
                  )}
                  {selectedAdmission.admitting_doctor && (
                    <div className="text-xs">Doctor: {selectedAdmission.admitting_doctor}</div>
                  )}
                  {selectedAdmission.admission_reason && (
                    <div className="text-xs">Reason: {selectedAdmission.admission_reason}</div>
                  )}
                  {selectedAdmission.expected_discharge_date && (
                    <div className="text-xs">
                      Expected D/C: {selectedAdmission.expected_discharge_date}
                    </div>
                  )}
                  <div className="pt-2">
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        setSelectedBed(null);
                        navigate({
                          to: "/inpatient/$admissionId",
                          params: { admissionId: selectedAdmission.id },
                        });
                      }}
                    >
                      <BedDouble className="h-4 w-4 mr-2" />
                      Open patient chart
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-muted-foreground">No active admission on this bed.</div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
