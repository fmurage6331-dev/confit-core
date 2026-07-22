/**
 * LabTrack — Laboratory Records
 * Copyright (c) 2026 Francis Muhoro. All rights reserved.
 * Author: Francis Muhoro
 */

import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode, Fragment } from "react";
import { useAuth } from "@/lib/auth-context";
import { useBranding } from "@/lib/branding-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  FlaskConical,
  LayoutDashboard,
  ClipboardList,
  LogOut,
  ShieldCheck,
  Clock,
  Wrench,
  Truck,
  Package,
  BarChart3,
  Users,
  Settings,
  UserCog,
  UserPlus,
  Users2,
  ShieldHalf,
  Wallet,
  DoorOpen,
  LayoutGrid,
  Search,
  Stethoscope,
  Contact,
  FileText,
  ScanLine,
  BedDouble,
  FolderOpen,
  Activity,
  ChevronDown,
} from "lucide-react";

export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading, signOut, isApproved, isAdmin, hasPerm, rolesLoading } = useAuth();
  const { appName, logoUrl } = useBranding();
  const navigate = useNavigate();
  const { location } = useRouterState();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  // Force first-login password change
  useEffect(() => {
    if (
      user &&
      (user.user_metadata as { must_change_password?: boolean } | undefined)
        ?.must_change_password &&
      location.pathname !== "/change-password"
    ) {
      navigate({ to: "/change-password" });
    }
  }, [user, location.pathname, navigate]);

  // Load rooms this user can access (admins see all active rooms; others see their grants).
  const [accessibleRooms, setAccessibleRooms] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    if (!user) return;
    (async () => {
      if (isAdmin) {
        const { data } = await supabase
          .from("rooms")
          .select("id,name")
          .eq("is_active", true)
          .order("name");
        setAccessibleRooms((data ?? []) as { id: string; name: string }[]);
      } else {
        const { data } = await supabase
          .from("user_room_access")
          .select("rooms(id,name,is_active)")
          .eq("user_id", user.id);
        const rows = (
          (data ?? []) as unknown as {
            rooms: { id: string; name: string; is_active: boolean } | null;
          }[]
        )
          .map((r) => r.rooms)
          .filter((r): r is { id: string; name: string; is_active: boolean } => !!r && r.is_active);
        setAccessibleRooms(rows.map((r) => ({ id: r.id, name: r.name })));
      }
    })();
  }, [user, isAdmin]);

  if (loading || !user || rolesLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!isApproved) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-600">
            <Clock className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-semibold">No access yet</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your account is created but hasn't been granted access. Contact the lab administrator.
          </p>
          <Button variant="outline" className="mt-6" onClick={() => signOut()}>
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </div>
      </div>
    );
  }

  // Permission-based navigation. Admins always see everything (hasPerm returns true for admin).
  // Reports link only shows if user can view at least one report section.
  const canAnyReport =
    hasPerm("reports.registrations") ||
    hasPerm("reports.tests") ||
    hasPerm("reports.finance") ||
    hasPerm("reports.stock");

  // Primary sidebar: day-to-day workflow only.
  const primaryNav = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, show: true },
    {
      to: "/patients",
      label: "Patients",
      icon: Contact,
      show: hasPerm("register_patient") || hasPerm("records_view"),
    },
    {
      to: "/register-patient",
      label: "Registration",
      icon: UserPlus,
      show: hasPerm("register_patient"),
    },
    { to: "/queue", label: "Today's queue", icon: Users2, show: hasPerm("view_queue") },
    { to: "/accounting", label: "Accounting", icon: Wallet, show: hasPerm("accounting") },
    { to: "/invoices", label: "Invoices", icon: FileText, show: hasPerm("accounting") },

    { to: "/records", label: "Records", icon: ClipboardList, show: hasPerm("records_view") },
    {
      to: "/encounter-records",
      label: "Encounter records",
      icon: FolderOpen,
      show: hasPerm("records_view"),
    },
    {
      to: "/laboratory",
      label: "Laboratory",
      icon: FlaskConical,
      show: hasPerm("lab_view") || hasPerm("lab_results_create") || hasPerm("lab_update"),
    },
    {
      to: "/radiology",
      label: "Radiology",
      icon: ScanLine,
      show:
        hasPerm("radiology_view") ||
        hasPerm("radiology_results_create") ||
        hasPerm("radiology_update"),
    },
    {
      to: "/inpatient",
      label: "Inpatient",
      icon: BedDouble,
      show: hasPerm("admissions_view") || hasPerm("admit_patient") || hasPerm("bed_management"),
    },
    { to: "/reports", label: "Reports", icon: BarChart3, show: canAnyReport },
    { to: "/moh", label: "MOH reports", icon: Activity, show: canAnyReport || isAdmin },
  ].filter((i) => i.show);

  // Modules grid (opened via the app-launcher icon).
  const moduleItems = [
    { to: "/machines", label: "Machines", icon: Wrench, show: hasPerm("machines") },
    { to: "/deliveries", label: "Deliveries", icon: Truck, show: hasPerm("deliveries") },
    { to: "/stock", label: "Stock", icon: Package, show: hasPerm("stock") },
    ...(isAdmin
      ? [
          { to: "/admin/users", label: "Users", icon: Users, show: true },
          { to: "/admin/permissions", label: "Permissions", icon: ShieldCheck, show: true },
          { to: "/admin/requests", label: "Requests", icon: ShieldCheck, show: true },
          { to: "/admin/insurance", label: "Insurance", icon: ShieldHalf, show: true },
          { to: "/admin/services", label: "Services", icon: Stethoscope, show: true },
          { to: "/admin/rooms", label: "Rooms", icon: DoorOpen, show: true },
          { to: "/admin/test-templates", label: "Test templates", icon: FlaskConical, show: true },
          { to: "/admin/settings", label: "Settings", icon: Settings, show: true },
          { to: "/admin/moh-indicators", label: "MOH indicators", icon: Activity, show: true },
          { to: "/admin/audit-log", label: "Audit log", icon: ShieldCheck, show: true },
        ]
      : []),
  ].filter((i) => i.show);

  const roomNav = accessibleRooms.map((r) => ({
    to: `/rooms/${r.id}`,
    label: r.name,
    icon: DoorOpen,
  }));

  const nav = [...primaryNav, ...roomNav] as ReadonlyArray<{
    to: string;
    label: string;
    icon: typeof LayoutDashboard;
  }>;

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-60 border-r bg-sidebar md:flex md:flex-col no-print">
        <div className="flex items-center gap-2 px-4 py-5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground overflow-hidden">
            {logoUrl ? (
              <img src={logoUrl} alt="" className="h-full w-full object-contain" />
            ) : (
              <FlaskConical className="h-5 w-5" />
            )}
          </div>
          <span className="min-w-0 flex-1 truncate font-semibold">{appName}</span>
          {moduleItems.length > 0 && <ModulesLauncher items={moduleItems} />}
        </div>
        <nav className="flex-1 space-y-1 px-3 overflow-y-auto">
          {nav.map(({ to, label, icon: Icon }) => {
            // MOH reports gets a collapsible submenu
            if (to === "/moh") {
              const mohActive = location.pathname.startsWith("/moh");
              return (
                <Collapsible key={to} defaultOpen={mohActive}>
                  <CollapsibleTrigger
                    className={`flex items-center justify-between w-full rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      mohActive
                        ? "bg-primary text-primary-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-accent"
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <Icon className="h-4 w-4" />
                      {label}
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${mohActive ? "rotate-180" : ""}`}
                    />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pl-6 space-y-1 pt-1">
                    <Link
                      to="/moh"
                      className={`flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                        location.pathname === "/moh"
                          ? "bg-accent text-accent-foreground font-medium"
                          : "text-muted-foreground hover:bg-sidebar-accent"
                      }`}
                    >
                      Dashboard
                    </Link>
                    <Link
                      to="/moh/705"
                      className={`flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                        location.pathname === "/moh/705"
                          ? "bg-accent text-accent-foreground font-medium"
                          : "text-muted-foreground hover:bg-sidebar-accent"
                      }`}
                    >
                      MOH 705 — Outpatient
                    </Link>
                    <Link
                      to="/moh/706"
                      className={`flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                        location.pathname === "/moh/706"
                          ? "bg-accent text-accent-foreground font-medium"
                          : "text-muted-foreground hover:bg-sidebar-accent"
                      }`}
                    >
                      MOH 706 — Laboratory
                    </Link>
                    <Link
                      to="/moh/707"
                      className={`flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                        location.pathname === "/moh/707"
                          ? "bg-accent text-accent-foreground font-medium"
                          : "text-muted-foreground hover:bg-sidebar-accent"
                      }`}
                    >
                      MOH 707 — Pharmacy
                    </Link>
                    <Link
                      to="/moh/505"
                      className={`flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                        location.pathname === "/moh/505"
                          ? "bg-accent text-accent-foreground font-medium"
                          : "text-muted-foreground hover:bg-sidebar-accent"
                      }`}
                    >
                      IDSR (Weekly)
                    </Link>
                    <Link
                      to="/moh/642"
                      className={`flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                        location.pathname === "/moh/642"
                          ? "bg-accent text-accent-foreground font-medium"
                          : "text-muted-foreground hover:bg-sidebar-accent"
                      }`}
                    >
                      MOH 642 — Lab Commodities
                    </Link>
                    <Link
                      to="/moh/fp"
                      className={`flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                        location.pathname === "/moh/fp"
                          ? "bg-accent text-accent-foreground font-medium"
                          : "text-muted-foreground hover:bg-sidebar-accent"
                      }`}
                    >
                      MOH FP — Family Planning
                    </Link>
                    <Link
                      to="/moh/mch"
                      className={`flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                        location.pathname === "/moh/mch"
                          ? "bg-accent text-accent-foreground font-medium"
                          : "text-muted-foreground hover:bg-sidebar-accent"
                      }`}
                    >
                      MCH — Maternal & Child
                    </Link>
                    <Link
                      to="/moh/717"
                      className={`flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                        location.pathname === "/moh/717"
                          ? "bg-accent text-accent-foreground font-medium"
                          : "text-muted-foreground hover:bg-sidebar-accent"
                      }`}
                    >
                      MOH 717 — Monthly Summary
                    </Link>
                  </CollapsibleContent>
                </Collapsible>
              );
            }

            const active =
              location.pathname === to ||
              (to === "/records" &&
                location.pathname.startsWith("/records") &&
                location.pathname !== "/records/new") ||
              (to === "/machines" && location.pathname.startsWith("/machines"));
            return (
              <Link
                key={to}
                to={to as "/dashboard"}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t p-3">
          <div className="px-3 pb-2 text-xs text-muted-foreground truncate">
            {user.email}
            {isAdmin && (
              <span className="ml-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                admin
              </span>
            )}
          </div>
          <Link
            to="/account"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-sidebar-accent"
          >
            <UserCog className="h-4 w-4" /> Account
          </Link>
          <Button variant="ghost" className="w-full justify-start" onClick={() => signOut()}>
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </div>
      </aside>

      <div className="md:pl-60">
        <header className="flex items-center justify-between border-b px-6 py-3 md:hidden no-print">
          <div className="flex items-center gap-2 min-w-0">
            {logoUrl ? (
              <img src={logoUrl} alt="" className="h-5 w-5 object-contain" />
            ) : (
              <FlaskConical className="h-5 w-5 text-primary" />
            )}
            <span className="font-semibold truncate">{appName}</span>
          </div>
          <div className="flex items-center gap-1">
            {moduleItems.length > 0 && <ModulesLauncher items={moduleItems} />}
            <Button variant="ghost" size="sm" onClick={() => signOut()}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>
        <nav className="flex gap-1 overflow-x-auto border-b px-3 py-2 md:hidden no-print">
          {nav.map(({ to, label, icon: Icon }) => {
            // MOH submenu on mobile
            if (to === "/moh") {
              return (
                <Fragment key={to}>
                  <Link
                    to="/moh"
                    className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm hover:bg-accent ${location.pathname === "/moh" ? "bg-accent font-medium" : ""}`}
                  >
                    <Icon className="h-4 w-4" />
                    MOH
                  </Link>
                </Fragment>
              );
            }
            return (
              <Link
                key={to}
                to={to as "/dashboard"}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm hover:bg-accent ${location.pathname === to ? "bg-accent font-medium" : ""}`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>
        <main className="px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}

type ModuleItem = { to: string; label: string; icon: typeof LayoutDashboard };

function ModulesLauncher({ items }: { items: ModuleItem[] }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const filtered = items.filter((i) => i.label.toLowerCase().includes(q.toLowerCase()));
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          title="Modules"
          aria-label="Open modules"
        >
          <LayoutGrid className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Modules</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search for a module"
            className="pl-9"
          />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 max-h-[60vh] overflow-y-auto pr-1">
          {filtered.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to as "/dashboard"}
              onClick={() => setOpen(false)}
              className="flex flex-col items-center justify-center gap-2 rounded-lg border bg-card px-3 py-6 text-center text-sm font-medium hover:bg-accent hover:border-primary/40 transition-colors"
            >
              <Icon className="h-6 w-6 text-primary" />
              <span className="truncate w-full">{label}</span>
            </Link>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full py-10 text-center text-sm text-muted-foreground">
              No modules match.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
