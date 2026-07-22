/**
 * LabTrack — Laboratory Records
 * Copyright (c) 2026 Francis Muhoro. All rights reserved.
 * Author: Francis Muhoro
 */

import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import { ShieldAlert } from "lucide-react";

type AccessKey = "admin" | "staff" | "accountant" | "lab_tech" | "records_officer";

/** Legacy role-based check (kept for back-compat). Admin/staff always pass. */
export function useHasAccess(allowed: AccessKey[]): boolean {
  const { isAdmin, isStaff, isAccountant, isLabTech, isRecordsOfficer } = useAuth();
  if (isAdmin || isStaff) return true;
  return allowed.some((r) => {
    if (r === "accountant") return isAccountant;
    if (r === "lab_tech") return isLabTech;
    if (r === "records_officer") return isRecordsOfficer;
    if (r === "admin") return isAdmin;
    if (r === "staff") return isStaff;
    return false;
  });
}

/** Permission-based check. Admin always passes. */
export function useHasPerm(perm: string): boolean {
  const { hasPerm } = useAuth();
  return hasPerm(perm);
}

export function AccessDenied({ message }: { message?: string }) {
  return (
    <div className="mx-auto max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <ShieldAlert className="h-6 w-6" />
      </div>
      <h1 className="text-xl font-semibold">Access denied</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {message ??
          "You don't have permission to view this page. Contact an administrator if you need access."}
      </p>
    </div>
  );
}

export function Guard({ allow, children }: { allow: AccessKey[]; children: ReactNode }) {
  const ok = useHasAccess(allow);
  if (!ok) return <AccessDenied />;
  return <>{children}</>;
}

/** Permission-based guard. */
export function PermGuard({ perm, children }: { perm: string; children: ReactNode }) {
  const ok = useHasPerm(perm);
  if (!ok) return <AccessDenied />;
  return <>{children}</>;
}
