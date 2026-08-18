/**
 * ConsentDialog — patient consent capture with on-screen OTP verification (Track A).
 * Copyright (c) 2026 Francis Muhoro. All rights reserved.
 *
 * Depends on tables applied in the Sprint 5.2 SQL: consent_otps, patient_consents.
 */

import { useEffect, useMemo, useState } from "react";
import { generateAndSendOtp } from "@/lib/otp-service";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/supabase-untyped";
import { toast } from "sonner";
import { CheckCircle2, KeyRound, Printer, ShieldCheck } from "lucide-react";

export type ConsentType =
  | "general_treatment"
  | "data_sharing"
  | "hie_data_sharing"
  | "surgical"
  | "hiv_testing"
  | "anaesthesia";

type ConsentItem = {
  key: ConsentType;
  label: string;
  description: string;
  mandatory: boolean;
};

const CONSENT_ITEMS: ConsentItem[] = [
  {
    key: "general_treatment",
    label: "General treatment",
    description: "Consent to routine examination, investigation and treatment.",
    mandatory: true,
  },
  {
    key: "data_sharing",
    label: "Data privacy acknowledgement",
    description: "Acknowledgement of how the patient's data is collected and used internally.",
    mandatory: true,
  },
  {
    key: "hie_data_sharing",
    label: "Share with national HIE (AfyaLink)",
    description:
      "Optional — allow records to be shared with the national Health Information Exchange.",
    mandatory: false,
  },
  {
    key: "surgical",
    label: "Surgical procedure",
    description: "Consent to a surgical procedure.",
    mandatory: false,
  },
  {
    key: "hiv_testing",
    label: "HIV testing",
    description: "Consent to HIV testing and counselling.",
    mandatory: false,
  },
  {
    key: "anaesthesia",
    label: "Anaesthesia",
    description: "Consent to anaesthesia or sedation.",
    mandatory: false,
  },
];

const LEGAL_TEXT =
  "Your verification code for care visit is {OTP}. Valid for 10 mins. By sharing this code, you consent to treatment and SHA claims processing under Sec 48 of the Social Health Insurance Act 2023. False statements carry statutory penalties.";

type SlipData = {
  otpRef: string;
  when: string;
  given: string[];
  refused: string[];
};

