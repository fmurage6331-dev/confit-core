/**
 * LabTrack — Laboratory Records
 * Copyright (c) 2026 Francis Muhoro. All rights reserved.
 * Author: Francis Muhoro
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { APP_ROLES, type AssignableRole } from "@/lib/roles";

const roleEnum = z.enum([...APP_ROLES, "none"] as [AssignableRole, ...AssignableRole[]]);

// supabaseAdmin cast to untyped for tables not yet in generated types (e.g. profiles)
const adminDb = supabaseAdmin as unknown as {
  from: <T = unknown>(
    table: string,
  ) => {
    select: (cols: string) => {
      in: (col: string, vals: string[]) => Promise<{ data: T[] | null }>;
      eq: (
        col: string,
        val: unknown,
      ) => {
        maybeSingle: () => Promise<{ data: T | null }>;
        neq: (
          col: string,
          val: unknown,
        ) => {
          maybeSingle: () => Promise<{ data: T | null }>;
        };
      };
    };
    eq: (
      col: string,
      val: unknown,
    ) => {
      neq: (
        col: string,
        val: unknown,
      ) => {
        maybeSingle: () => Promise<{ data: T | null }>;
      };
      maybeSingle: () => Promise<{ data: T | null }>;
    };
    insert: (vals: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
    upsert: (vals: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
  };
};

async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Response("Forbidden", { status: 403 });
}

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data: usersResp, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
    if (error) throw new Error(error.message);
    const ids = usersResp.users.map((u) => u.id);

    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role")
      .in("user_id", ids);

    const { data: profiles } = await adminDb
      .from<{ id: string; username: string; first_name: string; last_name: string }>("profiles")
      .select("id,username,first_name,last_name")
      .in("id", ids);

    const roleMap = new Map<string, string[]>();
    (roles ?? []).forEach((r) => {
      const arr = roleMap.get(r.user_id) ?? [];
      arr.push(r.role as string);
      roleMap.set(r.user_id, arr);
    });

    const profileMap = new Map<
      string,
      { username: string; first_name: string; last_name: string }
    >();
    (profiles ?? []).forEach((p) => {
      profileMap.set(p.id, {
        username: p.username,
        first_name: p.first_name,
        last_name: p.last_name,
      });
    });

    return usersResp.users
      .map((u) => ({
        id: u.id,
        email: u.email ?? "",
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
        roles: roleMap.get(u.id) ?? [],
        must_change_password: (u.user_metadata?.must_change_password as boolean) ?? false,
        profile: profileMap.get(u.id) ?? null,
      }))
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  });

export const createUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      email: string;
      password: string;
      role: AssignableRole;
      first_name: string;
      last_name: string;
      username: string;
    }) =>
      z
        .object({
          email: z.string().trim().email().max(255),
          password: z.string().min(8).max(72),
          role: roleEnum,
          first_name: z.string().trim().min(1, "First name required").max(100),
          last_name: z.string().trim().min(1, "Last name required").max(100),
          username: z
            .string()
            .trim()
            .min(3, "Username must be at least 3 characters")
            .max(30)
            .regex(/^[a-z0-9_]+$/, "Username: lowercase letters, numbers and underscores only"),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);

    // Check username is not taken
    const { data: existing } = await adminDb
      .from<{ id: string }>("profiles")
      .select("id")
      .eq("username", data.username)
      .maybeSingle();
    if (existing) throw new Error(`Username "${data.username}" is already taken`);

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { must_change_password: true },
    });
    if (error) throw new Error(error.message);

    if (data.role !== "none" && created.user) {
      const { error: rErr } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: created.user.id, role: data.role } as never);
      if (rErr) throw new Error(rErr.message);
    }

    if (created.user) {
      const { error: pErr } = await adminDb.from("profiles").insert({
        id: created.user.id,
        username: data.username,
        first_name: data.first_name,
        last_name: data.last_name,
      });
      if (pErr) throw new Error(pErr.message);
    }

    return { id: created.user?.id };
  });

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { userId: string; first_name: string; last_name: string; username: string }) =>
      z
        .object({
          userId: z.string().uuid(),
          first_name: z.string().trim().min(1).max(100),
          last_name: z.string().trim().min(1).max(100),
          username: z
            .string()
            .trim()
            .min(3)
            .max(30)
            .regex(/^[a-z0-9_]+$/),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const isAdmin = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle()
      .then((r) => !!r.data);

    if (!isAdmin && data.userId !== context.userId) {
      throw new Response("Forbidden", { status: 403 });
    }

    // Check username uniqueness (excluding current user)
    const { data: existing } = await adminDb
      .from<{ id: string }>("profiles")
      .select("id")
      .eq("username", data.username)
      .neq("id", data.userId)
      .maybeSingle();
    if (existing) throw new Error(`Username "${data.username}" is already taken`);

    const { error } = await adminDb.from("profiles").upsert({
      id: data.userId,
      username: data.username,
      first_name: data.first_name,
      last_name: data.last_name,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; role: AssignableRole }) =>
    z.object({ userId: z.string().uuid(), role: roleEnum }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    if (data.role !== "none") {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: data.userId, role: data.role } as never);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const resetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; password: string }) =>
    z.object({ userId: z.string().uuid(), password: z.string().min(8).max(72) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.password,
      user_metadata: { must_change_password: true },
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    if (data.userId === context.userId) throw new Error("You cannot delete your own account.");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const clearMustChangePassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(context.userId, {
      user_metadata: { must_change_password: false },
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
