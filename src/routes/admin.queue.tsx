/**
 * LabTrack — Claims Queue Monitor (admin only)
 * Monitors dha_outbound_queue — dual-rail claims dispatcher
 */

import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "@/lib/supabase-untyped";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/lib/auth-context";
import { AccessDenied } from "@/lib/require-access";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Radio,
  RefreshCw,
  Eye,
  Code2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  SkipForward,
  FileDown,
  Send,
  CreditCard,
  RotateCcw,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/admin/queue")({
  component: () => (
    <AppShell>
      <div className="mx-auto max-w-7xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Admin Queue</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            DHA outbound queue and insurance claims aging report.
          </p>
        </div>
        <Tabs defaultValue="outbound">
          <TabsList className="mb-6">
            <TabsTrigger value="outbound">Outbound Queue</TabsTrigger>
            <TabsTrigger value="shaClaims">SHA Claims</TabsTrigger>
            <TabsTrigger value="claims">Claims Aging</TabsTrigger>
          </TabsList>
          <TabsContent value="outbound">
            <QueuePage />
          </TabsContent>
          <TabsContent value="shaClaims">
            <ShaClaimsQueue />
          </TabsContent>
          <TabsContent value="claims">
            <ClaimsAging />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  ),
});

type QueueRow = {
  id: string;
  encounter_id: string | null;
  patient_id: string | null;
  queue_type: "fhir_sync" | "sha_claim" | "private_claim" | "cash_receipt";
  insurer_type: string | null;
  payload: Record<string, unknown> | null;
  status: "pending" | "processing" | "sent" | "acknowledged" | "failed" | "skipped";
  attempts: number | null;
  last_attempted_at: string | null;
  response: Record<string, unknown> | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  processing: "bg-blue-100 text-blue-800 border-blue-200",
  sent: "bg-green-100 text-green-800 border-green-200",
  acknowledged: "bg-emerald-100 text-emerald-800 border-emerald-200",
  failed: "bg-red-100 text-red-800 border-red-200",
  skipped: "bg-gray-100 text-gray-600 border-gray-200",
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  pending: <Clock className="h-3 w-3" />,
  processing: <RefreshCw className="h-3 w-3 animate-spin" />,
  sent: <CheckCircle2 className="h-3 w-3" />,
  acknowledged: <CheckCircle2 className="h-3 w-3" />,
  failed: <XCircle className="h-3 w-3" />,
  skipped: <SkipForward className="h-3 w-3" />,
};

const QUEUE_COLORS: Record<string, string> = {
  fhir_sync: "bg-purple-100 text-purple-800 border-purple-200",
  sha_claim: "bg-blue-100 text-blue-800 border-blue-200",
  private_claim: "bg-orange-100 text-orange-800 border-orange-200",
  cash_receipt: "bg-gray-100 text-gray-600 border-gray-200",
};

