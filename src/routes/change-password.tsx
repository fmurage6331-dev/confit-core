/**
 * LabTrack — Laboratory Records
 * Copyright (c) 2026 Francis Muhoro. All rights reserved.
 * Author: Francis Muhoro
 */

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FlaskConical, KeyRound } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/change-password")({
  component: ChangePasswordPage,
});

const schema = z.object({ password: z.string().min(8).max(72) });

function ChangePasswordPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!loading && !user) { navigate({ to: "/login" }); return null; }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (pw !== pw2) return toast.error("Passwords don't match");
    const parsed = schema.safeParse({ password: pw });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setSubmitting(true);
    try {
      // Update password AND clear must_change_password flag in one call.
      // This refreshes the local session so AppShell won't loop back here.
      const { error } = await supabase.auth.updateUser({
        password: pw,
        data: { must_change_password: false },
      });
      if (error) throw error;
      await supabase.auth.refreshSession();
      toast.success("Password updated");
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <FlaskConical className="h-5 w-5" />
          </div>
          <span className="text-xl font-semibold">Aegiscare</span>
        </div>
        <div className="rounded-2xl border bg-card p-8 shadow-[var(--shadow-elevated)]">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Set a new password</h1>
              <p className="text-sm text-muted-foreground">Required before continuing.</p>
            </div>
          </div>
          <form onSubmit={onSubmit} className="space-y-4">
            <div><Label>New password</Label><Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} /></div>
            <div><Label>Confirm password</Label><Input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></div>
            <Button type="submit" className="w-full" disabled={submitting}>{submitting ? "Saving…" : "Update password"}</Button>
          </form>
        </div>
      </div>
    </div>
  );
}