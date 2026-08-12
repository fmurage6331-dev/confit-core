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
import { db } from "@/lib/supabase-untyped";
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
import { calcInsuranceCoverage } from "@/lib/insurance-calc";
import {
  ArrowLeft,
  Plus,
  ClipboardList,
  Banknote,
  Shield,
  HeartHandshake,
  Printer,
  ShieldAlert,
} from "lucide-react";
import { ConsentDialog } from "@/components/consent-dialog";

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
  national_id: string | null;
  national_id_type: string | null;
  identity_verified: boolean | null;
  identity_verified_at: string | null;
  sha_membership_status: string | null;
  sha_membership_verified_at: string | null;
  sha_member_number: string | null;
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
  const { user, hasPerm, isAdmin } = useAuth();

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
      <div className="flex items-center justify-between print:hidden">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/patients" })}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Patients
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="mr-1 h-4 w-4" /> Print outpatient card
          </Button>
          <ConsentDialog
            patientId={patient.id}
            patientName={name}
            patientPhone={patient.phone}
            triggerLabel="Record consent"
            triggerVariant="outline"
            triggerSize="sm"
          />
          <NewEncounterDialog patientId={patient.id} patientName={name} />
          {(isAdmin || hasPerm("records_view")) && (
            <BreakGlassDialog
              patientId={patient.id}
              patientName={name}
              userId={user?.id ?? ""}
              userEmail={user?.email ?? ""}
            />
          )}
        </div>
      </div>

      {/* Print-only outpatient card */}
      <div className="hidden print:block">
        <OutpatientCard patient={patient} name={name} kok={kok} encounters={encounters ?? []} />
      </div>

      {/* Demographics card */}
      <div className="rounded-xl border bg-card p-6 print:hidden">
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
              {patient.identity_verified && (
                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                  ✅ Identity verified
                </Badge>
              )}
              {patient.sha_membership_status && (
                <Badge
                  className={
                    patient.sha_membership_status === "active"
                      ? "bg-green-100 text-green-700 border-green-200"
                      : patient.sha_membership_status === "suspended"
                        ? "bg-amber-100 text-amber-700 border-amber-200"
                        : "bg-red-100 text-red-700 border-red-200"
                  }
                >
                  SHA: {patient.sha_membership_status.toUpperCase()}
                </Badge>
              )}
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
      <div className="rounded-xl border bg-card print:hidden">
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
                        <Link to="/encounter-records/$id" params={{ id: e.id }}>
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

