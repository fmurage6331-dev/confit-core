/**
 * LabTrack — Laboratory Records
 * Copyright (c) 2026 Francis Muhoro. All rights reserved.
 * Author: Francis Muhoro
 */

import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect, type FormEvent } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Activity, BadgeCheck, FileText, Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { dbError } from "@/lib/db-error";

type LoginSearch = { mode?: "signin" | "signup"; next?: string };

function safeNext(next: unknown): string | undefined {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//")) return undefined;
  return next;
}

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>): LoginSearch => ({
    mode: s.mode === "signup" ? "signup" : "signin",
    next: safeNext(s.next),
  }),
  component: LoginPage,
});

const signinSchema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(1, "Enter your password").max(72),
});

const signupSchema = z
  .object({
    email: z.string().trim().email("Enter a valid email").max(255),
    password: z.string().min(8, "Password must be at least 8 characters").max(72),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  });

// ── MFA step type ────────────────────────────────────────────────────────────
type MfaStep =
  | { kind: "none" }
  | { kind: "totp"; factorId: string; challengeId: string }
  | { kind: "email" };

function LoginPage() {
  const navigate = useNavigate();
  const { mode, next } = Route.useSearch();
  const isSignup = mode === "signup";
  const { user, loading } = useAuth();

  // ── Form state ───────────────────────────────────────────────────────────
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // ── MFA state ────────────────────────────────────────────────────────────
  const [mfaStep, setMfaStep] = useState<MfaStep>({ kind: "none" });
  const [mfaCode, setMfaCode] = useState("");
  const [verifying, setVerifying] = useState(false);

  const goNext = () => {
    if (next) window.location.href = next;
    else navigate({ to: "/dashboard" });
  };

  useEffect(() => {
    if (!loading && user) goNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading]);

  // ── Password sign-in ─────────────────────────────────────────────────────
  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (isSignup) {
        const parsed = signupSchema.safeParse({ email, password, confirm });
        if (!parsed.success) {
          toast.error(parsed.error.issues[0].message);
          return;
        }
        const { data, error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            emailRedirectTo: next
              ? `${window.location.origin}${next}`
              : `${window.location.origin}/dashboard`,
          },
        });
        if (error) throw error;
        if (data.session) {
          toast.success("Account created. Welcome!");
          goNext();
        } else {
          toast.success("Check your email to confirm your account before signing in.");
          navigate({ to: "/login", search: { mode: "signin", next } });
        }
      } else {
        const parsed = signinSchema.safeParse({ email, password });
        if (!parsed.success) {
          toast.error(parsed.error.issues[0].message);
          return;
        }
        const { error } = await supabase.auth.signInWithPassword(parsed.data);
        if (error) {
          if (error.message.toLowerCase().includes("email not confirmed")) {
            toast.error("Please verify your email before logging in.");
          } else {
            toast.error(dbError(error));
          }
          return;
        }

        // ── Check MFA factors ─────────────────────────────────────────────
        const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

        if (aal && aal.nextLevel === "aal2" && aal.nextLevel !== aal.currentLevel) {
          // User has TOTP enrolled — issue challenge
          const { data: factors } = await supabase.auth.mfa.listFactors();
          const totpFactor = factors?.totp?.find(
            (f) => f.factor_type === "totp" && f.status === "verified",
          );

          if (totpFactor) {
            const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({
              factorId: totpFactor.id,
            });
            if (challengeErr || !challenge) {
              toast.error("MFA challenge failed. Please try again.");
              return;
            }
            setMfaStep({
              kind: "totp",
              factorId: totpFactor.id,
              challengeId: challenge.id,
            });
            return; // ← stop here — wait for TOTP input
          }
        }

        // No MFA enrolled — proceed but show enrollment reminder
        toast.success("Signed in. Set up Authenticator in Settings for enhanced security.");
        goNext();
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? dbError(err) : isSignup ? "Sign up failed" : "Sign in failed",
      );
    } finally {
      setSubmitting(false);
    }
  }

  // ── TOTP verification ────────────────────────────────────────────────────
  async function verifyTotp(e: FormEvent) {
    e.preventDefault();
    if (mfaStep.kind !== "totp") return;
    setVerifying(true);
    const { error } = await supabase.auth.mfa.verify({
      factorId: mfaStep.factorId,
      challengeId: mfaStep.challengeId,
      code: mfaCode.trim(),
    });
    setVerifying(false);
    if (error) {
      toast.error("Incorrect code — check your authenticator app and try again.");
      setMfaCode("");
      return;
    }
    toast.success("Verified ✓");
    goNext();
  }

  // ── TOTP screen ──────────────────────────────────────────────────────────
  if (mfaStep.kind === "totp") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border bg-card p-8 shadow-sm space-y-6">
            <div className="text-center space-y-1">
              <div className="flex justify-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <ShieldCheck className="h-6 w-6 text-primary" />
                </div>
              </div>
              <h1 className="text-xl font-bold mt-3">Two-factor authentication</h1>
              <p className="text-sm text-muted-foreground">
                Enter the 6-digit code from your authenticator app.
              </p>
            </div>
            <form onSubmit={verifyTotp} className="space-y-4">
              <div>
                <Label htmlFor="mfa-code">Authenticator code</Label>
                <Input
                  id="mfa-code"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  autoComplete="one-time-code"
                  autoFocus
                  placeholder="000000"
                  className="text-center text-2xl tracking-widest font-mono"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
                />
              </div>
              <Button type="submit" className="w-full" disabled={verifying || mfaCode.length !== 6}>
                {verifying ? "Verifying…" : "Verify"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full text-sm"
                onClick={() => {
                  setMfaStep({ kind: "none" });
                  setMfaCode("");
                  void supabase.auth.signOut();
                }}
              >
                ← Back to sign in
              </Button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ── Main login screen ────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen">
      {/* ── LEFT PANEL ── */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-gradient-to-br from-slate-900 via-[#0e6027]/40 to-slate-900 p-12 text-white">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#24a148] text-white">
            <Activity className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold tracking-tight">AegisCare</span>
          <span className="rounded-full border border-[#009d9a]/30 bg-[#009d9a]/10 px-2 py-0.5 text-[10px] font-medium text-[#009d9a]">
            HMS v5.3
          </span>
        </div>

        <div className="space-y-8">
          <div>
            <h2 className="text-3xl font-extrabold leading-tight">
              Kenya's healthcare,
              <br />
              <span className="bg-gradient-to-r from-[#24a148] to-[#009d9a] bg-clip-text text-transparent">
                fully digitised.
              </span>
            </h2>
            <p className="mt-4 text-sm text-slate-300 leading-relaxed">
              End-to-end hospital management built for SHA contracting eligibility, DHA
              certification and MOH reporting requirements.
            </p>
          </div>
          <div className="space-y-3">
            {[
              { icon: ShieldCheck, label: "DHA Digital Health Act 2023 compliant" },
              { icon: BadgeCheck, label: "SHA / SHIF integration with fund-type auto-detection" },
              { icon: Lock, label: "ODPC data protection — RLS on every table" },
              { icon: FileText, label: "MOH 705A / 705B / 717 automated reporting" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2.5 text-sm text-slate-300">
                <Icon className="h-4 w-4 shrink-0 text-[#009d9a]" />
                {label}
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-slate-500">© 2026 AegisCare · Built by Francis Muhoro</p>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="flex w-full items-center justify-center px-6 py-12 lg:w-1/2 bg-background">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-8 flex items-center justify-center gap-2 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Activity className="h-5 w-5" />
            </div>
            <span className="text-xl font-semibold">AegisCare</span>
          </Link>

          <div className="mb-8">
            <h1 className="text-2xl font-bold">{isSignup ? "Request access" : "Welcome back"}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isSignup
                ? "Create an account — your administrator will approve your role before you can access the workspace."
                : "Sign in with the credentials provided by your facility administrator."}
            </p>
          </div>

          <div className="rounded-2xl border bg-card p-8 shadow-sm">
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete={isSignup ? "new-password" : "current-password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {isSignup && (
                <div>
                  <Label htmlFor="confirm">Confirm password</Label>
                  <Input
                    id="confirm"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                  />
                </div>
              )}
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Please wait…" : isSignup ? "Create account" : "Sign in"}
              </Button>
            </form>

            {!isSignup && (
              <p className="mt-4 text-center text-sm">
                <Link to="/forgot-password" className="text-primary hover:underline">
                  Forgot password?
                </Link>
              </p>
            )}

            <p className="mt-6 text-center text-sm text-muted-foreground">
              {isSignup ? (
                <>
                  Already have an account?{" "}
                  <Link
                    to="/login"
                    search={{ mode: "signin" }}
                    className="font-medium text-primary hover:underline"
                  >
                    Sign in
                  </Link>
                </>
              ) : (
                <>
                  Need an account?{" "}
                  <Link
                    to="/login"
                    search={{ mode: "signup" }}
                    className="font-medium text-primary hover:underline"
                  >
                    Request access
                  </Link>
                </>
              )}
            </p>
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            <Link to="/" className="hover:text-foreground transition-colors">
              ← Back to AegisCare homepage
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
