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
import { FlaskConical } from "lucide-react";
import { toast } from "sonner";

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

const signupSchema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, {
  message: "Passwords do not match",
  path: ["confirm"],
});

function LoginPage() {
  const navigate = useNavigate();
  const { mode, next } = Route.useSearch();
  const isSignup = mode === "signup";
  const { user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const goNext = () => {
    if (next) window.location.href = next;
    else navigate({ to: "/dashboard" });
  };

  useEffect(() => {
    if (!loading && user) goNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading]);

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
          options: { emailRedirectTo: next ? `${window.location.origin}${next}` : `${window.location.origin}/dashboard` },
        });
        if (error) throw error;
        if (data.session) {
          toast.success("Account created. Welcome!");
          goNext();
        } else {
          // Email confirmation is required by project settings.
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
            toast.error(error.message);
          }
          return;
        }
        goNext();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : isSignup ? "Sign up failed" : "Sign in failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <FlaskConical className="h-5 w-5" />
          </div>
          <span className="text-xl font-semibold">Aegiscare</span>
        </Link>
        <div className="rounded-2xl border bg-card p-8 shadow-[var(--shadow-elevated)]">
          <h1 className="text-2xl font-bold">{isSignup ? "Create your account" : "Sign in"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isSignup
              ? "Sign up to request access to the lab workspace."
              : "Use the credentials provided by your administrator or that you signed up with."}
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
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
              <Link to="/forgot-password" className="text-primary hover:underline">Forgot password?</Link>
            </p>
          )}

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {isSignup ? (
              <>
                Already have an account?{" "}
                <Link to="/login" search={{ mode: "signin" }} className="font-medium text-primary hover:underline">
                  Sign in
                </Link>
              </>
            ) : (
              <>
                Need an account?{" "}
                <Link to="/login" search={{ mode: "signup" }} className="font-medium text-primary hover:underline">
                  Create one
                </Link>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}