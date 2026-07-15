/**
 * LabTrack — Laboratory Records
 * Copyright (c) 2026 Francis Muhoro. All rights reserved.
 * Author: Francis Muhoro
 */

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Pencil, Trash2, Plus, DoorOpen, Users } from "lucide-react";
import { listUsers } from "@/lib/admin-users.functions";

export const Route = createFileRoute("/admin/rooms")({
  component: () => <AppShell><AdminRooms /></AppShell>,
});

type RoomKind = "general" | "lab" | "triage" | "consultation" | "pharmacy";
type Room = { id: string; name: string; code: string | null; is_active: boolean; kind: RoomKind };

const schema = z.object({
  name: z.string().trim().min(1).max(80),
  code: z.string().trim().max(20).optional(),
  kind: z.enum(["general","lab","triage","consultation","pharmacy"]),
  is_active: z.boolean(),
});

function AdminRooms() {
  const { user, isAdmin } = useAuth();
  const [rows, setRows] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Room | null>(null);
  const [open, setOpen] = useState(false);
  const [accessRoom, setAccessRoom] = useState<Room | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from("rooms")
      .select("id,name,code,is_active,kind").order("name");
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setRows((data ?? []) as Room[]);
  }
  useEffect(() => { load(); }, []);

  if (!isAdmin) return <div className="rounded-lg border p-6 text-sm text-muted-foreground">Admins only.</div>;

  function openNew() { setEditing({ id: "", name: "", code: "", is_active: true, kind: "general" }); setOpen(true); }
  function openEdit(r: Room) { setEditing(r); setOpen(true); }

  async function remove(id: string) {
    if (!confirm("Delete this room?")) return;
    const { error } = await supabase.from("rooms").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    setRows((r) => r.filter((x) => x.id !== id));
    toast.success("Deleted");
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;
    const parsed = schema.safeParse({ name: editing.name, code: editing.code ?? "", kind: editing.kind, is_active: editing.is_active });
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    const payload = { name: parsed.data.name, code: parsed.data.code || null, kind: parsed.data.kind, is_active: parsed.data.is_active };
    if (editing.id) {
      const { error } = await supabase.from("rooms").update(payload).eq("id", editing.id);
      if (error) { toast.error(error.message); return; }
    } else {
      const { error } = await supabase.from("rooms").insert({ ...payload, created_by: user!.id });
      if (error) { toast.error(error.message); return; }
    }
    toast.success("Saved");
    setOpen(false); setEditing(null); load();
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><DoorOpen className="h-7 w-7 text-primary" />Rooms</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage rooms and which users can access each one.</p>
        </div>
        <Button onClick={openNew}><Plus className="mr-1 h-4 w-4" /> Add room</Button>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Kind</th>
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No rooms yet.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-4 py-3 font-medium">{r.name}</td>
                <td className="px-4 py-3">
                  <Badge variant="secondary" className="capitalize">{r.kind}</Badge>
                </td>
                <td className="px-4 py-3">{r.code ? <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{r.code}</code> : <span className="text-muted-foreground">—</span>}</td>
                <td className="px-4 py-3">
                  {r.is_active
                    ? <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Active</Badge>
                    : <Badge variant="secondary">Inactive</Badge>}
                </td>
                <td className="px-4 py-3 text-right">
                  <Button variant="ghost" size="sm" onClick={() => setAccessRoom(r)}><Users className="mr-1 h-4 w-4" />Access</Button>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? "Edit room" : "Add room"}</DialogTitle></DialogHeader>
          {editing && (
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Room name</Label>
                <Input id="name" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} required />
              </div>
              <div>
                <Label htmlFor="code">Short code (optional)</Label>
                <Input id="code" value={editing.code ?? ""} onChange={(e) => setEditing({ ...editing, code: e.target.value.toUpperCase() })} />
              </div>
              <div>
                <Label>Kind</Label>
                <Select value={editing.kind} onValueChange={(v) => setEditing({ ...editing, kind: v as RoomKind })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="triage">Triage (vitals / anthropometrics)</SelectItem>
                    <SelectItem value="consultation">Consultation (diagnosis & prescription)</SelectItem>
                    <SelectItem value="lab">Laboratory (receives test requests)</SelectItem>
                    <SelectItem value="pharmacy">Pharmacy (dispense prescriptions)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-muted-foreground">Lab and Pharmacy rooms automatically receive requests routed from consultation.</p>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <div className="text-sm font-medium">Active</div>
                  <div className="text-xs text-muted-foreground">Only active rooms appear in registration.</div>
                </div>
                <Switch checked={editing.is_active} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} />
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit">Save</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {accessRoom && <AccessDialog room={accessRoom} onClose={() => setAccessRoom(null)} />}
    </div>
  );
}

function AccessDialog({ room, onClose }: { room: Room; onClose: () => void }) {
  const fetchUsers = useServerFn(listUsers);
  const { data: users } = useQuery({ queryKey: ["admin-users"], queryFn: () => fetchUsers() });
  const [granted, setGranted] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("user_room_access").select("user_id").eq("room_id", room.id);
      setGranted(new Set((data ?? []).map((r) => r.user_id)));
      setLoading(false);
    })();
  }, [room.id]);

  async function toggle(userId: string, on: boolean) {
    if (on) {
      const { error } = await supabase.from("user_room_access").insert({ user_id: userId, room_id: room.id });
      if (error) { toast.error(error.message); return; }
      setGranted((s) => new Set(s).add(userId));
    } else {
      const { error } = await supabase.from("user_room_access").delete().eq("user_id", userId).eq("room_id", room.id);
      if (error) { toast.error(error.message); return; }
      setGranted((s) => { const n = new Set(s); n.delete(userId); return n; });
    }
  }

  const list = (Array.isArray(users) ? users : []).filter((u) => !u.roles.includes("admin"));

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Access for {room.name}</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">Admins always have access. Tick users who may enter this room.</p>
        <div className="max-h-96 overflow-y-auto rounded-md border">
          {loading && <div className="p-4 text-sm text-muted-foreground">Loading…</div>}
          {!loading && list.length === 0 && <div className="p-4 text-sm text-muted-foreground">No non-admin users.</div>}
          {!loading && list.map((u) => (
            <label key={u.id} className="flex cursor-pointer items-center justify-between gap-3 border-b px-3 py-2 last:border-b-0 hover:bg-accent">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{u.email}</div>
                <div className="text-xs text-muted-foreground">{u.roles.join(", ") || "no role"}</div>
              </div>
              <Checkbox checked={granted.has(u.id)} onCheckedChange={(v) => toggle(u.id, !!v)} />
            </label>
          ))}
        </div>
        <DialogFooter><Button onClick={onClose}>Done</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}