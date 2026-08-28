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
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, KeyRound, User, ShieldCheck, ShieldX, Loader2 } from "lucide-react";
import { db } from "@/lib/supabase-untyped";
import { toast } from "sonner";

export const Route = createFileRoute("/account")({
  component: AccountPage,
});

const emailSchema = z
  .object({
    newEmail: z.string().trim().email("Enter a valid email").max(255),
    confirmEmail: z.string().trim().email("Enter a valid email").max(255),
  })
  .refine((d) => d.newEmail.toLowerCase() === d.confirmEmail.toLowerCase(), {
    message: "Emails do not match",
    path: ["confirmEmail"],
  });

function AccountPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [newEmail, setNewEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pendingNotice, setPendingNotice] = useState<string | null>(null);

  if (!loading && !user) {
    navigate({ to: "/login" });
    return null;
  }
  if (!user) return null;

  async function onChangeEmail(e: FormEvent) {
    e.preventDefault();
    const parsed = emailSchema.safeParse({ newEmail, confirmEmail });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    if (parsed.data.newEmail.toLowerCase() === user!.email?.toLowerCase()) {
      toast.error("That is already your current email.");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser(
        { email: parsed.data.newEmail },
        { emailRedirectTo: `${window.location.origin}/account` },
      );
      if (error) {
        const msg = error.message.toLowerCase();
        if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
          toast.error("That email is already in use by another account.");
        } else {
          toast.error(error.message);
        }
        return;
      }
      setPendingNotice(parsed.data.newEmail);
      setNewEmail("");
      setConfirmEmail("");
      toast.success("Confirmation link sent to your new email address.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update email");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Account settings</h1>
          <p className="text-sm text-muted-foreground">
            Manage the email and password for your account.
          </p>
        </div>

        <section className="rounded-2xl border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Change email address</h2>
              <p className="text-sm text-muted-foreground">
                Current: <span className="font-medium text-foreground">{user.email}</span>
              </p>
            </div>
          </div>

          {pendingNotice && (
            <div className="mb-4 rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">
              A confirmation link has been sent to <strong>{pendingNotice}</strong>. Please check
              your inbox to confirm the change. Your current email stays active until you confirm.
            </div>
          )}

          <form onSubmit={onChangeEmail} className="space-y-4">
            <div>
              <Label htmlFor="newEmail">New email</Label>
              <Input
                id="newEmail"
                type="email"
                autoComplete="email"
                required
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="confirmEmail">Confirm new email</Label>
              <Input
                id="confirmEmail"
                type="email"
                autoComplete="email"
                required
                value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Sending…" : "Send confirmation link"}
            </Button>
          </form>
        </section>

        <section className="rounded-2xl border bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Password</h2>
              <p className="text-sm text-muted-foreground">Update your password at any time.</p>
            </div>
          </div>
          <Link to="/change-password">
            <Button variant="outline">Change password</Button>
          </Link>
        </section>
      </div>
      <ProfileSection userId={user.id} />
      <MfaSection />
    </AppShell>
  );
}
function ProfileSection({ userId }: { userId: string }) {
  const { refreshProfile } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Practitioner registry
  const [councilType, setCouncilType] = useState("");
  const [councilRegNumber, setCouncilRegNumber] = useState("");
  const [councilVerified, setCouncilVerified] = useState(false);
  const [councilVerifiedAt, setCouncilVerifiedAt] = useState<string | null>(null);
  const [councilFullName, setCouncilFullName] = useState<string | null>(null);
  const [councilQualification, setCouncilQualification] = useState<string | null>(null);
  const [councilStatus, setCouncilStatus] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    db.from("profiles")
      .select(
        "first_name,last_name,username,council_type,council_registration_number,council_verified,council_verified_at,council_full_name,council_qualification,council_status",
      )
      .eq("id", userId)
      .then(({ data }) => {
        const row = Array.isArray(data) ? data[0] : (data as Record<string, unknown> | null);
        if (row) {
          setFirstName((row.first_name as string) ?? "");
          setLastName((row.last_name as string) ?? "");
          setUsername((row.username as string) ?? "");
          setCouncilType((row.council_type as string) ?? "");
          setCouncilRegNumber((row.council_registration_number as string) ?? "");
          setCouncilVerified((row.council_verified as boolean) ?? false);
          setCouncilVerifiedAt((row.council_verified_at as string) ?? null);
          setCouncilFullName((row.council_full_name as string) ?? null);
          setCouncilQualification((row.council_qualification as string) ?? null);
          setCouncilStatus((row.council_status as string) ?? null);
        }
        setLoading(false);
      });
  }, [userId]);

  async function verifyPractitioner() {
    if (!councilType || !councilRegNumber.trim()) {
      toast.error("Select council and enter registration number first");
      return;
    }
    setVerifying(true);
    const { data, error } = await supabase.rpc(
      "verify_practitioner" as never,
      {
        p_council_type: councilType,
        p_registration_number: councilRegNumber.trim(),
        p_profile_id: userId,
      } as never,
    );
    setVerifying(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const result = data as Record<string, unknown>;
    if (!result.connected) {
      toast.info("Health Worker Registry not yet connected — details saved manually");
    } else {
      setCouncilFullName((result.full_name as string) ?? null);
      setCouncilQualification((result.qualification as string) ?? null);
      setCouncilStatus((result.status as string) ?? null);
      setCouncilVerified(true);
      setCouncilVerifiedAt(new Date().toISOString());
      toast.success("Practitioner verified ✅");
    }
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      toast.error("First and last name are required");
      return;
    }
    if (username.trim().length < 3 || !/^[a-z0-9_]+$/.test(username)) {
      toast.error("Username: min 3 chars, lowercase letters, numbers and underscores only");
      return;
    }
    setSaving(true);
    const { error } = await db.from("profiles").upsert({
      id: userId,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      username: username.trim(),
      council_type: councilType || null,
      council_registration_number: councilRegNumber.trim() || null,
      council_verified: councilVerified,
      council_verified_at: councilVerifiedAt,
      council_full_name: councilFullName,
      council_qualification: councilQualification,
      council_status: councilStatus,
    });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await refreshProfile();
    toast.success("Profile updated");
  }

  return (
    <section className="rounded-2xl border bg-card p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <User className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Profile</h2>
          <p className="text-sm text-muted-foreground">
            Your name and username shown across the system.
          </p>
        </div>
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <form onSubmit={save} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="firstName">First name</Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="lastName">Last name</Label>
              <Input
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </div>
          </div>
          <div>
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              placeholder="e.g. john_doe"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Lowercase letters, numbers and underscores only. Must be unique.
            </p>
          </div>

          {/* Practitioner Registry */}
          <div className="border-t pt-4 space-y-3">
            <div>
              <h3 className="text-sm font-semibold">Practitioner Registry</h3>
              <p className="text-xs text-muted-foreground">
                Required for DHA compliance — links your account to your professional council.
              </p>
            </div>

            {councilVerified && (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-700">
                <ShieldCheck className="h-4 w-4 shrink-0" />
                <div>
                  <span className="font-medium">Verified</span>
                  {councilFullName && <span className="ml-1">— {councilFullName}</span>}
                  {councilQualification && <span className="ml-1">({councilQualification})</span>}
                  {councilVerifiedAt && (
                    <span className="ml-1 text-xs text-emerald-600">
                      · {new Date(councilVerifiedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            )}

            {!councilVerified && councilRegNumber && (
              <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-700">
                <ShieldX className="h-4 w-4 shrink-0" />
                Not yet verified — click "Verify" to check with registry
              </div>
            )}

            <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs text-blue-700">
              Health Worker Registry (HWR) not yet connected. Enter your details manually —
              verification will activate when DHA credentials are configured.
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Professional Council</Label>
                <select
                  value={councilType}
                  onChange={(e) => setCouncilType(e.target.value)}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select council</option>
                  <option value="KMPDC">KMPDC — Doctors & Dentists</option>
                  <option value="NCK">NCK — Nurses</option>
                  <option value="KMLTTB">KMLTTB — Lab Technologists</option>
                  <option value="other">Other</option>
                  <option value="none">Not applicable</option>
                </select>
              </div>
              <div>
                <Label>Registration Number</Label>
                <Input
                  value={councilRegNumber}
                  onChange={(e) => setCouncilRegNumber(e.target.value)}
                  placeholder="e.g. KMPDC/2024/001234"
                />
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={verifyPractitioner}
              disabled={verifying || !councilType || !councilRegNumber.trim()}
            >
              {verifying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying…
                </>
              ) : (
                <>
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Verify with Registry
                </>
              )}
            </Button>
          </div>

          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save profile"}
          </Button>
        </form>
      )}
    </section>
  );
}
function MfaSection() {
  const [factors, setFactors] = useState<
    Array<{ id: string; friendly_name?: string; status: string }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [otp, setOtp] = useState("");

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.auth.mfa.listFactors();
    setFactors(data?.totp ?? []);
    setLoading(false);
  }

  async function startEnroll() {
    setEnrolling(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "AegisCare HMS",
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
      setFactorId(data.id);
      const { data: cd, error: ce } = await supabase.auth.mfa.challenge({
        factorId: data.id,
      });
      if (ce) {
        toast.error(ce.message);
        return;
      }
      setChallengeId(cd.id);
    } finally {
      setEnrolling(false);
    }
  }

  async function verify() {
    if (!factorId || !challengeId) return;
    setVerifying(true);
    try {
      const { error } = await supabase.auth.mfa.verify({
        factorId,
        challengeId,
        code: otp.trim(),
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Two-factor authentication enabled");
      setQrCode(null);
      setSecret(null);
      setFactorId(null);
      setChallengeId(null);
      setOtp("");
      await load();
    } finally {
      setVerifying(false);
    }
  }

  async function removeFactor(id: string) {
    setRemoving(true);
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Two-factor authentication removed");
      await load();
    } finally {
      setRemoving(false);
    }
  }

  const verified = factors.filter((f) => f.status === "verified");

  return (
    <section className="rounded-2xl border bg-card p-6 shadow-sm mx-auto max-w-2xl mt-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Two-Factor Authentication (2FA)</h2>
          <p className="text-sm text-muted-foreground">
            Required for DHA compliance. Use Google Authenticator or Authy.
          </p>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          {verified.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-700">
                <ShieldCheck className="h-4 w-4 shrink-0" />
                <span className="font-medium">2FA is active</span>
                <span className="text-xs text-emerald-600">— your account is protected</span>
              </div>
              {verified.map((f) => (
                <div
                  key={f.id}
                  className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                >
                  <span className="font-medium">{f.friendly_name ?? "Authenticator App"}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={removing}
                    onClick={() => void removeFactor(f.id)}
                  >
                    {removing ? <Loader2 className="h-3 w-3 animate-spin" /> : "Remove"}
                  </Button>
                </div>
              ))}
            </div>
          ) : qrCode ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-sm text-blue-700">
                Scan the QR code with your authenticator app, then enter the 6-digit code to
                confirm.
              </div>
              <div className="flex justify-center">
                <img
                  src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrCode)}`}
                  alt="MFA QR Code"
                  className="h-48 w-48 rounded-lg border bg-white"
                />
              </div>
              {secret && (
                <div className="rounded-lg border bg-muted px-3 py-2 text-xs font-mono text-center break-all">
                  Manual key: {secret}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="otpCode">6-digit code from app</Label>
                <Input
                  id="otpCode"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  className="text-center text-lg tracking-widest font-mono w-40"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={() => void verify()} disabled={verifying || otp.length !== 6}>
                  {verifying ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verifying…
                    </>
                  ) : (
                    "Confirm & Enable 2FA"
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setQrCode(null);
                    setSecret(null);
                    setFactorId(null);
                    setChallengeId(null);
                    setOtp("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-700">
                <ShieldX className="h-4 w-4 shrink-0" />
                2FA is not enabled — your account is less secure
              </div>
              <Button onClick={() => void startEnroll()} disabled={enrolling}>
                {enrolling ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Setting up…
                  </>
                ) : (
                  <>
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    Enable Two-Factor Authentication
                  </>
                )}
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
