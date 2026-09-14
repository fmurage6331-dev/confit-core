/**
 * BiometricConsentModal
 * Layer-2 SHA biometric consent UI (device bridge).
 * OPD Level 3B — fires for CHECK_IN and DISCHARGE triggers only.
 * ODPC OTP consent (Layer 1) lives in consent-dialog.tsx and is untouched.
 */

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  DoorOpen,
  Fingerprint,
  KeyRound,
  Loader2,
  LogOut,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  BiometricDecision,
  BiometricTrigger,
  ConnectionStatus,
  ScanStatus,
} from "@/types/biometric";

export interface BiometricConsentModalProps {
  open: boolean;
  trigger: BiometricTrigger;
  patientName: string;
  fileNumber: string | null;
  fundType: string;
  connectionStatus: ConnectionStatus;
  scanStatus: ScanStatus;
  decision: BiometricDecision | null;
  error: string | null;
  /** Called when the operator may proceed (decision, or null = skip while bridge offline). */
  onContinue: (decision: BiometricDecision | null) => void;
  onRetry: () => void;
  onCancel: () => void;
}

export function BiometricConsentModal({
  open,
  trigger,
  patientName,
  fileNumber,
  fundType,
  connectionStatus,
  scanStatus,
  decision,
  error,
  onContinue,
  onRetry,
  onCancel,
}: BiometricConsentModalProps) {
  const [otpSent, setOtpSent] = useState(false);
  const [otpInput, setOtpInput] = useState("");
  const [otpCode, setOtpCode] = useState<string | null>(null);

  const triggerLabel = trigger === "CHECK_IN" ? "check-in" : "discharge";
  const bridgeOnline = connectionStatus === "CONNECTED";
  const bridgeConnecting = connectionStatus === "CONNECTING";
  const decided = scanStatus === "DECIDED" && decision !== null;
  const blocked = decided && decision?.verdict === "BLOCKED";
  const otpFallback = decided && decision?.verdict === "OTP_FALLBACK" && decision.otpNeeded;
  const noneRequired = decided && decision?.method === "NONE_REQUIRED";
  const degraded = decided && decision?.method === "NONE" && decision.exemptionCode !== null;

  function sendOtp() {
    setOtpCode(String(Math.floor(100000 + Math.random() * 900000)));
    setOtpSent(true);
    toast.info("OTP sent — shown on screen (SMS delivery activates in Phase 3).");
  }

  function verifyOtp() {
    if (otpCode && otpInput.trim() === otpCode) {
      if (decision) onContinue(decision);
      return;
    }
    toast.error("Incorrect OTP — please try again.");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onCancel();
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Fingerprint className="h-5 w-5 text-primary" />
            Biometric consent — {triggerLabel}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Patient + fund summary */}
          <div className="rounded-lg bg-muted/30 border p-3 text-sm">
            <div className="font-medium">{patientName}</div>
            <div className="text-xs text-muted-foreground">
              {fileNumber ? `File #${fileNumber}` : "—"} ·{" "}
              <span className="uppercase">{fundType || "unknown fund"}</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              The patient authorises this visit for SHA billing by biometric verification, under the
              Digital Health Act 2023 and the Data Protection Act 2019. Only SHA-funded visits (SHIF
              / PHF / POMSF) require this step.
            </p>
          </div>

          {/* Bridge connection status */}
          <div
            className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium ${
              bridgeOnline
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : bridgeConnecting
                  ? "border-amber-200 bg-amber-50 text-amber-700"
                  : "border-rose-200 bg-rose-50 text-rose-700"
            }`}
          >
            <ShieldCheck className="h-4 w-4 shrink-0" />
            {bridgeOnline
              ? "Biometric bridge connected"
              : bridgeConnecting
                ? "Connecting to biometric bridge…"
                : "Biometric bridge offline — biometric can be skipped"}
          </div>

          {/* Scan progress / decision */}
          {!decided && (
            <div className="rounded-lg border p-6 text-center space-y-2">
              {scanStatus === "SCANNING" ? (
                <>
                  <Fingerprint className="mx-auto h-12 w-12 animate-pulse text-primary" />
                  <p className="text-sm font-medium">Place the patient's finger on the scanner…</p>
                </>
              ) : scanStatus === "ERROR" ? (
                <>
                  <AlertTriangle className="mx-auto h-10 w-10 text-destructive" />
                  <p className="text-sm font-medium text-destructive">{error ?? "Scan failed"}</p>
                </>
              ) : (
                <>
                  <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
                  <p className="text-sm font-medium">Requesting fingerprint scan…</p>
                </>
              )}
              <div className="flex items-center justify-center gap-2 pt-1">
                <Badge variant="secondary" className="text-xs">
                  {trigger}
                </Badge>
                <Badge variant="secondary" className="text-xs uppercase">
                  {fundType || "—"}
                </Badge>
              </div>
            </div>
          )}

          {decided && blocked && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="h-4 w-4" />
                Biometric verification blocked
              </div>
              <p className="mt-1 text-xs">
                {decision?.reason ?? "The biometric bridge declined this visit."}
              </p>
            </div>
          )}

          {decided && !blocked && !otpFallback && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              <div className="flex items-center gap-2 font-semibold">
                <CheckCircle2 className="h-4 w-4" />
                {noneRequired
                  ? "Biometric not required"
                  : degraded
                    ? "Verification skipped (graceful degradation)"
                    : "Biometric verified"}
              </div>
              <p className="mt-1 text-xs">
                {degraded
                  ? `Exemption ${decision?.exemptionCode}: ${decision?.reason}`
                  : noneRequired
                    ? `${fundType || "This fund"} does not require biometric authorisation — you may continue.`
                    : "Patient identity confirmed — the visit may proceed."}
              </p>
            </div>
          )}

          {otpFallback && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 space-y-3">
              <div className="flex items-center gap-2 font-semibold">
                <KeyRound className="h-4 w-4" />
                OTP fallback
              </div>
              <p className="text-xs">
                Biometric capture is unavailable for this patient. An OTP consent fallback can be
                used instead. {decision?.reason}
              </p>
              {!otpSent ? (
                <Button size="sm" variant="outline" onClick={sendOtp}>
                  Send OTP
                </Button>
              ) : (
                <div className="space-y-2">
                  {otpCode && (
                    <div className="rounded border border-amber-300 bg-white p-2 text-xs">
                      <span className="font-semibold">OTP (on-screen delivery): </span>
                      <span className="font-mono text-base tracking-widest">{otpCode}</span>
                      <span className="ml-2 text-muted-foreground">(expires in 10 minutes)</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <Label className="sr-only">Enter 6-digit OTP</Label>
                      <Input
                        placeholder="Enter 6-digit OTP"
                        value={otpInput}
                        onChange={(e) => setOtpInput(e.target.value)}
                        maxLength={6}
                        className="font-mono tracking-widest"
                      />
                    </div>
                    <Button size="sm" onClick={verifyOtp} disabled={otpInput.length < 6}>
                      Verify & continue
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex-wrap gap-2">
          {!decided && !bridgeOnline && !bridgeConnecting && (
            <Button variant="outline" onClick={() => onContinue(null)}>
              Skip biometric & proceed
            </Button>
          )}
          {scanStatus === "ERROR" && (
            <Button variant="outline" onClick={onRetry}>
              <RefreshCw className="mr-1 h-4 w-4" />
              Retry scan
            </Button>
          )}
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          {decided && !blocked && !otpFallback && (
            <Button onClick={() => onContinue(decision)}>
              {trigger === "CHECK_IN" ? (
                <DoorOpen className="mr-1 h-4 w-4" />
              ) : (
                <LogOut className="mr-1 h-4 w-4" />
              )}
              Continue {triggerLabel}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
