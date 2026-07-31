/**
 * LabTrack — Laboratory Records
 * Copyright (c) 2026 Francis Muhoro. All rights reserved.
 * Author: Francis Muhoro
 */

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { UserPlus, KeyRound, Trash2, Users, Pencil } from "lucide-react";
import {
  listUsers,
  createUser,
  setUserRole,
  resetUserPassword,
  deleteUser,
  updateProfile,
} from "@/lib/admin-users.functions";
import { APP_ROLES, ROLE_LABELS, ROLE_DISPLAY_ORDER, type AssignableRole } from "@/lib/roles";

export const Route = createFileRoute("/admin/users")({
  component: AdminUsersPage,
});

type UserRow = {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  roles: string[];
  must_change_password: boolean;
  profile: {
    username: string;
    first_name: string;
    last_name: string;
  } | null;
};

function AdminUsersPage() {
  const { isAdmin, rolesLoading, user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (!rolesLoading && user && !isAdmin) navigate({ to: "/dashboard" });
  }, [isAdmin, rolesLoading, user, navigate]);

  const fetchUsers = useServerFn(listUsers);
  const createUserFn = useServerFn(createUser);
  const setRoleFn = useServerFn(setUserRole);
  const resetPwFn = useServerFn(resetUserPassword);
  const deleteUserFn = useServerFn(deleteUser);
  const updateProfileFn = useServerFn(updateProfile);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-users"],
    enabled: isAdmin,
    queryFn: () => fetchUsers(),
  });
  const users = (Array.isArray(data) ? data : []) as UserRow[];

  const [createOpen, setCreateOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<{ id: string; email: string } | null>(null);
  const [editTarget, setEditTarget] = useState<UserRow | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-users"] });

  const createM = useMutation({
    mutationFn: (v: {
      email: string;
      password: string;
      role: AssignableRole;
      first_name: string;
      last_name: string;
      username: string;
    }) => createUserFn({ data: v }),
    onSuccess: () => {
      toast.success("User created");
      setCreateOpen(false);
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const roleM = useMutation({
    mutationFn: (v: { userId: string; role: AssignableRole }) => setRoleFn({ data: v }),
    onSuccess: () => {
      toast.success("Role updated");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const resetM = useMutation({
    mutationFn: (v: { userId: string; password: string }) => resetPwFn({ data: v }),
    onSuccess: () => {
      toast.success("Password reset");
      setResetTarget(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const deleteM = useMutation({
    mutationFn: (userId: string) => deleteUserFn({ data: { userId } }),
    onSuccess: () => {
      toast.success("User deleted");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const editM = useMutation({
    mutationFn: (v: { userId: string; first_name: string; last_name: string; username: string }) =>
      updateProfileFn({ data: v }),
    onSuccess: () => {
      toast.success("Profile updated");
      setEditTarget(null);
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Users</h1>
              <p className="text-sm text-muted-foreground">Create accounts and grant access.</p>
            </div>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Create user
          </Button>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Username</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Last sign-in</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              )}
              {!isLoading && error && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-destructive">
                    {error instanceof Error ? error.message : "Failed to load users."}
                  </td>
                </tr>
              )}
              {!isLoading && !error && users.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-muted-foreground">
                    No users yet.
                  </td>
                </tr>
              )}
              {users.map((u) => {
                const found = ROLE_DISPLAY_ORDER.find((r) => u.roles.includes(r));
                const role: AssignableRole = found ?? "none";
                const isSelf = u.id === user?.id;
                const fullName = u.profile ? `${u.profile.first_name} ${u.profile.last_name}` : "—";
                return (
                  <tr key={u.id}>
                    <td className="px-4 py-3">
                      <div className="font-medium">
                        {fullName}
                        {isSelf && (
                          <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                        )}
                      </div>
                      {u.must_change_password && (
                        <Badge variant="outline" className="mt-0.5 text-xs text-amber-600">
                          Must change password
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {u.profile ? (
                        `@${u.profile.username}`
                      ) : (
                        <span className="text-rose-500">No profile</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                    <td className="px-4 py-3">
                      <Select
                        value={role}
                        onValueChange={(v) =>
                          roleM.mutate({ userId: u.id, role: v as AssignableRole })
                        }
                        disabled={isSelf}
                      >
                        <SelectTrigger className="w-48">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No access</SelectItem>
                          {APP_ROLES.map((r) => (
                            <SelectItem key={r} value={r}>
                              {ROLE_LABELS[r]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString() : "Never"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditTarget(u)}
                        title="Edit profile"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setResetTarget({ id: u.id, email: u.email })}
                        title="Reset password"
                      >
                        <KeyRound className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isSelf}
                        onClick={() => {
                          if (confirm(`Delete ${u.email}? This cannot be undone.`))
                            deleteM.mutate(u.id);
                        }}
                        title="Delete user"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <CreateUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={(v) => createM.mutate(v)}
        pending={createM.isPending}
      />
      <ResetPasswordDialog
        target={resetTarget}
        onClose={() => setResetTarget(null)}
        onSubmit={(pw) => resetTarget && resetM.mutate({ userId: resetTarget.id, password: pw })}
        pending={resetM.isPending}
      />
      <EditProfileDialog
        target={editTarget}
        onClose={() => setEditTarget(null)}
        onSubmit={(v) => editTarget && editM.mutate({ userId: editTarget.id, ...v })}
        pending={editM.isPending}
      />
    </AppShell>
  );
}

function CreateUserDialog({
  open,
  onOpenChange,
  onSubmit,
  pending,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSubmit: (v: {
    email: string;
    password: string;
    role: AssignableRole;
    first_name: string;
    last_name: string;
    username: string;
  }) => void;
  pending: boolean;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AssignableRole>("staff");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");

  useEffect(() => {
    if (!open) {
      setEmail("");
      setPassword("");
      setRole("staff");
      setFirstName("");
      setLastName("");
      setUsername("");
    }
  }, [open]);

  const canSubmit =
    email &&
    password.length >= 8 &&
    firstName.trim() &&
    lastName.trim() &&
    username.trim().length >= 3 &&
    /^[a-z0-9_]+$/.test(username);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create user</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>First name</Label>
              <Input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="John"
              />
            </div>
            <div>
              <Label>Last name</Label>
              <Input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Doe"
              />
            </div>
          </div>
          <div>
            <Label>Username</Label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              placeholder="john_doe"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Lowercase letters, numbers and underscores only. Must be unique.
            </p>
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label>Temporary password</Label>
            <Input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 8 characters"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              User will be required to change this on first sign-in.
            </p>
          </div>
          <div>
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as AssignableRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No access</SelectItem>
                {APP_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={pending || !canSubmit}
            onClick={() =>
              onSubmit({
                email,
                password,
                role,
                first_name: firstName,
                last_name: lastName,
                username,
              })
            }
          >
            {pending ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditProfileDialog({
  target,
  onClose,
  onSubmit,
  pending,
}: {
  target: UserRow | null;
  onClose: () => void;
  onSubmit: (v: { first_name: string; last_name: string; username: string }) => void;
  pending: boolean;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");

  useEffect(() => {
    if (target) {
      setFirstName(target.profile?.first_name ?? "");
      setLastName(target.profile?.last_name ?? "");
      setUsername(target.profile?.username ?? "");
    }
  }, [target]);

  const canSubmit =
    firstName.trim() &&
    lastName.trim() &&
    username.trim().length >= 3 &&
    /^[a-z0-9_]+$/.test(username);

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit profile — {target?.email}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>First name</Label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div>
              <Label>Last name</Label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Username</Label>
            <Input value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} />
            <p className="mt-1 text-xs text-muted-foreground">
              Lowercase letters, numbers and underscores only. Must be unique.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={pending || !canSubmit}
            onClick={() => onSubmit({ first_name: firstName, last_name: lastName, username })}
          >
            {pending ? "Saving…" : "Save profile"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({
  target,
  onClose,
  onSubmit,
  pending,
}: {
  target: { id: string; email: string } | null;
  onClose: () => void;
  onSubmit: (pw: string) => void;
  pending: boolean;
}) {
  const [pw, setPw] = useState("");
  useEffect(() => {
    if (!target) setPw("");
  }, [target]);
  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset password for {target?.email}</DialogTitle>
        </DialogHeader>
        <div>
          <Label>New temporary password</Label>
          <Input
            type="text"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="Min 8 characters"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={pending || pw.length < 8} onClick={() => onSubmit(pw)}>
            {pending ? "Saving…" : "Reset"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
