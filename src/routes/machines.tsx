/**
 * LabTrack — Laboratory Records
 * Copyright (c) 2026 Francis Muhoro. All rights reserved.
 * Author: Francis Muhoro
 */

import { createFileRoute } from "@tanstack/react-router";
import { PermGuard } from "@/lib/require-access";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Wrench, Printer, FileText } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/machines")({
  component: () => (
    <AppShell>
      <PermGuard perm="machines">
        <MachinesPage />
      </PermGuard>
    </AppShell>
  ),
});

function MachinesPage() {
  const qc = useQueryClient();
  const [openMachine, setOpenMachine] = useState(false);
  const [openLog, setOpenLog] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const { data: machines } = useQuery({
    queryKey: ["machines"],
    queryFn: async () => {
      const { data, error } = await supabase.from("machines").select("*").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: logs } = useQuery({
    queryKey: ["machine_logs", selected],
    queryFn: async () => {
      let q = supabase
        .from("machine_logs")
        .select("*, machines(name)")
        .order("log_date", { ascending: false });
      if (selected) q = q.eq("machine_id", selected);
      const { data, error } = await q.limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const addMachine = useMutation({
    mutationFn: async (m: any) => {
      const { error } = await supabase.from("machines").insert(m);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Machine added");
      qc.invalidateQueries({ queryKey: ["machines"] });
      setOpenMachine(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addLog = useMutation({
    mutationFn: async (l: any) => {
      const { error } = await supabase.from("machine_logs").insert(l);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Log added");
      qc.invalidateQueries({ queryKey: ["machine_logs"] });
      setOpenLog(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 no-print">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Wrench className="h-7 w-7 text-primary" />
            Machines
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track equipment maintenance, service and calibration.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
          <Dialog open={openMachine} onOpenChange={setOpenMachine}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add machine
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add machine</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  addMachine.mutate({
                    name: f.get("name"),
                    model: f.get("model"),
                    serial_number: f.get("serial_number"),
                    location: f.get("location"),
                    status: f.get("status"),
                    notes: f.get("notes"),
                  });
                }}
                className="space-y-3"
              >
                <div>
                  <Label>Name *</Label>
                  <Input name="name" required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Model</Label>
                    <Input name="model" />
                  </div>
                  <div>
                    <Label>Serial #</Label>
                    <Input name="serial_number" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Location</Label>
                    <Input name="location" />
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Select name="status" defaultValue="active">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="maintenance">In maintenance</SelectItem>
                        <SelectItem value="out_of_service">Out of service</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Notes</Label>
                  <Textarea name="notes" />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={addMachine.isPending}>
                    Save
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="print-only hidden print:block mb-4">
        <h2 className="text-xl font-bold">LabTrack — Machines & Maintenance Report</h2>
        <p className="text-sm text-muted-foreground">
          Generated {format(new Date(), "dd MMM yyyy HH:mm")}
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {machines?.map((m) => (
          <Card
            key={m.id}
            className={`cursor-pointer transition ${selected === m.id ? "ring-2 ring-primary" : ""}`}
            onClick={() => setSelected(selected === m.id ? null : m.id)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <CardTitle className="text-base">{m.name}</CardTitle>
                <Badge variant={m.status === "active" ? "default" : "secondary"}>{m.status}</Badge>
              </div>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground space-y-0.5">
              {m.model && <div>Model: {m.model}</div>}
              {m.serial_number && <div>S/N: {m.serial_number}</div>}
              {m.location && <div>Location: {m.location}</div>}
              <Button
                size="sm"
                variant="outline"
                className="mt-3 no-print"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenLog(m.id);
                }}
              >
                <FileText className="mr-1 h-3 w-3" />
                Add log
              </Button>
            </CardContent>
          </Card>
        ))}
        {machines?.length === 0 && (
          <p className="text-sm text-muted-foreground col-span-full text-center py-12">
            No machines yet.
          </p>
        )}
      </div>

      <Dialog open={!!openLog} onOpenChange={(v) => !v && setOpenLog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New log entry</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              addLog.mutate({
                machine_id: openLog,
                log_type: f.get("log_type"),
                log_date: f.get("log_date"),
                performed_by: f.get("performed_by"),
                description: f.get("description"),
                cost: f.get("cost") ? Number(f.get("cost")) : null,
                next_due_date: f.get("next_due_date") || null,
              });
            }}
            className="space-y-3"
          >
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type *</Label>
                <Select name="log_type" defaultValue="maintenance">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                    <SelectItem value="service">Service</SelectItem>
                    <SelectItem value="calibration">Calibration</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Date *</Label>
                <Input
                  type="date"
                  name="log_date"
                  required
                  defaultValue={new Date().toISOString().slice(0, 10)}
                />
              </div>
            </div>
            <div>
              <Label>Performed by</Label>
              <Input name="performed_by" />
            </div>
            <div>
              <Label>Description *</Label>
              <Textarea name="description" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Cost</Label>
                <Input type="number" step="0.01" name="cost" />
              </div>
              <div>
                <Label>Next due</Label>
                <Input type="date" name="next_due_date" />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={addLog.isPending}>
                Save log
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-semibold">{selected ? "Machine logs" : "All recent logs"}</h2>
          {selected && (
            <Button
              size="sm"
              variant="ghost"
              className="no-print"
              onClick={() => setSelected(null)}
            >
              Show all
            </Button>
          )}
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Machine</th>
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2">By</th>
              <th className="px-4 py-2">Description</th>
              <th className="px-4 py-2">Cost</th>
              <th className="px-4 py-2">Next due</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {logs?.map((l: any) => (
              <tr key={l.id}>
                <td className="px-4 py-2">{format(new Date(l.log_date), "dd MMM yyyy")}</td>
                <td className="px-4 py-2">{l.machines?.name}</td>
                <td className="px-4 py-2">
                  <Badge variant="outline">{l.log_type}</Badge>
                </td>
                <td className="px-4 py-2">{l.performed_by}</td>
                <td className="px-4 py-2 max-w-xs truncate">{l.description}</td>
                <td className="px-4 py-2">{l.cost ? `$${l.cost}` : "—"}</td>
                <td className="px-4 py-2">
                  {l.next_due_date ? format(new Date(l.next_due_date), "dd MMM yyyy") : "—"}
                </td>
              </tr>
            ))}
            {logs?.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-muted-foreground">
                  No logs.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
