/**
 * LabTrack — Laboratory Records
 * Copyright (c) 2026 Francis Muhoro. All rights reserved.
 * Author: Francis Muhoro
 */

import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { PermGuard } from "@/lib/require-access";
import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { TEST_TYPES } from "@/lib/test-types";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { ParameterTable } from "@/components/parameter-table";
import { type StructuredResult, type Parameter } from "@/lib/test-parameters";
import { fetchTemplateFor } from "@/lib/test-templates";

export const Route = createFileRoute("/records/new")({
  validateSearch: (s: Record<string, unknown>) => ({ reg: typeof s.reg === "string" ? s.reg : undefined }) as { reg?: string },
  component: () => <AppShell><PermGuard perm="records_create"><NewRecord /></PermGuard></AppShell>,
});

const schema = z.object({
  patient_name: z.string().trim().min(1, "Patient name required").max(120),
  age: z.coerce.number().int().min(0).max(150),
  registration_number: z.string().trim().min(1, "Registration number required").max(50),
  lab_number: z.string().trim().min(1, "Lab number required").max(50),
  test_name: z.string().trim().min(1, "Select a test").max(120),
  test_date: z.string().min(1),
  result: z.string().trim().max(2000).optional(),
  notes: z.string().trim().max(2000).optional(),
});

