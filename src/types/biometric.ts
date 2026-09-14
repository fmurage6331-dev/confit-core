/**
 * Biometric Bridge — TypeScript Types
 * AegisCare HMS — OPD Level 3B
 */

export type BiometricTrigger = "CHECK_IN" | "DISCHARGE";

export type BiometricVerdict = "PROCEED" | "BLOCKED" | "OTP_FALLBACK";

export type BiometricMethod = "BIOMETRIC" | "OTP" | "NONE_REQUIRED" | "NONE";

export type BiometricFundType = "SHIF" | "PHF" | "POMSF" | "CASH" | "CORPORATE" | "FREE";

export type ConnectionStatus = "DISCONNECTED" | "CONNECTING" | "CONNECTED" | "ERROR";

export type ScanStatus = "IDLE" | "REQUESTING" | "SCANNING" | "DECIDED" | "ERROR";

export interface BiometricDecision {
  verdict: BiometricVerdict;
  method: BiometricMethod;
  otpNeeded: boolean;
  biometricReq: boolean;
  exemptionCode: string | null;
  reason: string;
  timestamp: string;
  patientId: string;
  fundType: string;
  trigger: BiometricTrigger;
  initiatedBy: string;
  simulated?: boolean;
}

export interface BiometricVerificationParams {
  patientId: string;
  fundType: BiometricFundType | string;
  trigger: BiometricTrigger;
  initiatedBy: string;
}

export interface BridgeHealthResponse {
  workstationId: string;
  status: "READY" | string;
  service: string;
  version: string;
  timestamp: string;
}

export interface DischargeChecklistItem {
  key: string;
  label: string;
  passed: boolean;
  detail?: string;
}
