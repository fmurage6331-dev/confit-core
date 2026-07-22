/**
 * LabTrack — Laboratory Records
 * Copyright (c) 2026 Francis Muhoro. All rights reserved.
 * Author: Francis Muhoro
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { installServerFnAuth } from "@/lib/server-fn-auth";

if (typeof window !== "undefined") installServerFnAuth();

interface AuthCtx {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isApproved: boolean;
  isAdmin: boolean;
  isAccountant: boolean;
  isLabTech: boolean;
  isRecordsOfficer: boolean;
  isStaff: boolean;
  roles: string[];
  permissions: Set<string>;
  hasPerm: (p: string) => boolean;
  rolesLoading: boolean;
  refreshRoles: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [rolesLoading, setRolesLoading] = useState(false);

  async function loadRoles(userId: string | undefined) {
    if (!userId) {
      setRoles([]);
      setPermissions(new Set());
      return;
    }
    setRolesLoading(true);
    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const userRoles = (roleRows ?? []).map((r) => r.role as string);
    setRoles(userRoles);
    if (userRoles.length === 0) {
      setPermissions(new Set());
      setRolesLoading(false);
      return;
    }
    const { data: permRows } = await supabase
      .from("role_permissions")
      .select("permission")
      .in(
        "role",
        userRoles as (
          | "admin"
          | "staff"
          | "accountant"
          | "lab_tech"
          | "records_officer"
          | "doctor"
          | "clinical_officer"
          | "nurse"
          | "radiologist"
          | "pharmacist"
          | "mortician"
        )[],
      );
    setPermissions(new Set((permRows ?? []).map((r) => r.permission as string)));
    setRolesLoading(false);
  }

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setLoading(false);
      setTimeout(() => {
        loadRoles(s?.user?.id);
      }, 0);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
      loadRoles(data.session?.user?.id);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const isAdmin = roles.includes("admin");
  const isStaff = roles.includes("staff");
  const isAccountant = roles.includes("accountant");
  const isLabTech = roles.includes("lab_tech");
  const isRecordsOfficer = roles.includes("records_officer");
  const isApproved = roles.length > 0;

  const hasPerm = (p: string) => isAdmin || permissions.has(p);

  return (
    <AuthContext.Provider
      value={{
        user: session?.user ?? null,
        session,
        roles,
        permissions,
        hasPerm,
        isStaff,
        isAccountant,
        isLabTech,
        isRecordsOfficer,
        loading,
        isApproved,
        isAdmin,
        rolesLoading,
        refreshRoles: () => loadRoles(session?.user?.id),
        signOut: async () => {
          await supabase.auth.signOut();
          setRoles([]);
          setPermissions(new Set());
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
