/**
 * useBiometricBridge
 * React hook for AegisCare Biometric Bridge.
 * OPD Level 3B — CHECK_IN and DISCHARGE triggers only.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import type {
  BiometricDecision,
  BiometricVerificationParams,
  ConnectionStatus,
  ScanStatus,
} from "@/types/biometric";

const BRIDGE_WS_URL = "ws://localhost:4000/device";
const BRIDGE_HEALTH_URL = "http://localhost:4000/health";
const HEALTH_TIMEOUT_MS = 2500;
const VERIFY_TIMEOUT_MS = 90000;

/** Fund types that require Layer-2 biometric consent (SHA billing). */
export const BIOMETRIC_FUND_TYPES: readonly string[] = ["SHIF", "PHF", "POMSF"];

/**
 * True when the given fund type requires biometric authorisation.
 * CASH, CORPORATE and FREE patients are answered by the bridge with
 * PROCEED / NONE_REQUIRED automatically — and are also short-circuited here
 * so the workflow never depends on the bridge for them.
 */
export function fundRequiresBiometric(fundType: string): boolean {
  const fund = (fundType ?? "").toUpperCase();
  return fund.length > 0 && BIOMETRIC_FUND_TYPES.includes(fund);
}

function makeDecision(
  params: BiometricVerificationParams,
  overrides: Partial<BiometricDecision>,
): BiometricDecision {
  return {
    verdict: "PROCEED",
    method: "NONE_REQUIRED",
    otpNeeded: false,
    biometricReq: false,
    exemptionCode: null,
    reason: "",
    timestamp: new Date().toISOString(),
    patientId: params.patientId,
    fundType: params.fundType,
    trigger: params.trigger,
    initiatedBy: params.initiatedBy,
    simulated: true,
    ...overrides,
  };
}