function QueuePage() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();

  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState(
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
  );
  const [dateTo, setDateTo] = useState(new Date().toISOString().split("T")[0]);
  const [viewRow, setViewRow] = useState<QueueRow | null>(null);
  const [fhirRow, setFhirRow] = useState<QueueRow | null>(null);
  const [fhirPayload, setFhirPayload] = useState<Record<string, unknown> | null>(null);
  const [fhirLoading, setFhirLoading] = useState(false);

  const {
    data: rows = [],
    isLoading,
    refetch,
  } = useQuery<QueueRow[]>({
    queryKey: ["admin-queue", statusFilter, typeFilter, dateFrom, dateTo],
    queryFn: async () => {
      let q = db
        .from("dha_outbound_queue")
        .select("*")
        .gte("created_at", `${dateFrom}T00:00:00`)
        .lte("created_at", `${dateTo}T23:59:59`)
        .order("created_at", { ascending: false });
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      if (typeFilter !== "all") q = q.eq("queue_type", typeFilter);
      const { data } = await q;
      return (data ?? []) as QueueRow[];
    },
  });

  const stats = useMemo(
    () => ({
      pending: rows.filter((r) => r.status === "pending").length,
      failed: rows.filter((r) => r.status === "failed").length,
      sent: rows.filter((r) => r.status === "sent" || r.status === "acknowledged").length,
      skipped: rows.filter((r) => r.status === "skipped").length,
    }),
    [rows],
  );
  const retry = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db
        .from("dha_outbound_queue")
        .update({
          status: "pending",
          last_attempted_at: new Date().toISOString(),
          error_message: null,
        })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Item reset to pending — will retry on next dispatch");
      qc.invalidateQueries({ queryKey: ["admin-queue"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!isAdmin) return <AccessDenied message="Admin only." />;

  async function previewFhir(row: QueueRow) {
    if (!row.encounter_id) return;
    setFhirRow(row);
    setFhirPayload(null);
    setFhirLoading(true);
    const { data, error } = await supabase.rpc(
      "generate_fhir_encounter" as never,
      { p_encounter_id: row.encounter_id } as never,
    );
    setFhirLoading(false);
    if (error) {
      toast.error(error.message);
      setFhirRow(null);
      return;
    }
    setFhirPayload(data as Record<string, unknown>);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Radio className="h-5 w-5 text-primary" />
            DHA Outbound Queue
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Dual-rail claims dispatcher</p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Pending" value={stats.pending} color="amber" />
        <StatCard label="Failed" value={stats.failed} color="red" />
        <StatCard label="Sent / Acknowledged" value={stats.sent} color="green" />
        <StatCard label="Skipped" value={stats.skipped} color="gray" />
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold">Phase 3 — API Integration Pending.</span> All items are
          queued locally. External submission to SHA portal, private insurers, and DHA AfyaLink HIE
          will activate automatically when API credentials are configured.
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label className="text-xs">Status</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="acknowledged">Acknowledged</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="skipped">Skipped</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Queue type</Label>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="fhir_sync">FHIR Sync</SelectItem>
              <SelectItem value="sha_claim">SHA Claim</SelectItem>
              <SelectItem value="private_claim">Private Claim</SelectItem>
              <SelectItem value="cash_receipt">Cash Receipt</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">From</Label>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-36"
          />
        </div>
        <div>
          <Label className="text-xs">To</Label>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-36"
          />
        </div>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Insurer</th>
                <th className="px-4 py-3">Attempts</th>
                <th className="px-4 py-3">Error</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              )}
              {!isLoading && rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    No queue items match the selected filters.
                  </td>
                </tr>
              )}
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(row.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
                        QUEUE_COLORS[row.queue_type] ?? "bg-gray-100"
                      }`}
                    >
                      {row.queue_type.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${
                        STATUS_COLORS[row.status] ?? "bg-gray-100"
                      }`}
                    >
                      {STATUS_ICONS[row.status]}
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs capitalize">{row.insurer_type ?? "—"}</td>
                  <td className="px-4 py-3 text-center font-mono text-xs">{row.attempts ?? 0}</td>
                  <td className="px-4 py-3 text-xs text-red-600 max-w-[200px] truncate">
                    {row.error_message ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2"
                        onClick={() => setViewRow(row)}
                        title="View payload"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      {row.encounter_id && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2"
                          onClick={() => previewFhir(row)}
                          title="Preview FHIR"
                        >
                          <Code2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {(row.status === "failed" || row.status === "skipped") && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-amber-600 hover:text-amber-700"
                          onClick={() => retry.mutate(row.id)}
                          disabled={retry.isPending}
                          title="Retry"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {viewRow && (
        <Dialog open onOpenChange={(o) => !o && setViewRow(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Queue Item — {viewRow.queue_type.replace("_", " ")}</DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {viewRow.payload && (
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                    Payload
                  </div>
                  <pre className="rounded-lg bg-muted p-3 text-xs overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(viewRow.payload, null, 2)}
                  </pre>
                </div>
              )}
              {viewRow.response && (
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                    Response
                  </div>
                  <pre className="rounded-lg bg-muted p-3 text-xs overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(viewRow.response, null, 2)}
                  </pre>
                </div>
              )}
              {viewRow.error_message && (
                <div>
                  <div className="text-xs uppercase tracking-wide text-red-500 mb-1">Error</div>
                  <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700">
                    {viewRow.error_message}
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {fhirRow && (
        <Dialog open onOpenChange={(o) => !o && setFhirRow(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>FHIR R4 Encounter Preview</DialogTitle>
            </DialogHeader>
            <p className="text-xs text-muted-foreground">
              This is the payload that will be sent to the DHA AfyaLink HIE
            </p>
            <div className="flex-1 overflow-y-auto pr-1">
              {fhirLoading && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Generating FHIR payload…
                </div>
              )}
              {!fhirLoading && fhirPayload && (
                <>
                  <pre className="rounded-lg bg-muted p-3 text-xs overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(fhirPayload, null, 2)}
                  </pre>
                  <Button
                    className="mt-3 w-full"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify(fhirPayload, null, 2));
                      toast.success("Copied to clipboard");
                    }}
                  >
                    Copy to clipboard
                  </Button>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ── SHA Claims State Machine ─────────────────────────────────────────────────

type ShaClaimRow = {
  id: string;
  encounter_id: string | null;
  patient_id: string | null;
  claim_number: string | null;
  dha_claim_id: string | null;
  fund_type: string | null;
  status: string | null;
  claim_subtype: string | null;
  total_amount: number | null;
  approved_amount: number | null;
  rejected_amount: number | null;
  rejection_reason: string | null;
  resubmission_count: number | null;
  preauth_status: string | null;
  cr_number_missing: boolean | null;
  sha_member_missing: boolean | null;
  fhir_built_at: string | null;
  submitted_at: string | null;
  created_at: string | null;
  payment_reference: string | null;
  payment_date: string | null;
  patient_name: string | null;
  file_number: string | null;
  sha_member_number: string | null;
  age_days: number | null;
  aging_status: string | null;
};

const SHA_STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700 border-gray-200",
  pending_otp: "bg-gray-100 text-gray-700 border-gray-200",
  pending_preauth: "bg-amber-100 text-amber-800 border-amber-200",
  ready: "bg-blue-100 text-blue-800 border-blue-200",
  submitted: "bg-blue-100 text-blue-800 border-blue-200",
  acknowledged: "bg-cyan-100 text-cyan-800 border-cyan-200",
  approved: "bg-green-100 text-green-800 border-green-200",
  rejected: "bg-red-100 text-red-800 border-red-200",
  appealed: "bg-orange-100 text-orange-800 border-orange-200",
  paid: "bg-emerald-100 text-emerald-800 border-emerald-200",
  payment_completed: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

function ShaClaimsQueue() {
  const { isAdmin, user } = useAuth();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [busy, setBusy] = useState(false);
  const [paymentRow, setPaymentRow] = useState<ShaClaimRow | null>(null);
  const [paymentRef, setPaymentRef] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));

  const {
    data: rows = [],
    isLoading,
    refetch,
  } = useQuery<ShaClaimRow[]>({
    queryKey: ["sha-claims-queue", statusFilter],
    queryFn: async () => {
      let q = db.from("sha_claims_aging").select("*").order("created_at", { ascending: false });
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return (data ?? []) as ShaClaimRow[];
    },
  });

  if (!isAdmin) return <AccessDenied message="Admin only." />;

  async function insertHistory(row: ShaClaimRow, newStatus: string, reason: string | null) {
    const { error } = await db.from("sha_claim_status_history").insert({
      claim_id: row.id,
      previous_status: row.status ?? null,
      new_status: newStatus,
      changed_by: user?.id ?? null,
      reason,
      notes: reason,
      created_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
  }

  async function transition(
    row: ShaClaimRow,
    newStatus: string,
    extra: Record<string, unknown>,
    reason: string | null,
    successMessage: string,
  ) {
    setBusy(true);
    try {
      const now = new Date().toISOString();
      const { error } = await db
        .from("sha_claims")
        .update({
          status: newStatus,
          updated_at: now,
          last_status_check: now,
          ...extra,
        } as Record<string, unknown>)
        .eq("id", row.id);
      if (error) throw new Error(error.message);
      await insertHistory(row, newStatus, reason);
      toast.success(successMessage);
      qc.invalidateQueries({ queryKey: ["sha-claims-queue"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function recordPayment() {
    if (!paymentRow) return;
    if (!paymentRef.trim()) {
      toast.error("Payment reference is required");
      return;
    }
    await transition(
      paymentRow,
      "payment_completed",
      {
        payment_reference: paymentRef.trim(),
        payment_date: paymentDate || new Date().toISOString().slice(0, 10),
        approved_amount: paymentRow.approved_amount ?? paymentRow.total_amount,
      },
      "Payment recorded on SHA claim",
      "Payment recorded",
    );
    setPaymentRow(null);
    setPaymentRef("");
    setPaymentDate(new Date().toISOString().slice(0, 10));
  }

  function rejectWithReason(row: ShaClaimRow) {
    const reason = window.prompt("Rejection reason");
    if (reason === null) return;
    void transition(
      row,
      "rejected",
      {},
      reason.trim() || "Rejected from SHA claims queue",
      "Claim marked rejected",
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Radio className="h-5 w-5 text-primary" />
            SHA Claims State Machine
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Review draft/submitted/rejected SHA claims and process approvals, rejections,
            resubmissions and payments.
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={busy}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label className="text-xs">Status</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="submitted">Submitted</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="payment_completed">Payment completed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="text-xs text-muted-foreground pb-2">
          {rows.length} claim{rows.length !== 1 ? "s" : ""}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Patient</th>
                <th className="px-4 py-3">Claim Ref</th>
                <th className="px-4 py-3">Fund</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3">Preauth</th>
                <th className="px-4 py-3">Alerts</th>
                <th className="px-4 py-3 text-center">Age</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading && (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              )}
              {!isLoading && rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-muted-foreground">
                    No SHA claims match the selected filters.
                  </td>
                </tr>
              )}
              {rows.map((row) => {
                const status = row.status ?? "draft";
                const resubCount = row.resubmission_count ?? 0;
                const missingData =
                  Boolean(row.cr_number_missing) || Boolean(row.sha_member_missing);
                const submittedAt = row.submitted_at ? new Date(row.submitted_at).getTime() : 0;
                const overdueResponse =
                  row.status === "submitted" &&
                  submittedAt > 0 &&
                  (Date.now() - submittedAt) / (1000 * 60 * 60 * 24) > 30;
                const overdueSubmission = row.aging_status === "overdue_submission";
                const overdue = overdueResponse || overdueSubmission;

                return (
                  <tr key={row.id} className="hover:bg-muted/20 align-top">
                    <td className="px-4 py-3">
                      <div className="font-medium">{row.patient_name ?? "—"}</div>
                      {row.file_number && (
                        <div className="text-xs text-muted-foreground">{row.file_number}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <code className="text-xs">{row.claim_number ?? "—"}</code>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="text-xs">
                        {row.fund_type ?? "—"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={`text-xs uppercase ${SHA_STATUS_COLORS[status] ?? "bg-gray-100"}`}
                      >
                        {status.replace(/_/g, " ")}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      KSh {Number(row.total_amount ?? 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-xs capitalize">{row.preauth_status ?? "—"}</td>
                    <td className="px-4 py-3 space-y-1 min-w-[180px]">
                      {row.fund_type === "PHF" && (
                        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-800">
                          PHF Claim — SHA covers 100%. Zero patient copay.
                        </div>
                      )}
                      <div className="flex flex-wrap gap-1">
                        {overdue && (
                          <Badge className="bg-red-100 text-red-700 border-red-200">Overdue</Badge>
                        )}
                        {resubCount > 0 && (
                          <Badge className="bg-orange-100 text-orange-700 border-orange-200">
                            Resubmitted ×{resubCount}
                          </Badge>
                        )}
                        {missingData && (
                          <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
                            Missing data
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-xs tabular-nums">
                      {row.age_days != null ? `${row.age_days}d` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        {status === "draft" && (
                          <Button
                            size="sm"
                            className="h-7 px-2"
                            disabled={busy}
                            onClick={() =>
                              void transition(
                                row,
                                "submitted",
                                { submitted_at: new Date().toISOString() },
                                "Submitted from claims queue",
                                "Claim submitted",
                              )
                            }
                          >
                            <Send className="mr-1 h-3.5 w-3.5" />
                            Submit Claim
                          </Button>
                        )}
                        {status === "submitted" && (
                          <>
                            <Button
                              size="sm"
                              className="h-7 px-2 bg-green-600 hover:bg-green-700"
                              disabled={busy}
                              onClick={() =>
                                void transition(
                                  row,
                                  "approved",
                                  { approved_amount: row.approved_amount ?? row.total_amount },
                                  "Marked approved from claims queue",
                                  "Claim approved",
                                )
                              }
                            >
                              <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                              Mark Approved
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-red-600 hover:text-red-700"
                              disabled={busy}
                              onClick={() => rejectWithReason(row)}
                            >
                              <XCircle className="mr-1 h-3.5 w-3.5" />
                              Mark Rejected
                            </Button>
                          </>
                        )}
                        {status === "approved" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-emerald-700"
                            disabled={busy}
                            onClick={() => setPaymentRow(row)}
                          >
                            <CreditCard className="mr-1 h-3.5 w-3.5" />
                            Record Payment
                          </Button>
                        )}
                        {status === "rejected" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2"
                            disabled={busy}
                            onClick={() =>
                              void transition(
                                row,
                                "submitted",
                                {
                                  resubmission_count: resubCount + 1,
                                  submitted_at: new Date().toISOString(),
                                },
                                `Resubmitted (attempt ${resubCount + 1})`,
                                "Claim resubmitted",
                              )
                            }
                          >
                            <RotateCcw className="mr-1 h-3.5 w-3.5" />
                            Resubmit
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {paymentRow && (
        <Dialog open onOpenChange={(o) => !o && setPaymentRow(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Record SHA Payment</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="text-xs text-muted-foreground">
                Claim {paymentRow.claim_number ?? paymentRow.id}
              </div>
              <div>
                <Label>Payment reference</Label>
                <Input
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  placeholder="e.g. SHA-PAY-2026-12345"
                />
              </div>
              <div>
                <Label>Payment date</Label>
                <Input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setPaymentRow(null);
                  setPaymentRef("");
                }}
              >
                Cancel
              </Button>
              <Button type="button" onClick={() => void recordPayment()} disabled={busy}>
                <CreditCard className="mr-1 h-4 w-4" />
                Record payment
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "amber" | "red" | "green" | "gray";
}) {
  const colors = {
    amber: "text-amber-600 bg-amber-50 border-amber-200",
    red: "text-red-600 bg-red-50 border-red-200",
    green: "text-emerald-600 bg-emerald-50 border-emerald-200",
    gray: "text-gray-600 bg-gray-50 border-gray-200",
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-xs mt-1 font-medium">{label}</div>
    </div>
  );
}

// ── Claims Aging ──────────────────────────────────────────────────────────────

type AgingRow = {
  encounter_id: string;
  patient_name: string;
  file_number: string | null;
  invoice_id: string | null;
  invoice_number: string | null;
  insurer_name: string | null;
  insurer_code: string | null;
  claim_number: string | null;
  claim_status: string | null;
  claim_submitted_at: string | null;
  total_due: number;
  amount_paid: number;
  balance: number;
  invoice_created_at: string;
  age_days: number;
  bucket: "0-30" | "31-60" | "61-90" | "91+";
};

const BUCKET_COLORS: Record<string, string> = {
  "0-30": "bg-emerald-100 text-emerald-800 border-emerald-200",
  "31-60": "bg-amber-100 text-amber-800 border-amber-200",
  "61-90": "bg-orange-100 text-orange-800 border-orange-200",
  "91+": "bg-red-100 text-red-800 border-red-200",
};

function ageBucket(days: number): AgingRow["bucket"] {
  if (days <= 30) return "0-30";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  return "91+";
}

function ClaimsAging() {
  const { isAdmin } = useAuth();
  const [bucketFilter, setBucketFilter] = useState("all");

  const {
    data: rows = [],
    isLoading,
    refetch,
  } = useQuery<AgingRow[]>({
    queryKey: ["claims-aging"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select(
          "id,invoice_number,total_due,amount_paid,balance,status,created_at," +
            "encounters!inner(id,payment_mode,claim_number,claim_status,claim_submitted_at," +
            "insurance_provider_id,insurance_providers(name,code)," +
            "patients!inner(patient_name,file_number))",
        )
        .in("status", ["unpaid", "partial"])
        .eq("encounters.payment_mode", "insurance")
        .order("created_at", { ascending: true });
      if (error) throw error;
      const now = Date.now();
      return ((data ?? []) as never[]).map((row: never) => {
        const inv = row as {
          id: string;
          invoice_number: string;
          total_due: number;
          amount_paid: number;
          balance: number;
          created_at: string;
          encounters: {
            id: string;
            claim_number: string | null;
            claim_status: string | null;
            claim_submitted_at: string | null;
            insurance_providers: { name: string; code: string } | null;
            patients: { patient_name: string; file_number: string | null };
          };
        };
        const ageDays = Math.floor(
          (now - new Date(inv.created_at).getTime()) / (1000 * 60 * 60 * 24),
        );
        return {
          encounter_id: inv.encounters.id,
          patient_name: inv.encounters.patients.patient_name,
          file_number: inv.encounters.patients.file_number,
          invoice_id: inv.id,
          invoice_number: inv.invoice_number,
          insurer_name: inv.encounters.insurance_providers?.name ?? null,
          insurer_code: inv.encounters.insurance_providers?.code ?? null,
          claim_number: inv.encounters.claim_number,
          claim_status: inv.encounters.claim_status,
          claim_submitted_at: inv.encounters.claim_submitted_at,
          total_due: Number(inv.total_due),
          amount_paid: Number(inv.amount_paid),
          balance: Number(inv.balance),
          invoice_created_at: inv.created_at,
          age_days: ageDays,
          bucket: ageBucket(ageDays),
        } satisfies AgingRow;
      });
    },
  });

  if (!isAdmin) return <AccessDenied />;

  const filtered = bucketFilter === "all" ? rows : rows.filter((r) => r.bucket === bucketFilter);

  const totals = {
    "0-30": rows.filter((r) => r.bucket === "0-30").reduce((s, r) => s + r.balance, 0),
    "31-60": rows.filter((r) => r.bucket === "31-60").reduce((s, r) => s + r.balance, 0),
    "61-90": rows.filter((r) => r.bucket === "61-90").reduce((s, r) => s + r.balance, 0),
    "91+": rows.filter((r) => r.bucket === "91+").reduce((s, r) => s + r.balance, 0),
  };
  const grandTotal = rows.reduce((s, r) => s + r.balance, 0);

  function exportCSV() {
    const header = [
      "Patient",
      "File No",
      "Invoice No",
      "Insurer",
      "Claim No",
      "Claim Status",
      "Invoice Date",
      "Age (days)",
      "Bucket",
      "Total Due",
      "Paid",
      "Outstanding",
    ];
    const dataRows = filtered.map((r) => [
      r.patient_name,
      r.file_number ?? "",
      r.invoice_number ?? "",
      r.insurer_name ?? "",
      r.claim_number ?? "",
      r.claim_status ?? "",
      r.invoice_created_at.split("T")[0],
      r.age_days,
      r.bucket,
      r.total_due.toFixed(2),
      r.amount_paid.toFixed(2),
      r.balance.toFixed(2),
    ]);
    const csv = [header, ...dataRows]
      .map((row) =>
        row
          .map((c) => {
            const s = String(c ?? "");
            return s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
          })
          .join(","),
      )
      .join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ClaimsAging_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(["0-30", "31-60", "61-90", "91+"] as const).map((b) => (
          <div key={b} className={`rounded-xl border p-4 ${BUCKET_COLORS[b]}`}>
            <div className="text-2xl font-bold tabular-nums">
              KSh {totals[b].toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <div className="mt-1 text-xs font-medium">{b} days</div>
            <div className="text-xs opacity-70">
              {rows.filter((r) => r.bucket === b).length} claims
            </div>
          </div>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm font-medium">
          Total outstanding:{" "}
          <span className="font-bold text-red-700">
            KSh {grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </span>{" "}
          across {rows.length} claim{rows.length !== 1 ? "s" : ""}
        </div>
        <div className="flex items-center gap-2">
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={bucketFilter}
            onChange={(e) => setBucketFilter(e.target.value)}
          >
            <option value="all">All buckets</option>
            <option value="0-30">0–30 days</option>
            <option value="31-60">31–60 days</option>
            <option value="61-90">61–90 days</option>
            <option value="91+">91+ days</option>
          </select>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="mr-1 h-3 w-3" /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <FileDown className="mr-1 h-3 w-3" /> Export CSV
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Patient</th>
                <th className="px-4 py-3">Invoice</th>
                <th className="px-4 py-3">Insurer</th>
                <th className="px-4 py-3">Claim Ref</th>
                <th className="px-4 py-3">Claim Status</th>
                <th className="px-4 py-3">Invoice Date</th>
                <th className="px-4 py-3 text-center">Age</th>
                <th className="px-4 py-3 text-right">Total Due</th>
                <th className="px-4 py-3 text-right">Paid</th>
                <th className="px-4 py-3 text-right">Outstanding</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-muted-foreground">
                    No outstanding insurance claims.
                  </td>
                </tr>
              )}
              {filtered.map((r) => (
                <tr key={r.invoice_id} className="border-t hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <div className="font-medium">{r.patient_name}</div>
                    {r.file_number && (
                      <div className="text-xs text-muted-foreground">{r.file_number}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{r.invoice_number ?? "—"}</td>
                  <td className="px-4 py-3">
                    {r.insurer_name ? (
                      <>
                        <div className="font-medium">{r.insurer_name}</div>
                        <code className="text-xs text-muted-foreground">{r.insurer_code}</code>
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{r.claim_number ?? "—"}</td>
                  <td className="px-4 py-3">
                    {r.claim_status ? (
                      <Badge variant="outline" className="text-xs capitalize">
                        {r.claim_status.replace(/_/g, " ")}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">Not submitted</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">{r.invoice_created_at.split("T")[0]}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant="outline" className={`text-xs ${BUCKET_COLORS[r.bucket]}`}>
                      {r.age_days}d
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.total_due.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-emerald-700">
                    {r.amount_paid.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold text-red-700">
                    {r.balance.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => window.open(`/invoices/${r.invoice_id}`, "_blank")}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
