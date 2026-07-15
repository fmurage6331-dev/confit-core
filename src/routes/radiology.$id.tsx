/**
 * LabTrack — Radiology order detail (worklist item).
 * Update status, enter findings, upload scan images.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { PermGuard } from "@/lib/require-access";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { ArrowLeft, Upload, Trash2, Image as ImageIcon, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export const Route = createFileRoute("/radiology/$id")({
  component: () => (
    <AppShell>
      <PermGuard perm="radiology_view">
        <RadiologyDetail />
      </PermGuard>
    </AppShell>
  ),
});

const BUCKET = "radiology-images";

type OrderRow = {
  id: string;
  status: string | null;
  priority: string | null;
  clinical_indication: string | null;
  ordered_at: string;
  patient_id: string | null;
  encounter_id: string | null;
  patients: { patient_name: string | null; file_number: string | null; sex: string | null; date_of_birth: string | null; estimated_age: number | null } | null;
  lab_test_catalog: { name: string | null; category: string | null } | null;
};

type ResultRow = {
  id: string;
  order_id: string;
  findings: string | null;
  impression: string | null;
  radiologist: string | null;
  image_paths: string[] | null;
  reported_at: string | null;
};

function RadiologyDetail() {
  const { id } = Route.useParams();
  
  const qc = useQueryClient();
  const { hasPerm, user } = useAuth();
  const canWrite = hasPerm("radiology_results_create") || hasPerm("radiology_update");
  const canUpdateStatus = hasPerm("radiology_update");

  const { data: order, isLoading } = useQuery({
    queryKey: ["radiology-order", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("radiology_orders")
        .select("id,status,priority,clinical_indication,ordered_at,patient_id,encounter_id,patients(patient_name,file_number,sex,date_of_birth,estimated_age),lab_test_catalog(name,category)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as unknown as OrderRow;
    },
  });

  const { data: result } = useQuery({
    queryKey: ["radiology-result", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("radiology_results")
        .select("id,order_id,findings,impression,radiologist,image_paths,reported_at")
        .eq("order_id", id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as ResultRow | null;
    },
  });

  const [findings, setFindings] = useState("");
  const [impression, setImpression] = useState("");
  const [radiologist, setRadiologist] = useState("");
  useEffect(() => {
    setFindings(result?.findings ?? "");
    setImpression(result?.impression ?? "");
    setRadiologist(result?.radiologist ?? user?.email ?? "");
  }, [result, user?.email]);

  const paths = useMemo<string[]>(() => (result?.image_paths as string[] | null) ?? [], [result]);

  const updateStatus = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase.from("radiology_orders").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status updated");
      qc.invalidateQueries({ queryKey: ["radiology-order", id] });
      qc.invalidateQueries({ queryKey: ["radiology-orders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveResult = useMutation({
    mutationFn: async (opts?: { markCompleted?: boolean; imagePaths?: string[] }) => {
      const nextPaths = opts?.imagePaths ?? paths;
      const payload = {
        order_id: id,
        findings: findings.trim() || null,
        impression: impression.trim() || null,
        radiologist: radiologist.trim() || null,
        image_paths: nextPaths,
        reported_at: opts?.markCompleted ? new Date().toISOString() : (result?.reported_at ?? null),
      };
      if (result?.id) {
        const { error } = await supabase.from("radiology_results").update(payload).eq("id", result.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("radiology_results").insert(payload);
        if (error) throw error;
      }
      if (opts?.markCompleted) {
        const { error } = await supabase.from("radiology_orders").update({ status: "completed" }).eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: (_d, vars) => {
      toast.success(vars?.markCompleted ? "Report finalized" : "Saved");
      qc.invalidateQueries({ queryKey: ["radiology-result", id] });
      qc.invalidateQueries({ queryKey: ["radiology-order", id] });
      qc.invalidateQueries({ queryKey: ["radiology-orders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${id}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safe}`;
        const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
        if (error) throw error;
        uploaded.push(path);
      }
      const nextPaths = [...paths, ...uploaded];
      // Persist without changing report status.
      const payload = {
        order_id: id,
        findings: findings.trim() || null,
        impression: impression.trim() || null,
        radiologist: radiologist.trim() || null,
        image_paths: nextPaths,
      };
      if (result?.id) {
        const { error } = await supabase.from("radiology_results").update(payload).eq("id", result.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("radiology_results").insert(payload);
        if (error) throw error;
      }
      toast.success(`${uploaded.length} image${uploaded.length > 1 ? "s" : ""} uploaded`);
      qc.invalidateQueries({ queryKey: ["radiology-result", id] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const removeImage = useMutation({
    mutationFn: async (path: string) => {
      const { error: sErr } = await supabase.storage.from(BUCKET).remove([path]);
      if (sErr) throw sErr;
      const nextPaths = paths.filter((p) => p !== path);
      if (result?.id) {
        const { error } = await supabase.from("radiology_results").update({ image_paths: nextPaths }).eq("id", result.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Image removed");
      qc.invalidateQueries({ queryKey: ["radiology-result", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !order) {
    return <div className="text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link to="/radiology" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to worklist
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">{order.lab_test_catalog?.name ?? "Radiology order"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ordered {format(new Date(order.ordered_at), "dd MMM yyyy, HH:mm")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill status={order.status} />
          {canUpdateStatus && (
            <Select value={order.status ?? "ordered"} onValueChange={(v) => updateStatus.mutate(v)}>
              <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ordered">Ordered</SelectItem>
                <SelectItem value="in_progress">In progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-[var(--shadow-card)]">
        <div className="grid gap-4 text-sm sm:grid-cols-2">
          <Field label="Patient">
            {order.patient_id ? (
              <Link to="/patients/$id" params={{ id: order.patient_id }} className="text-primary hover:underline">
                {order.patients?.patient_name ?? "—"}
              </Link>
            ) : (order.patients?.patient_name ?? "—")}
            <div className="text-xs text-muted-foreground">File #{order.patients?.file_number ?? "—"}</div>
          </Field>
          <Field label="Sex / Age">
            {(order.patients?.sex ?? "—")} · {order.patients?.estimated_age ?? "—"}
          </Field>
          <Field label="Priority">{order.priority ?? "routine"}</Field>
          <Field label="Category">{order.lab_test_catalog?.category ?? "—"}</Field>
          <div className="sm:col-span-2">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Clinical indication</div>
            <div className="mt-1 whitespace-pre-wrap">{order.clinical_indication || <span className="text-muted-foreground">Not provided</span>}</div>
          </div>
        </div>
      </div>

      <div className="space-y-4 rounded-xl border bg-card p-6 shadow-[var(--shadow-card)]">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Report</h2>
          {result?.reported_at && (
            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
              Finalized {format(new Date(result.reported_at), "dd MMM, HH:mm")}
            </Badge>
          )}
        </div>

        <div>
          <Label htmlFor="findings">Findings</Label>
          <Textarea id="findings" rows={5} value={findings} onChange={(e) => setFindings(e.target.value)} disabled={!canWrite} placeholder="Describe imaging observations…" />
        </div>
        <div>
          <Label htmlFor="impression">Impression</Label>
          <Textarea id="impression" rows={3} value={impression} onChange={(e) => setImpression(e.target.value)} disabled={!canWrite} placeholder="Radiologist's impression / diagnosis…" />
        </div>
        <div>
          <Label htmlFor="radiologist">Radiologist</Label>
          <Input id="radiologist" value={radiologist} onChange={(e) => setRadiologist(e.target.value)} disabled={!canWrite} />
        </div>

        {canWrite && (
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={() => saveResult.mutate(undefined)} disabled={saveResult.isPending}>
              {saveResult.isPending ? "Saving…" : "Save draft"}
            </Button>
            <Button
              onClick={() => {
                if (!findings.trim() && !impression.trim()) {
                  toast.error("Enter findings or impression before finalizing");
                  return;
                }
                saveResult.mutate({ markCompleted: true });
              }}
              disabled={saveResult.isPending}
            >
              Finalize & mark completed
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-4 rounded-xl border bg-card p-6 shadow-[var(--shadow-card)]">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold flex items-center gap-2"><ImageIcon className="h-4 w-4" /> Scan images ({paths.length})</h2>
          {canWrite && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,application/pdf,application/dicom"
                className="hidden"
                onChange={(e) => handleUpload(e.target.files)}
              />
              <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                <Upload className="mr-2 h-4 w-4" /> {uploading ? "Uploading…" : "Upload images"}
              </Button>
            </div>
          )}
        </div>

        {paths.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            No images uploaded yet.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {paths.map((p) => (
              <ImageTile key={p} path={p} onRemove={canWrite ? () => { if (confirm("Remove this image?")) removeImage.mutate(p); } : undefined} />
            ))}
          </div>
        )}
      </div>

      {order.encounter_id && (
        <div className="text-xs text-muted-foreground">
          Linked encounter: <span className="font-mono">{order.encounter_id.slice(0, 8)}</span>
        </div>
      )}

    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 font-medium">{children}</div>
    </div>
  );
}

function StatusPill({ status }: { status: string | null }) {
  const cls =
    status === "completed" ? "bg-emerald-100 text-emerald-700"
    : status === "in_progress" ? "bg-blue-100 text-blue-700"
    : "bg-amber-100 text-amber-700";
  return <Badge className={`${cls} hover:${cls}`}>{(status ?? "ordered").replace("_", " ")}</Badge>;
}

function ImageTile({ path, onRemove }: { path: string; onRemove?: () => void }) {
  const { data: url } = useQuery({
    queryKey: ["radiology-signed", path],
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
      if (error) throw error;
      return data.signedUrl;
    },
    staleTime: 55 * 60 * 1000,
  });
  const filename = path.split("/").pop() ?? path;
  const isImage = /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(filename);
  return (
    <div className="group relative overflow-hidden rounded-lg border bg-muted/30">
      {url && isImage ? (
        <a href={url} target="_blank" rel="noreferrer" className="block">
          <img src={url} alt={filename} className="h-40 w-full object-cover" />
        </a>
      ) : (
        <a href={url} target="_blank" rel="noreferrer" className="flex h-40 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
          <ExternalLink className="h-6 w-6" />
          <span className="truncate max-w-[80%] text-xs">{filename}</span>
        </a>
      )}
      <div className="flex items-center justify-between border-t bg-card px-2 py-1.5 text-xs">
        <span className="truncate" title={filename}>{filename}</span>
        {onRemove && (
          <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={onRemove}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
