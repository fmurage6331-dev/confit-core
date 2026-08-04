/**
 * LabTrack — Appointments Module
 * Room-based booking with morning/afternoon sessions,
 * doctor linking, day/week calendar, and auto check-in → encounter
 */

import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/lib/supabase-untyped";
import { AppShell } from "@/components/app-shell";
import { PermGuard } from "@/lib/require-access";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { toast } from "sonner";
import {
  CalendarDays,
  Plus,
  UserCheck,
  X,
  AlertTriangle,
  Clock,
  CalendarRange,
} from "lucide-react";
import { format, addDays, startOfWeek } from "date-fns";

export const Route = createFileRoute("/appointments")({
  component: () => (
    <AppShell>
      <PermGuard perm="appointments_view">
        <AppointmentsPage />
      </PermGuard>
    </AppShell>
  ),
});

/* ── Types ── */
type Appointment = {
  id: string;
  appointment_number: number | null;
  scheduled_at: string;
  session: "morning" | "afternoon" | "full_day";
  status: string;
  reason: string | null;
  notes: string | null;
  clinician_name: string | null;
  provider_id: string | null;
  checked_in_at: string | null;
  cancellation_reason: string | null;
  max_patients: number | null;
  room_id: string | null;
  patient_id: string | null;
  encounter_id: string | null;
  patient_name: string | null;
  phone: string | null;
  file_number: string | null;
  room_name: string | null;
  room_kind: string | null;
};

type Room = { id: string; name: string; kind: string };

type ClinicalUser = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  role: string;
};

type Patient = {
  id: string;
  patient_name: string | null;
  file_number: string | null;
  phone: string | null;
};

const SESSION_LABELS: Record<string, string> = {
  morning: "Morning (8am–12pm)",
  afternoon: "Afternoon (2pm–5pm)",
  full_day: "Full Day",
};

const STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-800 border-blue-200",
  confirmed: "bg-green-100 text-green-800 border-green-200",
  checked_in: "bg-primary/10 text-primary border-primary/20",
  completed: "bg-gray-100 text-gray-600 border-gray-200",
  cancelled: "bg-red-100 text-red-700 border-red-200",
  no_show: "bg-amber-100 text-amber-700 border-amber-200",
};

/* ══════════════════════════════════════════════════════════
   MAIN PAGE
   ══════════════════════════════════════════════════════════ */
function AppointmentsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const today = new Date().toISOString().split("T")[0];

  const [calView, setCalView] = useState<"day" | "week">("day");
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedWeekStart, setSelectedWeekStart] = useState(
    startOfWeek(new Date(), { weekStartsOn: 1 }).toISOString().split("T")[0],
  );
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [openBook, setOpenBook] = useState(false);
  const [openCancel, setOpenCancel] = useState<Appointment | null>(null);

  /* ── Rooms ── */
  const { data: rooms = [] } = useQuery<Room[]>({
    queryKey: ["appt-rooms"],
    queryFn: async () => {
      const { data } = await supabase
        .from("rooms")
        .select("id,name,kind")
        .eq("is_active", true)
        .order("name");
      return (data ?? []) as Room[];
    },
  });

  /* ── Clinical users (doctors) ── */
  const { data: clinicians = [] } = useQuery<ClinicalUser[]>({
    queryKey: ["appt-clinicians"],
    queryFn: async () => {
      const { data: rows } = await db
        .from("profiles")
        .select("id,first_name,last_name,username,user_roles(role)");
      const profileRows = (rows ?? []) as Array<Record<string, unknown>>;
      const clinical = profileRows.filter((r) => {
        const roles = Array.isArray(r.user_roles) ? (r.user_roles as Array<{ role: string }>) : [];
        return roles.some((ur) =>
          [
            "doctor",
            "clinical_officer",
            "dental_officer",
            "nurse",
            "triage_nurse",
            "radiologist",
            "pharmacist",
            "nutritionist",
            "physiotherapist",
            "hts_counsellor",
            "admin",
            "system_admin",
          ].includes(ur.role),
        );
      });
      return clinical.map((r) => ({
        id: r.id as string,
        first_name: r.first_name as string | null,
        last_name: r.last_name as string | null,
        username: r.username as string | null,
        role: (r.user_roles as Array<{ role: string }> | undefined)?.[0]?.role ?? "",
      }));
    },
  });

  /* ── Appointments for selected date (day view) ── */
  const { data: dayAppointments = [], isLoading: dayLoading } = useQuery<Appointment[]>({
    queryKey: ["appointments-day", selectedDate],
    queryFn: async () => {
      const start = `${selectedDate}T00:00:00`;
      const end = `${selectedDate}T23:59:59`;
      const { data } = await db
        .from("appointments_view")
        .select("*")
        .gte("scheduled_at", start)
        .lte("scheduled_at", end)
        .order("appointment_number");
      return (data ?? []) as Appointment[];
    },
  });

  /* ── Appointments for selected week (week view) ── */
  const { data: weekAppointments = [], isLoading: weekLoading } = useQuery<Appointment[]>({
    queryKey: ["appointments-week", selectedWeekStart, selectedRoomId],
    enabled: calView === "week",
    queryFn: async () => {
      const weekEnd = addDays(new Date(selectedWeekStart), 6).toISOString().split("T")[0];
      let query = db
        .from("appointments_view")
        .select("*")
        .gte("scheduled_at", `${selectedWeekStart}T00:00:00`)
        .lte("scheduled_at", `${weekEnd}T23:59:59`);
      if (selectedRoomId) query = query.eq("room_id", selectedRoomId);
      const { data } = await query.order("scheduled_at");
      return (data ?? []) as Appointment[];
    },
  });

  /* ── Check-in mutation ── */
  const checkIn = useMutation({
    mutationFn: async (appointmentId: string) => {
      const { data, error } = await supabase.rpc(
        "create_encounter_from_appointment" as never,
        { p_appointment_id: appointmentId } as never,
      );
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Patient checked in — encounter created and sent to room queue");
      qc.invalidateQueries({ queryKey: ["appointments-day"] });
      qc.invalidateQueries({ queryKey: ["appointments-week"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  /* ── Cancel mutation ── */
  const cancelAppt = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { error } = await db
        .from("appointments")
        .update({ status: "cancelled", cancellation_reason: reason })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Appointment cancelled");
      setOpenCancel(null);
      qc.invalidateQueries({ queryKey: ["appointments-day"] });
      qc.invalidateQueries({ queryKey: ["appointments-week"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  /* ── No-show mutation ── */
  const markNoShow = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("appointments")
        .update({ status: "no_show" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Marked as no-show");
      qc.invalidateQueries({ queryKey: ["appointments-day"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  /* ── Day view: group by room + session ── */
  const dayMatrix = useMemo(() => {
    const matrix: Record<string, Record<string, Appointment[]>> = {};
    dayAppointments.forEach((a) => {
      const room = a.room_name ?? "Unknown";
      const session = a.session ?? "morning";
      if (!matrix[room]) matrix[room] = { morning: [], afternoon: [], full_day: [] };
      matrix[room][session].push(a);
    });
    return matrix;
  }, [dayAppointments]);

  /* ── Week view: group by date ── */
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(new Date(selectedWeekStart), i);
      return d.toISOString().split("T")[0];
    });
  }, [selectedWeekStart]);

  const weekMatrix = useMemo(() => {
    const matrix: Record<string, Record<string, Appointment[]>> = {};
    weekDays.forEach((d) => {
      matrix[d] = { morning: [], afternoon: [], full_day: [] };
    });
    weekAppointments.forEach((a) => {
      const d = a.scheduled_at.split("T")[0];
      const session = a.session ?? "morning";
      if (matrix[d]) matrix[d][session].push(a);
    });
    return matrix;
  }, [weekAppointments, weekDays]);

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["appointments-day"] });
    qc.invalidateQueries({ queryKey: ["appointments-week"] });
  };

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <CalendarDays className="h-8 w-8 text-primary" />
            Appointments
          </h1>
          <p className="text-muted-foreground text-sm">
            Room-based booking — Morning & Afternoon sessions
          </p>
        </div>
        <Button onClick={() => setOpenBook(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Book Appointment
        </Button>
      </div>

      {/* ── View toggle + date controls ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border overflow-hidden">
          <button
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              calView === "day" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            }`}
            onClick={() => setCalView("day")}
          >
            <Clock className="inline h-4 w-4 mr-1" />
            Day
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              calView === "week" ? "bg-primary text-primary-foreground" : "hover:bg-muted"
            }`}
            onClick={() => setCalView("week")}
          >
            <CalendarRange className="inline h-4 w-4 mr-1" />
            Week
          </button>
        </div>

        {calView === "day" && (
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-40"
          />
        )}

        {calView === "week" && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setSelectedWeekStart(
                  addDays(new Date(selectedWeekStart), -7).toISOString().split("T")[0],
                )
              }
            >
              ← Prev
            </Button>
            <span className="text-sm font-medium">
              Week of {format(new Date(selectedWeekStart), "dd MMM yyyy")}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setSelectedWeekStart(
                  addDays(new Date(selectedWeekStart), 7).toISOString().split("T")[0],
                )
              }
            >
              Next →
            </Button>
            <Select
              value={selectedRoomId ?? "all"}
              onValueChange={(v) => setSelectedRoomId(v === "all" ? null : v)}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All rooms" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All rooms</SelectItem>
                {rooms.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* ══ DAY VIEW ══ */}
      {calView === "day" && (
        <div className="space-y-4">
          {dayLoading && <div className="text-center py-12 text-muted-foreground">Loading…</div>}
          {!dayLoading && Object.keys(dayMatrix).length === 0 && (
            <div className="rounded-xl border bg-card p-12 text-center text-muted-foreground">
              No appointments for {format(new Date(selectedDate), "dd MMM yyyy")}
            </div>
          )}
          {Object.entries(dayMatrix).map(([roomName, sessions]) => (
            <div key={roomName} className="rounded-xl border bg-card overflow-hidden">
              <div className="bg-muted/40 px-6 py-3 flex items-center gap-2 border-b">
                <CalendarDays className="h-4 w-4 text-primary" />
                <span className="font-semibold">{roomName}</span>
                <span className="text-xs text-muted-foreground ml-auto">
                  {Object.values(sessions).flat().length} appointment
                  {Object.values(sessions).flat().length !== 1 ? "s" : ""}
                </span>
              </div>
              {(["morning", "afternoon", "full_day"] as const).map((session) => {
                const appts = sessions[session] ?? [];
                if (appts.length === 0) return null;
                const capacity = appts[0]?.max_patients ?? 20;
                const pct = (appts.length / capacity) * 100;
                const capacityColor =
                  pct >= 100 ? "text-red-600" : pct >= 80 ? "text-amber-600" : "text-emerald-600";
                return (
                  <div key={session} className="border-b last:border-0">
                    <div className="flex items-center justify-between px-6 py-2 bg-muted/20">
                      <span className="text-sm font-medium capitalize">
                        {SESSION_LABELS[session]}
                      </span>
                      <span className={`text-xs font-medium ${capacityColor}`}>
                        {appts.length}/{capacity} booked
                      </span>
                    </div>
                    <div className="divide-y">
                      {appts.map((appt) => (
                        <AppointmentRow
                          key={appt.id}
                          appt={appt}
                          onCheckIn={() => checkIn.mutate(appt.id)}
                          onCancel={() => setOpenCancel(appt)}
                          onNoShow={() => markNoShow.mutate(appt.id)}
                          checkInPending={checkIn.isPending}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* ══ WEEK VIEW ══ */}
      {calView === "week" && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 border-b">
                  <th className="px-4 py-3 text-left text-xs uppercase tracking-wide text-muted-foreground w-24">
                    Session
                  </th>
                  {weekDays.map((d) => (
                    <th
                      key={d}
                      className={`px-4 py-3 text-center text-xs font-medium ${
                        d === today ? "text-primary" : "text-muted-foreground"
                      }`}
                    >
                      <div className="uppercase tracking-wide">{format(new Date(d), "EEE")}</div>
                      <div
                        className={`text-lg font-bold mt-0.5 ${
                          d === today ? "text-primary" : "text-foreground"
                        }`}
                      >
                        {format(new Date(d), "d")}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(["morning", "afternoon"] as const).map((session) => (
                  <tr key={session} className="border-b last:border-0">
                    <td className="px-4 py-4 text-xs font-medium text-muted-foreground capitalize align-top">
                      {session}
                    </td>
                    {weekDays.map((d) => {
                      const appts = weekMatrix[d]?.[session] ?? [];
                      const capacity = appts[0]?.max_patients ?? 20;
                      const pct = (appts.length / capacity) * 100;
                      const bg =
                        appts.length === 0
                          ? ""
                          : pct >= 100
                            ? "bg-red-50 border border-red-200"
                            : pct >= 80
                              ? "bg-amber-50 border border-amber-200"
                              : "bg-emerald-50 border border-emerald-200";
                      return (
                        <td
                          key={d}
                          className="px-2 py-3 text-center align-top"
                          onClick={() => {
                            setSelectedDate(d);
                            setCalView("day");
                          }}
                        >
                          <div
                            className={`rounded-lg p-2 cursor-pointer hover:opacity-80 transition-opacity ${bg}`}
                          >
                            {appts.length > 0 ? (
                              <>
                                <div className="text-lg font-bold">{appts.length}</div>
                                <div className="text-[10px] text-muted-foreground">/{capacity}</div>
                              </>
                            ) : (
                              <div className="text-muted-foreground text-xs">—</div>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-3 border-t text-xs text-muted-foreground flex items-center gap-4">
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded bg-emerald-100 border border-emerald-200" />
              Available
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded bg-amber-100 border border-amber-200" />
              ≥80% full
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded bg-red-100 border border-red-200" />
              Full
            </span>
            <span className="ml-auto">Click a cell to see day detail</span>
          </div>
        </div>
      )}

      {/* ── Book Appointment Dialog ── */}
      {openBook && (
        <BookAppointmentDialog
          rooms={rooms}
          clinicians={clinicians}
          onClose={() => setOpenBook(false)}
          onSaved={() => {
            setOpenBook(false);
            invalidateAll();
          }}
          currentUserId={user?.id ?? ""}
        />
      )}

      {/* ── Cancel Dialog ── */}
      {openCancel && (
        <CancelDialog
          appt={openCancel}
          onClose={() => setOpenCancel(null)}
          onConfirm={(reason) => cancelAppt.mutate({ id: openCancel.id, reason })}
          isPending={cancelAppt.isPending}
        />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   APPOINTMENT ROW
   ══════════════════════════════════════════════════════════ */
function AppointmentRow({
  appt,
  onCheckIn,
  onCancel,
  onNoShow,
  checkInPending,
}: {
  appt: Appointment;
  onCheckIn: () => void;
  onCancel: () => void;
  onNoShow: () => void;
  checkInPending: boolean;
}) {
  const isActionable = !["checked_in", "completed", "cancelled", "no_show"].includes(appt.status);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 hover:bg-muted/30">
      <div className="flex items-center gap-4">
        <div className="text-xl font-mono font-bold text-primary w-12">
          {appt.appointment_number ? String(appt.appointment_number).padStart(3, "0") : "—"}
        </div>
        <div>
          <div className="font-medium">{appt.patient_name ?? "—"}</div>
          <div className="text-xs text-muted-foreground">
            {appt.file_number && `File #${appt.file_number} · `}
            {appt.phone && `${appt.phone} · `}
            {appt.clinician_name && `Dr. ${appt.clinician_name}`}
          </div>
          {appt.reason && (
            <div className="text-xs text-muted-foreground mt-0.5">Reason: {appt.reason}</div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${
            STATUS_COLORS[appt.status] ?? "bg-gray-100 text-gray-600"
          }`}
        >
          {appt.status.replace("_", " ")}
        </span>

        {isActionable && (
          <>
            <Button size="sm" onClick={onCheckIn} disabled={checkInPending}>
              <UserCheck className="mr-1 h-3 w-3" />
              Check In
            </Button>
            <Button size="sm" variant="outline" onClick={onNoShow}>
              No Show
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={onCancel}
            >
              <X className="h-3 w-3" />
            </Button>
          </>
        )}

        {appt.status === "checked_in" && appt.encounter_id && (
          <Button size="sm" variant="outline" asChild>
            <a href={`/encounter-records/${appt.encounter_id}`}>Open Encounter</a>
          </Button>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   BOOK APPOINTMENT DIALOG
   ══════════════════════════════════════════════════════════ */
function BookAppointmentDialog({
  rooms,
  clinicians,
  onClose,
  onSaved,
  currentUserId,
}: {
  rooms: Room[];
  clinicians: ClinicalUser[];
  onClose: () => void;
  onSaved: () => void;
  currentUserId: string;
}) {
  const [search, setSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [roomId, setRoomId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [session, setSession] = useState<"morning" | "afternoon">("morning");
  const [providerId, setProviderId] = useState("");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: patients = [] } = useQuery<Patient[]>({
    queryKey: ["patient-search-appt", search],
    enabled: search.trim().length > 2,
    queryFn: async () => {
      const { data } = await supabase
        .from("patients")
        .select("id,patient_name,file_number,phone")
        .ilike("patient_name", `%${search.trim()}%`)
        .limit(10);
      return (data ?? []) as Patient[];
    },
  });

  /* Check capacity before booking */
  const { data: capacityCount } = useQuery<number>({
    queryKey: ["appt-capacity", roomId, date, session],
    enabled: !!roomId && !!date && !!session,
    queryFn: async () => {
      const start = `${date}T00:00:00`;
      const end = `${date}T23:59:59`;
      const { count } = await db
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("room_id", roomId)
        .eq("session", session)
        .gte("scheduled_at", start)
        .lte("scheduled_at", end)
        .in("status", ["scheduled", "confirmed", "checked_in"]);
      return count ?? 0;
    },
  });

  const isFull = (capacityCount ?? 0) >= 20;

  async function save() {
    if (!selectedPatient) {
      toast.error("Select a patient");
      return;
    }
    if (!roomId) {
      toast.error("Select a room");
      return;
    }
    if (!providerId) {
      toast.error("Select a clinician");
      return;
    }
    if (!reason.trim()) {
      toast.error("Reason for visit is required");
      return;
    }
    if (isFull) {
      toast.error("This session is full (20/20)");
      return;
    }

    setSaving(true);

    const hour = session === "morning" ? 9 : 14;
    const scheduledAt = new Date(date);
    scheduledAt.setHours(hour, 0, 0, 0);

    const selectedClinician = clinicians.find((c) => c.id === providerId);
    const clinicianName = selectedClinician
      ? `${selectedClinician.first_name ?? ""} ${selectedClinician.last_name ?? ""}`.trim()
      : null;

    const { error } = await supabase.from("appointments").insert({
      patient_id: selectedPatient.id,
      room_id: roomId,
      provider_id: providerId,
      clinician_name: clinicianName,
      scheduled_at: scheduledAt.toISOString(),
      session,
      reason: reason.trim(),
      notes: notes.trim() || null,
      status: "scheduled",
      created_by: currentUserId || null,
    } as never);

    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Appointment booked successfully");
    onSaved();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Book New Appointment</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Patient search */}
          <div>
            <Label>Search Patient *</Label>
            <Input
              placeholder="Type at least 3 characters…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSelectedPatient(null);
              }}
            />
            {patients.length > 0 && !selectedPatient && (
              <div className="mt-1 rounded-lg border bg-background shadow-md z-10">
                {patients.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                    onClick={() => {
                      setSelectedPatient(p);
                      setSearch(p.patient_name ?? "");
                    }}
                  >
                    <span className="font-medium">{p.patient_name}</span>
                    {p.file_number && (
                      <span className="ml-2 text-xs text-muted-foreground">#{p.file_number}</span>
                    )}
                    {p.phone && (
                      <span className="ml-2 text-xs text-muted-foreground">{p.phone}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
            {selectedPatient && (
              <div className="mt-1 flex items-center gap-2 rounded-lg bg-primary/5 border border-primary/20 px-3 py-2 text-sm">
                <UserCheck className="h-4 w-4 text-primary" />
                <span className="font-medium">{selectedPatient.patient_name}</span>
                {selectedPatient.file_number && (
                  <span className="text-xs text-muted-foreground">
                    #{selectedPatient.file_number}
                  </span>
                )}
                <button
                  type="button"
                  className="ml-auto text-muted-foreground hover:text-destructive"
                  onClick={() => {
                    setSelectedPatient(null);
                    setSearch("");
                  }}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>

          {/* Room */}
          <div>
            <Label>Room *</Label>
            <Select value={roomId} onValueChange={setRoomId}>
              <SelectTrigger>
                <SelectValue placeholder="Select room" />
              </SelectTrigger>
              <SelectContent>
                {rooms.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                    <span className="ml-1 text-xs text-muted-foreground capitalize">
                      ({r.kind})
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date + Session */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Date *</Label>
              <Input
                type="date"
                value={date}
                min={new Date().toISOString().split("T")[0]}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div>
              <Label>Session *</Label>
              <Select
                value={session}
                onValueChange={(v) => setSession(v as "morning" | "afternoon")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="morning">Morning (8am–12pm)</SelectItem>
                  <SelectItem value="afternoon">Afternoon (2pm–5pm)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Capacity warning */}
          {isFull && (
            <div className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              This session is full (20/20). Choose a different room, date or session.
            </div>
          )}
          {!isFull && capacityCount !== undefined && capacityCount >= 16 && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              Session almost full ({capacityCount}/20 booked).
            </div>
          )}

          {/* Clinician */}
          <div>
            <Label>Clinician *</Label>
            <Select value={providerId} onValueChange={setProviderId}>
              <SelectTrigger>
                <SelectValue placeholder="Select clinician" />
              </SelectTrigger>
              <SelectContent>
                {clinicians.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.first_name} {c.last_name}
                    {c.username && (
                      <span className="ml-1 text-xs text-muted-foreground">@{c.username}</span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Reason */}
          <div>
            <Label>Reason for Visit *</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Follow-up, chest pain, ANC visit…"
            />
          </div>

          {/* Notes */}
          <div>
            <Label>Additional Notes</Label>
            <Textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any special instructions…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || isFull}>
            {saving ? "Booking…" : "Book Appointment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ══════════════════════════════════════════════════════════
   CANCEL DIALOG
   ══════════════════════════════════════════════════════════ */
function CancelDialog({
  appt,
  onClose,
  onConfirm,
  isPending,
}: {
  appt: Appointment;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  isPending: boolean;
}) {
  const [reason, setReason] = useState("");

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Cancel Appointment</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm text-muted-foreground">
            Cancelling appointment for{" "}
            <span className="font-medium text-foreground">{appt.patient_name}</span>.
          </p>
          <div>
            <Label>Reason for cancellation</Label>
            <Textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Patient requested / clinician unavailable…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Back
          </Button>
          <Button
            variant="destructive"
            onClick={() => onConfirm(reason)}
            disabled={isPending || !reason.trim()}
          >
            {isPending ? "Cancelling…" : "Confirm Cancel"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