function OutpatientCard({
  patient,
  name,
  kok,
  encounters,
}: {
  patient: Patient;
  name: string;
  kok: { name?: string; relation?: string; phone?: string } | null;
  encounters: Encounter[];
}) {
  const idTypeLabel = (t: string | null) => {
    if (t === "national_id") return "National ID";
    if (t === "passport") return "Passport";
    if (t === "birth_certificate") return "Birth Certificate";
    return t ?? "—";
  };

  return (
    <div className="text-sm text-black font-sans border-2 border-black rounded-lg p-6 max-w-2xl mx-auto">
      <div className="flex items-start justify-between border-b-2 border-black pb-3 mb-4">
        <div>
          <div className="text-xl font-bold">AegisCare / LabTrack</div>
          <div className="text-xs uppercase tracking-widest text-gray-500 font-semibold">
            Outpatient Card
          </div>
        </div>
        <div className="text-right text-xs text-gray-500">
          <div>Printed: {new Date().toLocaleDateString()}</div>
          {patient.file_number && (
            <div className="font-mono font-bold text-black text-sm mt-1">
              File # {patient.file_number}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-8 gap-y-3 mb-4">
        <CardField label="Full Name" value={name} />
        <CardField label="Sex" value={patient.sex ?? "—"} />
        <CardField
          label="Date of Birth"
          value={
            patient.date_of_birth
              ? new Date(patient.date_of_birth).toLocaleDateString()
              : patient.estimated_age
                ? `~${patient.estimated_age} yrs`
                : "—"
          }
        />
        <CardField label="Phone" value={patient.phone ?? "—"} />
        <CardField label="Nationality" value={patient.nationality ?? "—"} />
        <CardField label="Occupation" value={patient.occupation ?? "—"} />
        <CardField label="Marital Status" value={patient.marital_status ?? "—"} />
        <CardField
          label="Address"
          value={
            [patient.address_line1, patient.city, patient.county].filter(Boolean).join(", ") || "—"
          }
        />
        <CardField
          label={idTypeLabel(patient.national_id_type)}
          value={patient.national_id ?? "—"}
        />
        <CardField label="Registered" value={new Date(patient.created_at).toLocaleDateString()} />
      </div>

      {kok?.name && (
        <div className="border-t border-gray-300 pt-3 mb-4">
          <div className="text-xs uppercase tracking-wide text-gray-500 mb-2 font-semibold">
            Next of Kin
          </div>
          <div className="grid grid-cols-3 gap-4">
            <CardField label="Name" value={kok.name ?? "—"} />
            <CardField label="Relationship" value={kok.relation ?? "—"} />
            <CardField label="Phone" value={kok.phone ?? "—"} />
          </div>
        </div>
      )}

      <div className="border-t border-gray-300 pt-3">
        <div className="text-xs uppercase tracking-wide text-gray-500 mb-2 font-semibold">
          Visit Log
        </div>
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-gray-400">
              <th className="py-1 text-left pr-4">Date</th>
              <th className="py-1 text-left pr-4">Type</th>
              <th className="py-1 text-left pr-4">Status</th>
              <th className="py-1 text-left pr-4">Payment</th>
              <th className="py-1 text-right">Balance (KSh)</th>
            </tr>
          </thead>
          <tbody>
            {encounters.length === 0 && (
              <tr>
                <td colSpan={5} className="py-3 text-center text-gray-400">
                  No visits recorded yet.
                </td>
              </tr>
            )}
            {encounters.map((e) => {
              const bal = Number(e.patient_due ?? 0) - Number(e.amount_paid ?? 0);
              return (
                <tr key={e.id} className="border-b border-gray-200">
                  <td className="py-1.5 pr-4">{new Date(e.created_at).toLocaleDateString()}</td>
                  <td className="py-1.5 pr-4 capitalize">{e.encounter_type || "visit"}</td>
                  <td className="py-1.5 pr-4 capitalize">{e.status || "—"}</td>
                  <td className="py-1.5 pr-4 capitalize">{e.payment_mode || "—"}</td>
                  <td className={`py-1.5 text-right tabular-nums ${bal > 0 ? "font-bold" : ""}`}>
                    {bal.toFixed(2)}
                  </td>
                </tr>
              );
            })}
            {[...Array(Math.max(0, 5 - encounters.length))].map((_, i) => (
              <tr key={`blank-${i}`} className="border-b border-gray-200">
                <td className="py-2 pr-4 text-gray-200">— — —</td>
                <td className="py-2 pr-4 text-gray-200">— — —</td>
                <td className="py-2 pr-4 text-gray-200">— — —</td>
                <td className="py-2 pr-4 text-gray-200">— — —</td>
                <td className="py-2 text-gray-200 text-right">— — —</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="border-t border-gray-300 pt-3 mt-3 text-xs text-gray-400 text-center">
        This card is the property of AegisCare / LabTrack. Please bring it to every visit.
      </div>
    </div>
  );
}

function CardField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-gray-400">{label}</div>
      <div className="font-medium">{value}</div>
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

type Insurer = {
  id: string;
  name: string;
  code: string;
  coverage_percentage: number;
  coverage_rule: "percentage" | "fixed_per_visit" | "percentage_with_cap";
  per_visit_limit: number | null;
};
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

function BreakGlassDialog({
  patientId,
  patientName,
  userId,
  userEmail,
}: {
  patientId: string;
  patientName: string;
  userId: string;
  userEmail: string;
}) {
  const [open, setOpen] = useState(false);
  const [justification, setJustification] = useState("");
  const [saving, setSaving] = useState(false);
  const [accessed, setAccessed] = useState(false);

  async function handleAccess() {
    if (!justification.trim()) {
      toast.error("A justification is required to proceed.");
      return;
    }
    setSaving(true);
    const { error } = await db.rpc("log_break_glass_access", {
      p_patient_id: patientId,
      p_justification: justification.trim(),
      p_accessed_by: userId,
      p_accessor_email: userEmail,
    } as never);
    setSaving(false);
    if (error) {
      toast.error("Failed to log access: " + error.message);
      return;
    }
    setAccessed(true);
    toast.warning(`Break-glass access granted for ${patientName}. This access has been logged.`);
  }

  function handleClose() {
    setOpen(false);
    setJustification("");
    setAccessed(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) handleClose();
        else setOpen(true);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <ShieldAlert className="mr-1 h-4 w-4" />
          Emergency Access
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <ShieldAlert className="h-5 w-5" />
            Break-Glass Emergency Access
          </DialogTitle>
        </DialogHeader>
        {!accessed ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              ⚠ This access will be permanently logged in the audit trail with your name, timestamp,
              and justification. Use only in a clinical emergency.
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bg-justification">
                Emergency justification <span className="text-destructive">*</span>
              </Label>
              <textarea
                id="bg-justification"
                rows={4}
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                placeholder="Describe the clinical emergency requiring immediate access to this patient record…"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Minimum detail required: clinical reason, patient condition, your role in this
                emergency.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleAccess}
                disabled={saving || !justification.trim()}
              >
                {saving ? "Logging access…" : "Confirm Emergency Access"}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400">
              ✅ Access granted and logged. Your justification has been permanently recorded in the
              audit trail under event type BREAK_GLASS.
            </div>
            <DialogFooter>
              <Button onClick={handleClose}>Close</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

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
    db.from("insurance_providers")
      .select("id,name,code,coverage_percentage,coverage_rule,per_visit_limit")
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
  const {
    insuranceCovered,
    patientDue,
    limitReached: insuranceLimitReached,
  } = calcInsuranceCoverage(subtotal, mode, insurer ?? null);

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
                        {i.name} ·{" "}
                        {i.coverage_rule === "fixed_per_visit"
                          ? `KSh ${Number(i.per_visit_limit ?? 0).toLocaleString()} / visit`
                          : i.coverage_rule === "percentage_with_cap"
                            ? `${i.coverage_percentage}% ≤ KSh ${Number(i.per_visit_limit ?? 0).toLocaleString()}`
                            : `${i.coverage_percentage}%`}
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
