/**
 * LabTrack — MOH Reporting Dashboard
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/supabase-untyped";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Activity,
  BarChart3,
  CalendarDays,
  FlaskConical,
  HeartPulse,
  Package,
  Pill,
  RefreshCw,
  ShieldAlert,
  Stethoscope,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const Route = createFileRoute("/moh")({
  component: () => (
    <AppShell>
      <MohDashboard />
    </AppShell>
  ),
});

type AggRow = {
  indicator_code: string;
  value: number;
  period_month: string;
  computed_at: string | null;
};

type Category = "OPD" | "LAB" | "PHARM" | "LAB_COMMODITIES" | "FP" | "MCH" | "OTHER";

function firstOfMonth(d = new Date()) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}`;
}

const LAB_COMMODITY_CODES = [
  "LAB_HIV_KITS",
  "LAB_MALARIA_RDT",
  "LAB_SYPHILIS_RDT",
  "LAB_GLUCOSE_STRIPS",
  "LAB_URINE_STRIPS",
  "LAB_SLIDES",
  "LAB_BLOOD_TUBES",
];

function categoryOf(code: string): Category {
  const c = code.toUpperCase();

  if (c.startsWith("OPD_") || c.startsWith("A3_") || c.startsWith("DENTAL_")) {
    return "OPD";
  }

  if (LAB_COMMODITY_CODES.includes(c)) return "LAB_COMMODITIES";
  if (c.startsWith("LAB_")) return "LAB";
  if (c.startsWith("PHARM_")) return "PHARM";
  if (c.startsWith("FP_")) return "FP";
  if (c.startsWith("MCH_")) return "MCH";

  return "OTHER";
}

const CATEGORY_META: {
  key: Category;
  label: string;
  color: string;
  href: string;
}[] = [
  {
    key: "OPD",
    label: "MOH 705 — Outpatient",
    color: "hsl(var(--primary))",
    href: "/moh/705",
  },
  {
    key: "LAB",
    label: "MOH 706 — Laboratory",
    color: "hsl(220 70% 50%)",
    href: "/moh/706",
  },
  {
    key: "PHARM",
    label: "MOH 707 — Pharmacy",
    color: "hsl(160 60% 45%)",
    href: "/moh/707",
  },
  {
    key: "LAB_COMMODITIES",
    label: "MOH 642 — Lab Commodities",
    color: "hsl(35 90% 55%)",
    href: "/moh/642",
  },
  {
    key: "FP",
    label: "MOH FP — Family Planning",
    color: "hsl(340 70% 55%)",
    href: "/moh/fp",
  },
  {
    key: "MCH",
    label: "MOH MCH — Maternal & Child",
    color: "hsl(280 60% 55%)",
    href: "/moh/mch",
  },
];

const REPORT_CARDS = [
  {
    title: "MOH 705",
    subtitle: "Outpatient Report",
    description: "Monthly outpatient attendance by age and sex.",
    href: "/moh/705",
    icon: Stethoscope,
    period: "Monthly",
  },
  {
    title: "MOH 706",
    subtitle: "Laboratory Report",
    description: "Monthly laboratory investigations and tests.",
    href: "/moh/706",
    icon: FlaskConical,
    period: "Monthly",
  },
  {
    title: "MOH 707",
    subtitle: "Pharmacy Report",
    description: "Monthly pharmaceuticals dispensed summary.",
    href: "/moh/707",
    icon: Pill,
    period: "Monthly",
  },
  {
    title: "MOH 505",
    subtitle: "IDSR Weekly",
    description: "Integrated Disease Surveillance and Response.",
    href: "/moh/505",
    icon: ShieldAlert,
    period: "Weekly",
  },
  {
    title: "MOH 642",
    subtitle: "Lab Commodities",
    description: "Laboratory reagents and consumables usage.",
    href: "/moh/642",
    icon: Package,
    period: "Monthly",
  },
  {
    title: "MOH FP",
    subtitle: "Family Planning",
    description: "Family planning services and methods summary.",
    href: "/moh/fp",
    icon: Users,
    period: "Monthly",
  },
  {
    title: "MOH MCH",
    subtitle: "Maternal & Child Health",
    description: "ANC, delivery, PNC and maternal-child indicators.",
    href: "/moh/mch",
    icon: HeartPulse,
    period: "Monthly",
  },
  {
    title: "MOH 717",
    subtitle: "Monthly Summary",
    description: "Summary across monthly MOH aggregate indicators.",
    href: "/moh/717",
    icon: CalendarDays,
    period: "Monthly",
  },
];

function MohDashboard() {
  const [month, setMonth] = useState<string>(firstOfMonth());
  const [rows, setRows] = useState<AggRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  async function load(targetMonth: string) {
    setLoading(true);

    try {
      const period = `${targetMonth}-01`;

      const { data, error } = await db
        .from("moh_monthly_aggregates")
        .select("indicator_code, value, period_month, computed_at")
        .eq("period_month", period)
        .order("indicator_code", { ascending: true });

      if (error) throw new Error(error.message);

      setRows((data ?? []) as AggRow[]);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to load aggregates");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(month);
  }, [month]);

  async function onRefresh() {
    setRefreshing(true);
    const t = toast.loading("Calculating MOH monthly totals…");

    try {
      const targetMonth = `${month}-01`;

      const monthly = await db.rpc("refresh_moh_monthly_aggregates", {
        target_month: targetMonth,
      });

      if (monthly.error) throw new Error(monthly.error.message);

      const moh642 = await db.rpc("refresh_moh_642_monthly_aggregates", {
        target_month: targetMonth,
      });

      if (moh642.error) throw new Error(moh642.error.message);

      const moh707 = await db.rpc("refresh_moh_707_monthly_aggregates", {
        target_month: targetMonth,
      });

      if (moh707.error) throw new Error(moh707.error.message);

      await load(month);

      toast.success("MOH monthly aggregates refreshed", { id: t });
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Refresh failed", { id: t });
    } finally {
      setRefreshing(false);
    }
  }

  const grouped = useMemo(() => {
    const g: Record<Category, AggRow[]> = {
      OPD: [],
      LAB: [],
      PHARM: [],
      LAB_COMMODITIES: [],
      FP: [],
      MCH: [],
      OTHER: [],
    };

    for (const r of rows) {
      g[categoryOf(r.indicator_code)].push(r);
    }

    return g;
  }, [rows]);

  const chartData = useMemo(() => {
    return CATEGORY_META.map((c) => ({
      name: c.key,
      label: c.label,
      total: grouped[c.key].reduce((s, r) => s + Number(r.value || 0), 0),
      color: c.color,
    }));
  }, [grouped]);

  const grandTotal = useMemo(() => {
    return rows.reduce((sum, row) => sum + Number(row.value || 0), 0);
  }, [rows]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Activity className="h-6 w-6" />
            MOH Reporting Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Kenya MOH reporting tools, monthly summaries and IDSR weekly reporting.
          </p>
        </div>

        <div className="flex items-end gap-2 flex-wrap">
          <div>
            <Label htmlFor="month" className="text-xs">
              Reporting month
            </Label>
            <Input
              id="month"
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-48"
            />
          </div>

          <Button onClick={onRefresh} disabled={refreshing || loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Calculating…" : "Refresh Monthly Data"}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {REPORT_CARDS.map(({ title, subtitle, description, href, icon: Icon, period }) => (
          <Link key={href} to={href as "/moh"}>
            <Card className="h-full transition-colors hover:border-primary/50 hover:bg-muted/30">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-start justify-between gap-3 text-base">
                  <span>
                    <span className="block">{title}</span>
                    <span className="block text-sm font-normal text-muted-foreground">
                      {subtitle}
                    </span>
                  </span>
                  <span className="rounded-lg bg-primary/10 p-2 text-primary">
                    <Icon className="h-4 w-4" />
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{description}</p>
                <span className="mt-3 inline-flex rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {period}
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Total Monthly Count</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{grandTotal}</div>
            <p className="text-sm text-muted-foreground">
              Total across monthly MOH aggregate rows.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Indicator Rows</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{rows.length}</div>
            <p className="text-sm text-muted-foreground">
              Rows currently available for the selected month.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>IDSR</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              IDSR / MOH 505 is reported weekly and is opened separately.
            </p>
            <Button asChild variant="outline" size="sm" className="mt-3">
              <Link to="/moh/505">Open IDSR Weekly</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4" />
            Monthly category totals
          </CardTitle>
        </CardHeader>

        <CardContent className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {CATEGORY_META.map((c) => {
          const items = grouped[c.key];
          const total = items.reduce((s, r) => s + Number(r.value || 0), 0);

          return (
            <Card key={c.key}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between gap-3 text-base">
                  <Link to={c.href as "/moh"} className="hover:underline">
                    {c.label}
                  </Link>
                  <span className="text-sm font-normal text-muted-foreground">
                    Total: {total}
                  </span>
                </CardTitle>
              </CardHeader>

              <CardContent>
                {loading ? (
                  <p className="text-sm text-muted-foreground">Loading…</p>
                ) : items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No data for this month. Click “Refresh Monthly Data” to compute.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Indicator</TableHead>
                        <TableHead className="text-right">Value</TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {items.map((r) => (
                        <TableRow key={r.indicator_code}>
                          <TableCell className="font-mono text-xs">
                            {r.indicator_code}
                          </TableCell>
                          <TableCell className="text-right">{r.value}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {grouped.OTHER.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Other monthly indicators</CardTitle>
          </CardHeader>

          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Indicator</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {grouped.OTHER.map((r) => (
                  <TableRow key={r.indicator_code}>
                    <TableCell className="font-mono text-xs">
                      {r.indicator_code}
                    </TableCell>
                    <TableCell className="text-right">{r.value}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