export type ConsentDialogProps = {
  patientId: string;
  patientName: string;
  patientPhone?: string | null;
  encounterId?: string | null;
  triggerLabel?: string;
  triggerVariant?: "default" | "outline" | "secondary" | "ghost" | "destructive" | "link";
  triggerSize?: "default" | "sm" | "lg" | "icon";
  triggerClassName?: string;
  /** Controlled open state. When provided, no trigger button is rendered. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onComplete?: () => void;
};

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

type ConsentMap = Record<ConsentType, boolean>;
const EMPTY_CONSENTS: ConsentMap = {
  general_treatment: false,
  data_sharing: false,
  hie_data_sharing: false,
  surgical: false,
  hiv_testing: false,
  anaesthesia: false,
};

export function ConsentDialog(props: ConsentDialogProps) {
  const {
    patientId,
    patientName,
    patientPhone,
    encounterId,
    triggerLabel = "Record consent",
    triggerVariant = "default",
    triggerSize = "default",
    triggerClassName,
    open: controlledOpen,
    onOpenChange,
    onComplete,
  } = props;

  const { user } = useAuth();
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen === true : internalOpen;

  const setOpen = (next: boolean) => {
    onOpenChange?.(next);
    if (!isControlled) setInternalOpen(next);
  };

  const [consents, setConsents] = useState<ConsentMap>({ ...EMPTY_CONSENTS });
  const [step, setStep] = useState<"form" | "verify" | "done">("form");
  const [busy, setBusy] = useState(false);
  const [otpId, setOtpId] = useState<string | null>(null);
  const [otpInput, setOtpInput] = useState("");
  const [slip, setSlip] = useState<SlipData | null>(null);

  useEffect(() => {
    if (!open) {
      setStep("form");
      setConsents({ ...EMPTY_CONSENTS });
      setOtpId(null);
      setOtpInput("");
      setSlip(null);
    }
  }, [open]);

  const mandatoryOk = consents.general_treatment && consents.data_sharing;
  const agreed = useMemo(() => CONSENT_ITEMS.filter((i) => consents[i.key]), [consents]);
  const refused = useMemo(() => CONSENT_ITEMS.filter((i) => !consents[i.key]), [consents]);

  async function handleGenerate() {
    if (!user) {
      toast.error("You must be signed in");
      return;
    }
    if (!mandatoryOk) {
      toast.error("General treatment and data privacy consent are both required");
      return;
    }
    if (!patientPhone?.trim()) {
      toast.error("Patient phone number is required to send verification code");
      return;
    }
    setBusy(true);
    try {
      const { otpId: id } = await generateAndSendOtp(
        patientPhone.trim(),
        patientId,
        encounterId ?? null,
        user.id,
      );
      setOtpId(id);
      setStep("verify");
      toast.success("Verification code sent to patient's phone");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send verification code");
    } finally {
      setBusy(false);
    }
  }

  async function handleVerify() {
    if (!otpId || !otpInput.trim()) {
      toast.error("Enter the verification code");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await db
        .from("consent_otps")
        .select("id,otp_hash,expires_at")
        .eq("id", otpId);
      if (error) throw new Error(error.message);
      const row = (data as { otp_hash: string; expires_at: string }[] | null)?.[0];
      if (!row) throw new Error("Verification record not found");
      if (new Date(row.expires_at).getTime() < Date.now()) {
        toast.error("Code expired — generate a new one");
        return;
      }
      const typedHash = await sha256Hex(otpInput.trim());
      if (typedHash !== row.otp_hash) {
        toast.error("Incorrect code — confirm with the patient and re-enter");
        return;
      }

      const nowIso = new Date().toISOString();
      const { error: updErr } = await db
        .from("consent_otps")
        .update({ verified: true, verified_at: nowIso, delivery_status: "verified" })
        .eq("id", otpId);
      if (updErr) throw new Error(updErr.message);

      const rows = agreed.map((item) => ({
        patient_id: patientId,
        encounter_id: encounterId ?? null,
        consent_type: item.key,
        consented: true,
        hie_data_sharing_consented: item.key === "hie_data_sharing",
        consented_at: nowIso,
        consented_by: user?.id ?? null,
        created_by: user?.id ?? null,
      }));
      const { error: consentErr } = await db.from("patient_consents").insert(rows);
      if (consentErr) throw new Error(consentErr.message);

      setSlip({
        otpRef: otpId.slice(0, 8),
        when: nowIso,
        given: agreed.map((i) => i.label),
        refused: refused.map((i) => i.label),
      });
      setStep("done");
      onComplete?.();
      toast.success("Consent recorded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setBusy(false);
    }
  }

  function printSlip() {
    if (!slip) return;
    const win = window.open("", "_blank", "width=640,height=820");
    if (!win) {
      toast.error("Allow pop-ups to print the consent slip");
      return;
    }
    const given = slip.given.length
      ? slip.given.map((g) => `<li>${g}</li>`).join("")
      : "<li>None</li>";
    const refusedList = slip.refused.length
      ? slip.refused.map((r) => `<li>${r}</li>`).join("")
      : "<li>None</li>";
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Consent Slip</title>
<style>body{font-family:system-ui,Arial,sans-serif;padding:32px;color:#000}
h1{font-size:18px;margin:0 0 2px}.muted{color:#555;font-size:12px}
table{width:100%;margin-top:14px;border-collapse:collapse;font-size:13px}
th{text-align:left;width:160px;vertical-align:top;color:#444}td{vertical-align:top}
.section{margin-top:14px;font-weight:600}ul{margin:4px 0;padding-left:18px}
.sig{margin-top:48px;width:100%;border-collapse:collapse}
.sig td{border-top:1px solid #000;padding-top:4px;font-size:12px;width:33.33%}</style></head><body>
<h1>AegisCare / LabTrack — Patient Consent Slip</h1>
<div class="muted">Confidential — retain in patient record</div>
<table>
<tr><th>Patient</th><td>${patientName}</td></tr>
<tr><th>Date / Time</th><td>${new Date(slip.when).toLocaleString()}</td></tr>
<tr><th>OTP Reference</th><td>${slip.otpRef}</td></tr>
</table>
<div class="section">Consents given</div><ul>${given}</ul>
<div class="section">Refused / not applicable</div><ul>${refusedList}</ul>
<table class="sig"><tr><td>Patient signature</td><td>Witness signature</td><td>Clinician signature</td></tr></table>
</body></html>`);
    win.document.close();
    win.focus();
    win.print();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isControlled && (
        <DialogTrigger asChild>
          <Button
            type="button"
            variant={triggerVariant}
            size={triggerSize}
            className={triggerClassName}
          >
            <ShieldCheck className="mr-2 h-4 w-4" /> {triggerLabel}
          </Button>
        </DialogTrigger>
      )}

      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" /> Patient consent — {patientName}
          </DialogTitle>
        </DialogHeader>

        {step === "form" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Tick each consent the patient agrees to. General treatment and data privacy are
              required to continue.
            </p>
            <div className="space-y-2">
              {CONSENT_ITEMS.map((item) => (
                <div key={item.key} className="flex gap-3 rounded-md border p-3">
                  <Checkbox
                    id={`consent-${item.key}`}
                    checked={consents[item.key]}
                    onCheckedChange={(v) => setConsents((c) => ({ ...c, [item.key]: v === true }))}
                    className="mt-0.5"
                  />
                  <div className="space-y-0.5">
                    <Label
                      htmlFor={`consent-${item.key}`}
                      className="flex cursor-pointer items-center gap-2 text-sm font-medium"
                    >
                      {item.label}
                      {item.mandatory ? (
                        <Badge variant="secondary" className="text-[10px]">
                          Required
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">
                          Optional
                        </Badge>
                      )}
                    </Label>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === "verify" && (
          <div className="space-y-4">
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Verification code sent to patient's phone
              {patientPhone ? (
                <span className="font-mono font-semibold">{patientPhone}</span>
              ) : null}
            </div>
            <div className="rounded-md border border-amber-100 bg-amber-50 p-3 text-xs text-amber-800">
              Ask the patient to read out the 6-digit code they received by SMS. The code expires in
              10 minutes.
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="consent-otp-input">Enter the code the patient received</Label>
              <Input
                id="consent-otp-input"
                inputMode="numeric"
                value={otpInput}
                onChange={(e) => setOtpInput(e.target.value)}
                placeholder="6-digit code"
              />
            </div>
          </div>
        )}

        {step === "done" && slip && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-emerald-700">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">Consent recorded</span>
            </div>
            <div className="rounded-md border p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Reference</span>
                <span className="font-mono">{slip.otpRef}</span>
              </div>
              <div className="mt-1 flex justify-between">
                <span className="text-muted-foreground">When</span>
                <span>{new Date(slip.when).toLocaleString()}</span>
              </div>
              <div className="mt-2">
                <span className="text-muted-foreground">Given: </span>
                <span>{slip.given.length ? slip.given.join(", ") : "None"}</span>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {step === "form" && (
            <>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={handleGenerate} disabled={busy || !mandatoryOk}>
                <KeyRound className="mr-2 h-4 w-4" />
                {busy ? "Generating…" : "Generate verification code"}
              </Button>
            </>
          )}

          {step === "verify" && (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep("form")}
                disabled={busy}
              >
                Back
              </Button>
              <Button type="button" onClick={handleVerify} disabled={busy}>
                {busy ? "Verifying…" : "Verify & record"}
              </Button>
            </>
          )}

          {step === "done" && (
            <>
              <Button type="button" variant="outline" onClick={printSlip}>
                <Printer className="mr-2 h-4 w-4" /> Print slip
              </Button>
              <Button type="button" onClick={() => setOpen(false)}>
                Done
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
