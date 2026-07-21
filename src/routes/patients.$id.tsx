/**
 * LabTrack — Hospital Records
 * Copyright (c) 2026 Francis Muhoro. All rights reserved.
 */

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PermGuard } from "@/lib/require-access";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Plus, ClipboardList, Banknote, Shield, HeartHandshake } from "lucide-react";

export const Route = createFileRoute("/patients/$id")({
  component: () => (
    <AppShell>
      <PermGuard perm="records_view">
        <PatientProfile />
      </PermGuard>
    </AppShell>
  ),
});

type Patient = {
  id: string;
  file_number: string | null;
  patient_name: string | null;
  first_name: string | null;
  middle_name: string | null;
  family_name: string | null;
  sex: string | null;
  date_of_birth: string | null;
  estimated_age: number | null;
  phone: string | null;
  email: string | null;
  address_line1: string | null;
  city: string | null;
  county: string | null;
  country: string | null;
  occupation: string | null;
  marital_status: string | null;
  nationality: string | null;
  next_of_kin: unknown;
  is_deceased: boolean | null;
  date_of_death: string | null;
  created_at: string;
};

type Encounter = {
  id: string;
  created_at: string;
  status: string | null;
  payment_mode: string | null;
  payment_status: string | null;
  subtotal: number | null;
  patient_due: number | null;
  amount_paid: number | null;
  from_room: string | null;
  current_room_id: string | null;
  tests: unknown;
  encounter_type: string | null;
};

