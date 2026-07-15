/**
 * LabTrack — Laboratory Records
 * Copyright (c) 2026 Francis Muhoro. All rights reserved.
 * Author: Francis Muhoro
 */

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Check, X, Clock, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/admin/requests")({
  component: AdminRequestsPage,
});

type AccessRequest = {
  id: string;
  user_id: string;
  email: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  reviewed_at: string | null;
};

function AdminRequestsPage() {
  const { isAdmin, rolesLoading, user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (!rolesLoading && user && !isAdmin) navigate({ to: "/dashboard" });
  }, [isAdmin, rolesLoading, user, navigate]);

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["access-requests"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("access_requests")
        .select("id, user_id, email, status, created_at, reviewed_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as AccessRequest[];
    },
  });

  const decide = useMutation({
    mutationFn: async ({ req, approve }: { req: AccessRequest; approve: boolean }) => {
      if (approve) {
        const { error: roleErr } = await supabase
          .from("user_roles")
          .insert({ user_id: req.user_id, role: "staff" });
        if (roleErr && !roleErr.message.includes("duplicate")) throw roleErr;
      }
      const { error } = await supabase
        .from("access_requests")
        .update({
          status: approve ? "approved" : "rejected",
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", req.id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast.success(vars.approve ? "Access granted" : "Request rejected");
      qc.invalidateQueries({ queryKey: ["access-requests"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Action failed"),
  });

  const pending = requests.filter((r) => r.status === "pending");
  const reviewed = requests.filter((r) => r.status !== "pending");

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Access requests</h1>
            <p className="text-sm text-muted-foreground">Approve or reject new staff sign-ups.</p>
          </div>
        </div>

        <section className="mt-8">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Clock className="h-4 w-4" /> Pending ({pending.length})
          </h2>
          <div className="rounded-2xl border bg-card divide-y">
            {isLoading && <div className="p-6 text-sm text-muted-foreground">Loading…</div>}
            {!isLoading && pending.length === 0 && (
              <div className="p-6 text-sm text-muted-foreground">No pending requests.</div>
            )}
            {pending.map((r) => (
              <div key={r.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="font-medium">{r.email}</div>
                  <div className="text-xs text-muted-foreground">
                    Requested {new Date(r.created_at).toLocaleString()}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => decide.mutate({ req: r, approve: false })} disabled={decide.isPending}>
                    <X className="mr-1.5 h-4 w-4" /> Reject
                  </Button>
                  <Button size="sm" onClick={() => decide.mutate({ req: r, approve: true })} disabled={decide.isPending}>
                    <Check className="mr-1.5 h-4 w-4" /> Approve
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {reviewed.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-3 text-sm font-medium text-muted-foreground">History</h2>
            <div className="rounded-2xl border bg-card divide-y">
              {reviewed.map((r) => (
                <div key={r.id} className="flex items-center justify-between p-4 text-sm">
                  <div>
                    <div className="font-medium">{r.email}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.reviewed_at ? new Date(r.reviewed_at).toLocaleString() : ""}
                    </div>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    r.status === "approved" ? "bg-emerald-500/10 text-emerald-600" : "bg-destructive/10 text-destructive"
                  }`}>{r.status}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}