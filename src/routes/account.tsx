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
import { Mail, KeyRound, User } from "lucide-react";
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

  useEffect(() => {
    db.from<{ first_name: string; last_name: string; username: string }>("profiles")
      .select("first_name,last_name,username")
      .eq("id", userId)
      .then(({ data }) => {
        const row = Array.isArray(data) ? data[0] : data;
        if (row) {
          setFirstName(row.first_name ?? "");
          setLastName(row.last_name ?? "");
          setUsername(row.username ?? "");
        }
        setLoading(false);
      });
  }, [userId]);

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
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save profile"}
          </Button>
        </form>
      )}
    </section>
  );
}
