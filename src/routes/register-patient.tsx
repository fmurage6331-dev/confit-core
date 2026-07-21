/**
 * LabTrack — Laboratory Records
 * Copyright (c) 2026 Francis Muhoro. All rights reserved.
 * Author: Francis Muhoro
 */

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { PermGuard } from "@/lib/require-access";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Banknote, Shield, HeartHandshake, Trash2, Plus } from "lucide-react";

export const Route = createFileRoute("/register-patient")({
  component: () => <AppShell><PermGuard perm="register_patient"><RegisterPatient /></PermGuard></AppShell>,
});

type Insurer = { id: string; name: string; code: string; coverage_percentage: number };
type TestRow = { id: string; name: string; price: number; cash_price: number | null; insurance_price: number | null; kind: string; category: string | null };
type Room = { id: string; name: string; kind: string };
type PaymentMode = "cash" | "insurance" | "free";
type Relationship = { relation: string; name: string; contact: string };

const SECTIONS = [
  { id: "basic", label: "Basic Info" },
  { id: "contact", label: "Contact Details" },
  { id: "demographics", label: "Demographics" },
  { id: "death", label: "Death Info" },
  { id: "relationships", label: "Relationships" },
  { id: "nextofkin", label: "Next of Kin" },
  { id: "visit", label: "Visit & Charges" },
];

