/**
 * LabTrack — MOH 505 IDSR Report (Weekly Disease Surveillance)
 */

import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/moh/505")({
  component: () => (
    <AppShell>
      <Moh505 />
    </AppShell>
  ),
});

function Moh505() {
  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay());
    return d.toISOString().split("T")[0];
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />
            MOH 505 — IDSR Report
          </h1>
          <p className="text-sm text-muted-foreground">
            Integrated Disease Surveillance & Response (weekly).
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <Label htmlFor="week" className="text-xs">Week starting</Label>
            <Input
              id="week"
              type="date"
              value={weekStart}
              onChange={(e) => setWeekStart(e.target.value)}
              className="w-48"
            />
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Weekly Disease Surveillance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border bg-muted/50 p-8 text-center">
            <p className="text-muted-foreground">
              IDSR report coming soon. Configure disease thresholds and alerts.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
