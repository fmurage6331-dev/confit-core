/**
 * LabTrack — Laboratory Records
 * Copyright (c) 2026 Francis Muhoro. All rights reserved.
 * Author: Francis Muhoro
 */

import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, KeyRound } from "lucide-react";
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
    </AppShell>
  );
}