function PatientProfile() {
  const { id } = Route.useParams();
  const navigate = useNavigate();

  const { data: patient, isLoading: pLoading } = useQuery({
    queryKey: ["patient", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patients")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as Patient | null;
    },
  });

  const { data: encounters, isLoading: eLoading } = useQuery({
    queryKey: ["patient-encounters", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("encounters")
        .select(
          "id,created_at,status,payment_mode,payment_status,subtotal,patient_due,amount_paid,from_room,current_room_id,tests,encounter_type",
        )
        .eq("patient_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Encounter[];
    },
  });

  if (pLoading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (!patient) {
    return (
      <div className="mx-auto max-w-2xl rounded-xl border bg-card p-8 text-center">
        <p className="text-muted-foreground">Patient not found.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate({ to: "/patients" })}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to patients
        </Button>
      </div>
    );
  }

  const name =
    patient.patient_name ||
    [patient.first_name, patient.middle_name, patient.family_name].filter(Boolean).join(" ") ||
    "Unnamed";
  const kok = patient.next_of_kin as { name?: string; relation?: string; phone?: string } | null;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/patients" })}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Patients
        </Button>
        <NewEncounterDialog patientId={patient.id} patientName={name} />
      </div>

      {/* Demographics card */}
      <div className="rounded-xl border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {patient.file_number && (
                <span className="font-mono">File #{patient.file_number}</span>
              )}
              {patient.sex && (
                <Badge variant="outline" className="capitalize">
                  {patient.sex}
                </Badge>
              )}
              <span>{ageStr(patient)}</span>
              {patient.is_deceased && <Badge variant="destructive">Deceased</Badge>}
            </div>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            Registered {new Date(patient.created_at).toLocaleDateString()}
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-sm">
          <Info label="Phone" value={patient.phone} />
          <Info label="Email" value={patient.email} />
          <Info label="Occupation" value={patient.occupation} />
          <Info label="Marital status" value={patient.marital_status} />
          <Info label="Nationality" value={patient.nationality} />
          <Info
            label="Address"
            value={
              [patient.address_line1, patient.city, patient.county, patient.country]
                .filter(Boolean)
                .join(", ") || null
            }
          />
          <Info
            label="Next of kin"
            value={
              kok?.name
                ? `${kok.name}${kok.relation ? ` (${kok.relation})` : ""}${kok.phone ? ` · ${kok.phone}` : ""}`
                : null
            }
          />
        </div>
      </div>

      {/* Encounter history */}
      <div className="rounded-xl border bg-card">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Encounter history</h2>
          </div>
          <span className="text-xs text-muted-foreground">{encounters?.length ?? 0} total</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3 text-right">Subtotal</th>
                <th className="px-4 py-3 text-right">Balance</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {eLoading && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              )}
              {!eLoading && encounters?.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-muted-foreground">
                    No encounters yet.
                  </td>
                </tr>
              )}
              {encounters?.map((e) => {
                const bal = Number(e.patient_due ?? 0) - Number(e.amount_paid ?? 0);
                return (
                  <tr key={e.id} className="hover:bg-accent/40">
                    <td className="px-4 py-3 whitespace-nowrap">
                      {new Date(e.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 capitalize">{e.encounter_type || "visit"}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="capitalize">
                        {e.status || "—"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <span className="capitalize">{e.payment_mode || "—"}</span>
                      {e.payment_status && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          · {e.payment_status}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      KSh {Number(e.subtotal ?? 0).toFixed(2)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right tabular-nums ${bal > 0 ? "text-destructive" : ""}`}
                    >
                      KSh {bal.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button asChild size="sm" variant="ghost">
                        <Link to="/records/$id" params={{ id: e.id }}>
                          Open
                        </Link>
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5">{value || <span className="text-muted-foreground">—</span>}</div>
    </div>
  );
}

function ageStr(p: Patient) {
  if (p.date_of_birth) {
    const dob = new Date(p.date_of_birth);
    const years = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000));
    return `${years} years`;
  }
  if (p.estimated_age) return `~${p.estimated_age} years`;
  return "Age unknown";
}

/* ─────────── New encounter dialog ─────────── */

type Insurer = { id: string; name: string; code: string; coverage_percentage: number };
type TestRow = {
  id: string;
  name: string;
  price: number;
  cash_price: number | null;
  insurance_price: number | null;
  kind: string;
  category: string | null;
};
type Room = { id: string; name: string; kind: string };
type PaymentMode = "cash" | "insurance" | "free";

function NewEncounterDialog({
  patientId,
  patientName,
}: {
  patientId: string;
  patientName: string;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const [insurers, setInsurers] = useState<Insurer[]>([]);
  const [tests, setTests] = useState<TestRow[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [fromRoom, setFromRoom] = useState("Reception");
  const [sendToRoomId, setSendToRoomId] = useState("");
  const [mode, setMode] = useState<PaymentMode>("cash");
  const [insurerId, setInsurerId] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    supabase
      .from("insurance_providers")
      .select("id,name,code,coverage_percentage")
      .eq("is_active", true)
      .order("name")
      .then(({ data }) => setInsurers((data ?? []) as Insurer[]));
    supabase
      .from("lab_test_catalog")
      .select("id,name,price,cash_price,insurance_price,kind,category")
      .eq("is_active", true)
      .order("name")
      .then(({ data }) => setTests((data ?? []) as TestRow[]));
    supabase
      .from("rooms")
      .select("id,name,kind")
      .eq("is_active", true)
      .order("name")
      .then(({ data }) => setRooms((data ?? []) as Room[]));
  }, [open]);

  const insurer = insurers.find((i) => i.id === insurerId);
  const priceFor = (t: TestRow) =>
    mode === "insurance"
      ? Number(t.insurance_price ?? t.cash_price ?? t.price ?? 0)
      : Number(t.cash_price ?? t.price ?? 0);

  const selected = useMemo(() => tests.filter((t) => selectedIds.has(t.id)), [tests, selectedIds]);
  const subtotal = selected.reduce((s, t) => s + priceFor(t), 0);
  const coveragePct = mode === "insurance" && insurer ? Number(insurer.coverage_percentage) : 0;
  const insuranceCovered = mode === "insurance" ? +((subtotal * coveragePct) / 100).toFixed(2) : 0;
  const patientDue = mode === "free" ? 0 : +(subtotal - insuranceCovered).toFixed(2);

  const create = useMutation({
    mutationFn: async () => {
      if (!sendToRoomId) throw new Error("Select the room to send the patient to");
      if (mode === "insurance" && !insurer) throw new Error("Select an insurance provider");
      const hasTests = selected.length > 0;
      const { error, data } = await supabase
        .from("encounters")
        .insert({
          id: crypto.randomUUID(),
          patient_id: patientId,
          from_room: fromRoom || "Reception",
          current_room_id: sendToRoomId,
          payment_mode: mode,
          insurance_provider_id: mode === "insurance" ? insurer!.id : null,
          insurance_coverage_percentage: mode === "insurance" ? coveragePct : null,
          tests: selected.map((t) => ({ id: t.id, name: t.name, price: priceFor(t) })),
          subtotal,
          insurance_covered: insuranceCovered,
          patient_due: patientDue,
          payment_status: mode === "free" || !hasTests ? "waived" : "unpaid",
          amount_paid: 0,
          created_by: user!.id,
        })
        .select("id")
        .maybeSingle();
      if (error) throw error;
      return data?.id as string | undefined;
    },
    onSuccess: () => {
      toast.success("New encounter started");
      qc.invalidateQueries({ queryKey: ["patient-encounters", patientId] });
      setOpen(false);
      setSelectedIds(new Set());
      navigate({ to: "/queue" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> New encounter
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>New encounter for {patientName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Send to (room) *</Label>
              <Select value={sendToRoomId} onValueChange={setSendToRoomId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select room" />
                </SelectTrigger>
                <SelectContent>
                  {rooms.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Sent from</Label>
              <Select value={fromRoom} onValueChange={setFromRoom}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Reception">Reception</SelectItem>
                  {rooms.map((r) => (
                    <SelectItem key={r.id} value={r.name}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="mb-2 block">Payment mode</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <ModeBtn
                label="Cash"
                icon={Banknote}
                active={mode === "cash"}
                on={() => setMode("cash")}
                cls="bg-emerald-600"
              />
              <ModeBtn
                label="Insurance"
                icon={Shield}
                active={mode === "insurance"}
                on={() => setMode("insurance")}
                cls="bg-blue-600"
              />
              <ModeBtn
                label="Free / Waived"
                icon={HeartHandshake}
                active={mode === "free"}
                on={() => setMode("free")}
                cls="bg-amber-500"
              />
            </div>
            {mode === "insurance" && (
              <div className="mt-3 space-y-1.5">
                <Label>Insurance provider</Label>
                <Select value={insurerId} onValueChange={setInsurerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select insurer" />
                  </SelectTrigger>
                  <SelectContent>
                    {insurers.map((i) => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.name} · {i.coverage_percentage}%
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div>
            <Label className="mb-2 block">Services / tests (optional)</Label>
            <div className="max-h-60 overflow-y-auto rounded-md border">
              {tests.length === 0 && (
                <p className="p-3 text-sm text-muted-foreground">No services configured.</p>
              )}
              <div className="grid gap-1 p-2 sm:grid-cols-2">
                {tests.map((t) => {
                  const active = selectedIds.has(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() =>
                        setSelectedIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(t.id)) next.delete(t.id);
                          else next.add(t.id);
                          return next;
                        })
                      }
                      className={`flex items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition ${
                        active
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "hover:bg-accent"
                      }`}
                    >
                      <span>
                        <span className="font-medium">{t.name}</span>
                        <span className="ml-1 text-[10px] uppercase text-muted-foreground">
                          {t.category || t.kind}
                        </span>
                      </span>
                      <span className="tabular-nums text-xs text-muted-foreground">
                        KSh {priceFor(t).toFixed(2)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="tabular-nums">KSh {subtotal.toFixed(2)}</span>
            </div>
            {mode === "insurance" && (
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            {create.isPending ? "Creating…" : "Start encounter"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ModeBtn({
  label,
  icon: Icon,
  active,
  on,
  cls,
}: {
  label: string;
  icon: typeof Banknote;
  active: boolean;
  on: () => void;
  cls: string;
}) {
  return (
    <button
      type="button"
      onClick={on}
      className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition ${
        active ? `${cls} border-transparent text-white shadow-sm` : "bg-background hover:bg-accent"
      }`}
    >
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}
