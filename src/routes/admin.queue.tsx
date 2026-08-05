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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
} from "lucide-react";

export const Route = createFileRoute("/admin/queue")({
  component: () => (
    <AppShell>
      <QueuePage />
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
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Radio className="h-8 w-8 text-primary" />
            Claims Queue
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            DHA outbound queue — dual-rail claims dispatcher
          </p>
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
