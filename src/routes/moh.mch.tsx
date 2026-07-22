/**
 * LabTrack — MOH MCH Report (Maternal and Child Health)
 */

import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/moh/mch")({
  component: () => (
    <AppShell>
      <MohMCH />
    </AppShell>
  ),
});

function MohMCH() {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />
            MCH — Maternal & Child Health
          </h1>
          <p className="text-sm text-muted-foreground">
            Antenatal care, deliveries, and postnatal services (monthly).
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <Label htmlFor="month" className="text-xs">Reporting month</Label>
            <Input
              id="month"
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-48"
            />
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>MCH Services</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border bg-muted/50 p-8 text-center">
            <p className="text-muted-foreground">
              MCH report coming soon. Configure ANC, delivery, and PNC indicators.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