function RegisterPatient() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [insurers, setInsurers] = useState<Insurer[]>([]);
  const [tests, setTests] = useState<TestRow[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);

  // Basic
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [familyName, setFamilyName] = useState("");
  const [sex, setSex] = useState<"male" | "female" | "">("");
  const [dobKnown, setDobKnown] = useState(true);
  const [dob, setDob] = useState("");
  const [estimatedAge, setEstimatedAge] = useState("");
  const [fileNumber, setFileNumber] = useState("");

  // Contact
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [addr1, setAddr1] = useState("");
  const [addr2, setAddr2] = useState("");
  const [city, setCity] = useState("");
  const [county, setCounty] = useState("");
  const [postal, setPostal] = useState("");
  const [country, setCountry] = useState("Kenya");

  // Demographics
  const [occupation, setOccupation] = useState("");
  const [marital, setMarital] = useState("");
  const [nationality, setNationality] = useState("");
  const [religion, setReligion] = useState("");
  const [education, setEducation] = useState("");

  // Death
  const [isDeceased, setIsDeceased] = useState(false);
  const [dod, setDod] = useState("");
  const [causeOfDeath, setCauseOfDeath] = useState("");

  // Relationships
  const [relationships, setRelationships] = useState<Relationship[]>([]);

  // Next of kin
  const [kinName, setKinName] = useState("");
  const [kinRelation, setKinRelation] = useState("");
  const [kinPhone, setKinPhone] = useState("");
  const [kinAddress, setKinAddress] = useState("");

  // Visit
  const [fromRoom, setFromRoom] = useState("");
  const [sendToRoomId, setSendToRoomId] = useState("");
  const [mode, setMode] = useState<PaymentMode>("cash");
  const [insurerId, setInsurerId] = useState("");
  const [isEmergency, setIsEmergency] = useState(false);
  const [referralDirection, setReferralDirection] = useState<"" | "in" | "out">("");
  const [selectedTestIds, setSelectedTestIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase.from("insurance_providers").select("id,name,code,coverage_percentage")
      .eq("is_active", true).order("name").then(({ data }) => setInsurers(data ?? []));
    supabase.from("lab_test_catalog").select("id,name,price,cash_price,insurance_price,kind,category")
      .eq("is_active", true).order("name").then(({ data }) => setTests((data ?? []) as TestRow[]));
    supabase.from("rooms").select("id,name,kind")
      .eq("is_active", true).order("name").then(({ data }) => setRooms((data ?? []) as Room[]));
  }, []);

  const priceFor = (t: TestRow) => {
    if (mode === "insurance") return Number(t.insurance_price ?? t.cash_price ?? t.price ?? 0);
    return Number(t.cash_price ?? t.price ?? 0);
  };

  const insurer = insurers.find((i) => i.id === insurerId);
  const selectedTests = useMemo(() => tests.filter((t) => selectedTestIds.has(t.id)), [tests, selectedTestIds]);
  const subtotal = selectedTests.reduce((s, t) => s + priceFor(t), 0);
  const coveragePct = mode === "insurance" && insurer ? Number(insurer.coverage_percentage) : 0;
  const insuranceCovered = mode === "insurance" ? +(subtotal * coveragePct / 100).toFixed(2) : 0;
  const patientDue = mode === "free" ? 0 : +(subtotal - insuranceCovered).toFixed(2);

  const toggleTest = (id: string) => setSelectedTestIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!firstName.trim() || !familyName.trim()) { toast.error("First and Family name are required"); scrollTo("basic"); return; }
    if (!sex) { toast.error("Please select sex"); scrollTo("basic"); return; }
    
    if (!sendToRoomId) { toast.error("Select the consultation/triage room to send patient to"); scrollTo("visit"); return; }
    if (mode === "insurance" && !insurer) { toast.error("Select an insurance provider"); scrollTo("visit"); return; }

    setSubmitting(true);
    const patientName = [firstName, middleName, familyName].filter(Boolean).join(" ").trim();
    const hasTests = selectedTests.length > 0;
    const { error } = await supabase.from("patient_registrations").insert({
      patient_name: patientName,
      first_name: firstName.trim(),
      middle_name: middleName.trim() || null,
      family_name: familyName.trim(),
      sex,
      dob_known: dobKnown,
      date_of_birth: dobKnown && dob ? dob : null,
      estimated_age: !dobKnown && estimatedAge ? Number(estimatedAge) : null,
      phone: phone || null,
      email: email || null,
      // file_number is auto-generated by a database trigger — do not send
      address_line1: addr1 || null,
      address_line2: addr2 || null,
      city: city || null,
      county: county || null,
      postal_code: postal || null,
      country: country || null,
      occupation: occupation || null,
      marital_status: marital || null,
      nationality: nationality || null,
      religion: religion || null,
      education_level: education || null,
      is_deceased: isDeceased,
      date_of_death: isDeceased && dod ? dod : null,
      cause_of_death: isDeceased ? (causeOfDeath || null) : null,
      relationships,
      next_of_kin: { name: kinName, relation: kinRelation, phone: kinPhone, address: kinAddress },
      from_room: fromRoom || "Reception",
      current_room_id: sendToRoomId,
      payment_mode: mode,
      insurance_provider_id: mode === "insurance" ? insurer!.id : null,
      insurance_coverage_percentage: mode === "insurance" ? coveragePct : null,
      is_emergency: isEmergency,
      referral_direction: referralDirection || null,
      tests: selectedTests.map((t) => ({ id: t.id, name: t.name, price: priceFor(t) })),
      subtotal, insurance_covered: insuranceCovered, patient_due: patientDue,
      payment_status: mode === "free" || !hasTests ? "waived" : "unpaid",
      amount_paid: 0,
      created_by: user!.id,
    } as never);
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success(hasTests ? "Patient registered" : "Patient sent to consultation");
    navigate({ to: "/queue" });
  }

  const YesNo = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
    <div className="inline-flex overflow-hidden rounded-md border">
      <button type="button" onClick={() => onChange(true)}
        className={`px-4 py-1.5 text-sm ${value ? "bg-primary/10 text-primary border-primary" : "bg-background"}`}>Yes</button>
      <button type="button" onClick={() => onChange(false)}
        className={`px-4 py-1.5 text-sm border-l ${!value ? "bg-primary/10 text-primary border-primary" : "bg-background"}`}>No</button>
    </div>
  );

  return (
    <form onSubmit={onSubmit} className="relative">
      {/* Sticky top bar */}
      <div className="sticky top-0 z-10 -mx-4 mb-6 flex items-center justify-between border-b bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <h1 className="text-lg font-semibold">Register patient</h1>
        <Button type="submit" size="sm" disabled={submitting} className="bg-slate-900 text-white hover:bg-slate-800">
          {submitting ? "Saving…" : "Add Patient"}
        </Button>
      </div>

      <div className="mb-4 flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
        <span className="text-amber-900">
          Already registered? Search first to avoid creating a duplicate patient.
        </span>
        <Button asChild variant="outline" size="sm" className="border-amber-300 bg-white">
          <Link to="/patients">Search patients</Link>
        </Button>
      </div>


      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        {/* Left rail */}
        <aside className="lg:sticky lg:top-20 lg:h-fit">
          <h2 className="text-xl font-semibold">Create new patient</h2>
          <p className="mt-4 text-xs uppercase tracking-wide text-muted-foreground">Jump to</p>
          <nav className="mt-2 space-y-1 text-sm">
            {SECTIONS.map((s) => (
              <button key={s.id} type="button" onClick={() => scrollTo(s.id)}
                className="flex w-full items-center gap-2 rounded px-1 py-1 text-left text-emerald-700 hover:bg-emerald-50">
                <span className="text-muted-foreground">↳</span> {s.label}
              </button>
            ))}
          </nav>
          <div className="mt-6 space-y-2">
            <Button type="submit" disabled={submitting} className="w-full bg-emerald-700 hover:bg-emerald-800">
              {submitting ? "Saving…" : "Register patient"}
            </Button>
            <Button type="button" variant="outline" className="w-full text-emerald-700" onClick={() => navigate({ to: "/queue" })}>
              Cancel
            </Button>
          </div>
        </aside>

        {/* Sections */}
        <div className="space-y-6">
          {/* Basic Info */}
          <Section id="basic" number="1" title="Basic Info" hint="All fields are required unless marked optional">
            <Group title="Full Name">
              <Field label="First Name" required><Input value={firstName} onChange={(e) => setFirstName(e.target.value)} /></Field>
              <Field label="Middle Name (optional)"><Input value={middleName} onChange={(e) => setMiddleName(e.target.value)} /></Field>
              <Field label="Family Name" required><Input value={familyName} onChange={(e) => setFamilyName(e.target.value)} /></Field>
            </Group>

            <Group title="Sex">
              <div className="space-y-2">
                <Label>Sex</Label>
                <div className="space-y-1">
                  {(["male", "female"] as const).map((v) => (
                    <label key={v} className="flex items-center gap-2 text-sm capitalize">
                      <input type="radio" name="sex" value={v} checked={sex === v} onChange={() => setSex(v)} />
                      {v}
                    </label>
                  ))}
                </div>
              </div>
            </Group>

            <Group title="Birth">
              <div className="space-y-2">
                <Label>Date of Birth Known?</Label>
                <YesNo value={dobKnown} onChange={setDobKnown} />
              </div>
              {dobKnown ? (
                <Field label="Date of birth"><Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} /></Field>
              ) : (
                <Field label="Estimated age (years)"><Input type="number" min={0} value={estimatedAge} onChange={(e) => setEstimatedAge(e.target.value)} /></Field>
              )}
              <Field label="File number">
                <Input value={fileNumber} readOnly disabled placeholder="Auto-generated on save (e.g. P001234)" />
              </Field>
            </Group>
          </Section>

          {/* Contact */}
          <Section id="contact" number="2" title="Contact Details">
            <Group title="Reach">
              <Field label="Phone"><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
              <Field label="Email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
            </Group>
            <Group title="Address">
              <Field label="Address line 1"><Input value={addr1} onChange={(e) => setAddr1(e.target.value)} /></Field>
              <Field label="Address line 2 (optional)"><Input value={addr2} onChange={(e) => setAddr2(e.target.value)} /></Field>
              <Field label="City / Town"><Input value={city} onChange={(e) => setCity(e.target.value)} /></Field>
              <Field label="County"><Input value={county} onChange={(e) => setCounty(e.target.value)} /></Field>
              <Field label="Postal code (optional)"><Input value={postal} onChange={(e) => setPostal(e.target.value)} /></Field>
              <Field label="Country"><Input value={country} onChange={(e) => setCountry(e.target.value)} /></Field>
            </Group>
          </Section>

          {/* Demographics */}
          <Section id="demographics" number="3" title="Demographics">
            <Group title="Background">
              <Field label="Occupation"><Input value={occupation} onChange={(e) => setOccupation(e.target.value)} /></Field>
              <Field label="Marital status">
                <Select value={marital} onValueChange={setMarital}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {["Single", "Married", "Divorced", "Widowed", "Separated"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Nationality"><Input value={nationality} onChange={(e) => setNationality(e.target.value)} /></Field>
              <Field label="Religion (optional)"><Input value={religion} onChange={(e) => setReligion(e.target.value)} /></Field>
              <Field label="Education level">
                <Select value={education} onValueChange={setEducation}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {["None", "Primary", "Secondary", "Tertiary", "University"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </Group>
          </Section>

          {/* Death */}
          <Section id="death" number="4" title="Death Info">
            <Group title="Deceased">
              <div className="space-y-2">
                <Label>Is the patient deceased?</Label>
                <YesNo value={isDeceased} onChange={setIsDeceased} />
              </div>
              {isDeceased && (
                <>
                  <Field label="Date of death"><Input type="date" value={dod} onChange={(e) => setDod(e.target.value)} /></Field>
                  <Field label="Cause of death"><Textarea value={causeOfDeath} onChange={(e) => setCauseOfDeath(e.target.value)} rows={2} /></Field>
                </>
              )}
            </Group>
          </Section>

          {/* Relationships */}
          <Section id="relationships" number="5" title="Relationships">
            <Group title="Family / Contacts">
              <div className="space-y-3">
                {relationships.length === 0 && <p className="text-sm text-muted-foreground">No relationships added.</p>}
                {relationships.map((r, idx) => (
                  <div key={idx} className="grid gap-2 rounded-md border bg-background p-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
                    <Input placeholder="Relation (e.g. Father)" value={r.relation}
                      onChange={(e) => setRelationships((all) => all.map((x, i) => i === idx ? { ...x, relation: e.target.value } : x))} />
                    <Input placeholder="Name" value={r.name}
                      onChange={(e) => setRelationships((all) => all.map((x, i) => i === idx ? { ...x, name: e.target.value } : x))} />
                    <Input placeholder="Contact" value={r.contact}
                      onChange={(e) => setRelationships((all) => all.map((x, i) => i === idx ? { ...x, contact: e.target.value } : x))} />
                    <Button type="button" variant="ghost" size="icon"
                      onClick={() => setRelationships((all) => all.filter((_, i) => i !== idx))}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm"
                  onClick={() => setRelationships((all) => [...all, { relation: "", name: "", contact: "" }])}>
                  <Plus className="mr-1 h-4 w-4" /> Add relationship
                </Button>
              </div>
            </Group>
          </Section>

          {/* Next of kin */}
          <Section id="nextofkin" number="6" title="Next of Kin">
            <Group title="Primary contact">
              <Field label="Full name"><Input value={kinName} onChange={(e) => setKinName(e.target.value)} /></Field>
              <Field label="Relationship"><Input value={kinRelation} onChange={(e) => setKinRelation(e.target.value)} /></Field>
              <Field label="Phone"><Input value={kinPhone} onChange={(e) => setKinPhone(e.target.value)} /></Field>
              <Field label="Address (optional)"><Input value={kinAddress} onChange={(e) => setKinAddress(e.target.value)} /></Field>
            </Group>
          </Section>

          {/* Visit & charges */}
          <Section id="visit" number="7" title="Visit & Charges">
            <Group title="Routing">
              <Field label="Sent from (optional)">
                <Select value={fromRoom} onValueChange={setFromRoom}>
                  <SelectTrigger><SelectValue placeholder="e.g. Reception" /></SelectTrigger>
                  <SelectContent>
                    {rooms.map((r) => <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Send to (consultation / triage)" required>
                <Select value={sendToRoomId} onValueChange={setSendToRoomId}>
                  <SelectTrigger><SelectValue placeholder="Select destination room" /></SelectTrigger>
                  <SelectContent>
                    {rooms.length === 0 && <div className="px-3 py-2 text-sm text-muted-foreground">No active rooms.</div>}
                    {rooms.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}{r.kind === "lab" ? " (Lab)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </Group>

            <Group title="Case type">
              <div className="space-y-2">
                <Label>Emergency case?</Label>
                <YesNo value={isEmergency} onChange={setIsEmergency} />
              </div>
              <Field label="Referral">
                <Select value={referralDirection || "none"} onValueChange={(v) => setReferralDirection(v === "none" ? "" : (v as "in" | "out"))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not a referral</SelectItem>
                    <SelectItem value="in">Referred IN (from another facility)</SelectItem>
                    <SelectItem value="out">Referred OUT (to another facility)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </Group>

            <Group title="Payment">
              <div className="col-span-full flex flex-col gap-3 sm:flex-row">
                <ModeBtn value="cash" label="Cash" icon={Banknote} active={mode === "cash"} on={() => setMode("cash")} cls="bg-emerald-600" />
                <ModeBtn value="insurance" label="Insurance" icon={Shield} active={mode === "insurance"} on={() => setMode("insurance")} cls="bg-blue-600" />
                <ModeBtn value="free" label="Free / Waived" icon={HeartHandshake} active={mode === "free"} on={() => setMode("free")} cls="bg-amber-500" />
              </div>
              {mode === "insurance" && (
                <Field label="Insurance provider">
                  <Select value={insurerId} onValueChange={setInsurerId}>
                    <SelectTrigger><SelectValue placeholder="Select insurer" /></SelectTrigger>
                    <SelectContent>
                      {insurers.map((i) => (
                        <SelectItem key={i.id} value={i.id}>
                          {i.name} <span className="text-xs text-muted-foreground">[{i.code}] · {i.coverage_percentage}%</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
            </Group>

            <Group title="Services / Tests (optional — can be added at consultation)">
              <div className="col-span-full grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {tests.length === 0 && <p className="col-span-full text-sm text-muted-foreground">No services or tests configured yet.</p>}
                {tests.map((t) => {
                  const active = selectedTestIds.has(t.id);
                  return (
                    <button key={t.id} type="button" onClick={() => toggleTest(t.id)}
                      className={`flex flex-col rounded-lg border p-3 text-left transition ${active ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-accent"}`}>
                      <span className="text-sm font-medium">{t.name}</span>
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{t.category || t.kind}</span>
                      <span className="mt-1 text-xs text-muted-foreground">KSh {priceFor(t).toFixed(2)}</span>
                    </button>
                  );
                })}
              </div>
            </Group>


            <Group title="Summary">
              <div className="col-span-full rounded-lg border bg-background p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium">Charge summary</span>
                  <PaymentBadge mode={mode} />
                </div>
                <div className="space-y-1 text-sm">
                  <Row label="Subtotal" value={`KSh ${subtotal.toFixed(2)}`} />
                  {mode === "insurance" && <Row label={`Insurance (${coveragePct}%)`} value={`-KSh ${insuranceCovered.toFixed(2)}`} muted />}
                  {mode === "free" && <Row label="Waived" value={`-KSh ${subtotal.toFixed(2)}`} muted />}
                  <div className="mt-2 flex justify-between border-t pt-2 text-base font-semibold">
                    <span>Patient pays</span>
                    <span className="tabular-nums">KSh {patientDue.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </Group>
          </Section>
        </div>
      </div>
    </form>
  );
}

function Section({ id, number, title, hint, children }: { id: string; number: string; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="mb-3">
        <h3 className="text-base font-semibold"><span className="mr-1">{number}.</span>{title}</h3>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <div className="space-y-5 rounded-lg border bg-muted/40 p-5">{children}</div>
    </section>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-3 text-sm font-semibold">{title}</h4>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}{required && <span className="text-destructive"> *</span>}</Label>
      {children}
    </div>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={`flex justify-between ${muted ? "text-muted-foreground" : ""}`}>
      <span>{label}</span><span className="tabular-nums">{value}</span>
    </div>
  );
}

function ModeBtn({ label, icon: Icon, active, on, cls }: { value: PaymentMode; label: string; icon: typeof Banknote; active: boolean; on: () => void; cls: string }) {
  return (
    <button type="button" onClick={on}
      className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition ${
        active ? `${cls} border-transparent text-white shadow-sm` : "bg-background hover:bg-accent"
      }`}>
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}

export function PaymentBadge({ mode }: { mode: PaymentMode }) {
  if (mode === "cash") return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Cash</Badge>;
  if (mode === "insurance") return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">Insurance</Badge>;
  return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Free</Badge>;
}