function NewRecord() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [submitting, setSubmitting] = useState(false);
  const [testChoice, setTestChoice] = useState<string>("");
  const [customTest, setCustomTest] = useState("");
  const [isPositive, setIsPositive] = useState(false);
  const [isMedicalCamp, setIsMedicalCamp] = useState(false);
  const [clearance, setClearance] = useState<
    {
      state: "idle" | "checking" | "unknown" | "cleared" | "blocked";
      message?: string;
      registrationId?: string;
      fromRoom?: string | null;
      requestedTests?: { id: string; name: string }[];
    }
  >({ state: "idle" });
  const [form, setForm] = useState({
    patient_name: "", age: "", registration_number: search.reg ?? "", lab_number: "",
    test_date: new Date().toISOString().slice(0, 10), result: "", notes: "",
  });

  // Verify whether the patient identified by registration # / file # has been cleared by accounting.
  // Also load the list of tests requested at reception — lab techs can only run those.
  useEffect(() => {
    const reg = form.registration_number.trim();
    if (!reg) { setClearance({ state: "idle" }); return; }
    let cancelled = false;
    setClearance({ state: "checking" });
    (async () => {
      const { data, error } = await supabase
        .from("patient_registrations")
        .select("id,patient_name,payment_status,from_room,tests")
        .eq("file_number", reg)
        .order("created_at", { ascending: false })
        .limit(1);
      if (cancelled) return;
      if (error) { setClearance({ state: "idle" }); return; }
      const row = data?.[0];
      if (!row) {
        setClearance({ state: "unknown", message: "No registration found for this number. The lab can only run tests requested by reception." });
        return;
      }
      const requested = (row.tests as { id: string; name: string }[] | null) ?? [];
      const settled = row.payment_status === "paid" || row.payment_status === "waived";
      const base = { registrationId: row.id ?? undefined, fromRoom: row.from_room ?? undefined, requestedTests: requested };
      if (settled) setClearance({ state: "cleared", message: `${row.patient_name} cleared by accounting${row.from_room ? ` · from ${row.from_room}` : ""}.`, ...base });
      else setClearance({ state: "blocked", message: `${row.patient_name} has not been cleared (${row.payment_status}). Send to accounting before running tests.`, ...base });
    })();
    return () => { cancelled = true; };
  }, [form.registration_number]);

  const effectiveTestName = testChoice === "Other" ? customTest.trim() : testChoice;
  const [template, setTemplate] = useState<Parameter[] | null>(null);
  const [structured, setStructured] = useState<StructuredResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!effectiveTestName || testChoice === "Other") {
      setTemplate(null); setStructured(null); return;
    }
    fetchTemplateFor(effectiveTestName).then((tpl) => {
      if (cancelled) return;
      setTemplate(tpl);
      setStructured(
        tpl
          ? {
              version: 1,
              parameters: tpl.map((p) => ({ name: p.name, value: "", unit: p.unit, low: p.low, high: p.high })),
              summary: "",
            }
          : null,
      );
    }).catch(() => { if (!cancelled) { setTemplate(null); setStructured(null); } });
    return () => { cancelled = true; };
  }, [effectiveTestName, testChoice]);

  const handleTestChange = (v: string) => setTestChoice(v);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (clearance.state === "blocked") {
      toast.error("Patient not cleared by accounting. Tests cannot be run until payment is settled.");
      return;
    }
    if (clearance.state === "unknown" && !isMedicalCamp) {
      toast.error("This test was not requested by reception. The lab can only run tests requested for a registered patient (or tick 'Medical camp').");
      return;
    }
    const test_name = effectiveTestName;
    // Enforce: lab tech may only run a test that reception actually requested for this patient.
    if (clearance.state === "cleared" && clearance.requestedTests && clearance.requestedTests.length > 0) {
      const ok = clearance.requestedTests.some((t) => t.name === test_name);
      if (!ok) {
        toast.error(`This test was not requested at reception. Allowed: ${clearance.requestedTests.map((t) => t.name).join(", ")}`);
        return;
      }
    }
    const resultText = template && structured
      ? JSON.stringify(structured)
      : form.result;
    const parsed = schema.safeParse({ ...form, test_name, result: resultText });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setSubmitting(true);
    const { data, error } = await supabase.from("lab_tests").insert({
      ...parsed.data,
      result: parsed.data.result || null,
      notes: parsed.data.notes || null,
      is_positive: isPositive,
      is_medical_camp: isMedicalCamp,
      registration_id: clearance.registrationId ?? null,
      sent_to_room: clearance.fromRoom ?? null,
      created_by: user!.id,
    }).select("id").single();
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Record saved");
    navigate({ to: "/records/$id", params: { id: data!.id } });
  }
  

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link to="/records" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to records
      </Link>
      <div>
        <h1 className="text-3xl font-bold">New test record</h1>
        <p className="mt-1 text-sm text-muted-foreground">Enter patient and test details.</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-6 rounded-xl border bg-card p-6 shadow-[var(--shadow-card)]">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="patient_name">Patient name</Label>
            <Input id="patient_name" value={form.patient_name} onChange={set("patient_name")} required />
          </div>
          <div>
            <Label htmlFor="age">Age</Label>
            <Input id="age" type="number" min={0} max={150} value={form.age} onChange={set("age")} required />
          </div>
          <div>
            <Label htmlFor="test_date">Date</Label>
            <Input id="test_date" type="date" value={form.test_date} onChange={set("test_date")} required />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="registration_number">Registration / file #</Label>
            <Input id="registration_number" value={form.registration_number} onChange={set("registration_number")} required />
            {clearance.state !== "idle" && (
              <div
                className={`mt-2 rounded-md border px-3 py-2 text-xs ${
                  clearance.state === "cleared"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : clearance.state === "blocked"
                      ? "border-rose-200 bg-rose-50 text-rose-700"
                      : clearance.state === "unknown"
                        ? "border-amber-200 bg-amber-50 text-amber-700"
                        : "border-muted bg-muted/40 text-muted-foreground"
                }`}
              >
                {clearance.state === "checking" ? "Checking accounting clearance…" : clearance.message}
              </div>
            )}
          </div>
          <div>
            <Label htmlFor="lab_number">Lab #</Label>
            <Input id="lab_number" value={form.lab_number} onChange={set("lab_number")} required />
          </div>
          <div className="sm:col-span-2">
            <Label>Test</Label>
            {clearance.requestedTests && clearance.requestedTests.length > 0 ? (
              <>
                <Select value={testChoice} onValueChange={handleTestChange}>
                  <SelectTrigger><SelectValue placeholder="Select a requested test" /></SelectTrigger>
                  <SelectContent>
                    {clearance.requestedTests.map((t) => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-muted-foreground">
                  Limited to tests reception requested for this patient{clearance.fromRoom ? ` from ${clearance.fromRoom}` : ""}.
                </p>
              </>
            ) : (
              <>
                <Select value={testChoice} onValueChange={handleTestChange}>
                  <SelectTrigger><SelectValue placeholder="Select a test" /></SelectTrigger>
                  <SelectContent>
                    {TEST_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
                {testChoice === "Other" && (
                  <Input className="mt-2" placeholder="Enter test name" value={customTest} onChange={(e) => setCustomTest(e.target.value)} />
                )}
              </>
            )}
          </div>
          {template && structured ? (
            <div className="sm:col-span-2 space-y-2">
              <Label>Parameters</Label>
              <ParameterTable value={structured} onChange={setStructured} />
            </div>
          ) : (
            <div className="sm:col-span-2">
              <Label htmlFor="result">Result <span className="text-muted-foreground">(optional)</span></Label>
              <Textarea id="result" rows={3} value={form.result} onChange={set("result")} placeholder="e.g. Negative / Hb: 12.4 g/dL …" />
            </div>
          )}
          <div className="sm:col-span-2">
            <Label htmlFor="notes">Notes <span className="text-muted-foreground">(optional)</span></Label>
            <Textarea id="notes" rows={2} value={form.notes} onChange={set("notes")} />
          </div>
          <div className="sm:col-span-2 flex flex-wrap gap-6 pt-2">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={isPositive} onCheckedChange={(v) => setIsPositive(!!v)} />
              Positive result
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={isMedicalCamp} onCheckedChange={(v) => setIsMedicalCamp(!!v)} />
              Medical camp test
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => navigate({ to: "/records" })}>Cancel</Button>
          <Button type="submit" disabled={submitting || clearance.state === "blocked"}>{submitting ? "Saving…" : "Save record"}</Button>
        </div>
      </form>
    </div>
  );
}