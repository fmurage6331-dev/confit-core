/**
 * LabTrack — MOH 642 Laboratory Commodities Report
 */

import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/moh/642")({
  component: () => (
    <AppShell>
      <Moh642 />
    </AppShell>
  ),
});

function Moh642() {
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
            MOH 642 — Laboratory Commodities
          </h1>
          <p className="text-sm text-muted-foreground">
            Laboratory reagents and consumables consumption (monthly).
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
          <CardTitle>Lab Commodities Consumption</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border bg-muted/50 p-8 text-center">
            <p className="text-muted-foreground">
              Lab commodities report coming soon. Track reagent and consumable usage.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