export function useBiometricBridge() {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("DISCONNECTED");
  const [scanStatus, setScanStatus] = useState<ScanStatus>("IDLE");
  const [decision, setDecision] = useState<BiometricDecision | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [workstationId, setWorkstationId] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const requestIdRef = useRef(0);
  const pendingRef = useRef<{
    requestId: string;
    params: BiometricVerificationParams;
    resolve: (d: BiometricDecision) => void;
    timer: number | null;
  } | null>(null);

  // ── Connect: health probe → WebSocket ────────────────────────────────
  useEffect(() => {
    let disposed = false;
    let ws: WebSocket | null = null;

    async function connect() {
      setConnectionStatus("CONNECTING");
      try {
        const ctrl = new AbortController();
        const timer = window.setTimeout(() => ctrl.abort(), HEALTH_TIMEOUT_MS);
        const res = await fetch(BRIDGE_HEALTH_URL, { signal: ctrl.signal });
        window.clearTimeout(timer);
        if (!res.ok) throw new Error(`Bridge health returned HTTP ${res.status}`);
        const health = (await res.json()) as Partial<{
          workstationId: string;
          status: string;
        }>;
        if (health.workstationId) setWorkstationId(health.workstationId);
      } catch {
        // Bridge offline — stay DISCONNECTED. verify() degrades gracefully.
        setConnectionStatus("DISCONNECTED");
        return;
      }
      if (disposed) return;

      ws = new WebSocket(BRIDGE_WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!disposed) setConnectionStatus("CONNECTED");
      };

      ws.onmessage = (ev: MessageEvent) => {
        if (disposed) return;
        let msg: Record<string, unknown>;
        try {
          msg = JSON.parse(String(ev.data)) as Record<string, unknown>;
        } catch {
          return;
        }
        const pending = pendingRef.current;
        if (msg.type === "scan_started") {
          setScanStatus("SCANNING");
          return;
        }
        if (msg.type === "error") {
          setError(String(msg.message ?? "Biometric bridge error"));
          setScanStatus("ERROR");
          return;
        }
        if (msg.type === "decision" && pending && String(msg.requestId) === pending.requestId) {
          const next = msg.decision as BiometricDecision | undefined;
          if (!next) return;
          if (pending.timer) window.clearTimeout(pending.timer);
          pendingRef.current = null;
          setDecision(next);
          setScanStatus("DECIDED");
          pending.resolve(next);
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
        if (!disposed) setConnectionStatus("DISCONNECTED");
      };

      ws.onerror = () => {
        if (!disposed) setConnectionStatus("ERROR");
      };
    }

    void connect();

    return () => {
      disposed = true;
      wsRef.current = null;
      if (pendingRef.current?.timer) window.clearTimeout(pendingRef.current.timer);
      pendingRef.current = null;
      ws?.close();
    };
  }, []);

  // ── verify: graceful-degradation first, real scan second ─────────────
  const verify = useCallback((params: BiometricVerificationParams): Promise<BiometricDecision> => {
    // Supersede any in-flight scan (modal-driven flows never overlap,
    // but a stale request must never resolve against a new patient).
    const prev = pendingRef.current;
    if (prev) {
      if (prev.timer) window.clearTimeout(prev.timer);
      prev.resolve(
        makeDecision(prev.params, {
          exemptionCode: "SUPERSEDED",
          reason: "Superseded by a newer biometric request.",
        }),
      );
      pendingRef.current = null;
    }

    const fund = (params.fundType ?? "").toUpperCase();

    // Non-SHA fund types: the bridge answers PROCEED / NONE_REQUIRED
    // automatically — mirror that locally so CASH / CORPORATE / FREE
    // never touch the device.
    if (fund.length === 0 || !BIOMETRIC_FUND_TYPES.includes(fund)) {
      const next = makeDecision(params, {
        method: "NONE_REQUIRED",
        biometricReq: false,
        reason: `Fund type ${fund || "unknown"} does not require biometric authorisation.`,
      });
      setDecision(next);
      setScanStatus("DECIDED");
      return Promise.resolve(next);
    }

    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      // Bridge offline — NEVER block the clinical workflow.
      const next = makeDecision(params, {
        method: "NONE",
        exemptionCode: "BRIDGE_OFFLINE",
        reason: "Biometric bridge offline — proceeding without biometric verification.",
      });
      setDecision(next);
      setScanStatus("DECIDED");
      return Promise.resolve(next);
    }

    return new Promise<BiometricDecision>((resolve) => {
      const requestId = `req-${++requestIdRef.current}`;
      setError(null);
      setDecision(null);
      setScanStatus("REQUESTING");
      const timer = window.setTimeout(() => {
        pendingRef.current = null;
        const next = makeDecision(params, {
          method: "NONE",
          exemptionCode: "BRIDGE_TIMEOUT",
          reason: "Biometric bridge did not respond in time — proceeding without verification.",
        });
        setDecision(next);
        setScanStatus("DECIDED");
        resolve(next);
      }, VERIFY_TIMEOUT_MS);
      pendingRef.current = { requestId, params, resolve, timer };
      ws.send(JSON.stringify({ type: "verify", requestId, params }));
    });
  }, []);

  // ── cancel: tell the bridge to abort the scan and reset local state ──
  const cancel = useCallback(() => {
    const pending = pendingRef.current;
    if (pending?.timer) window.clearTimeout(pending.timer);
    pendingRef.current = null;
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "cancel", requestId: pending?.requestId ?? null }));
    }
    setScanStatus("IDLE");
    setDecision(null);
    setError(null);
  }, []);

  const reset = useCallback(() => {
    if (pendingRef.current?.timer) window.clearTimeout(pendingRef.current.timer);
    pendingRef.current = null;
    setScanStatus("IDLE");
    setDecision(null);
    setError(null);
  }, []);

  return {
    connectionStatus,
    scanStatus,
    decision,
    error,
    workstationId,
    verify,
    cancel,
    reset,
  };
}
