/**
 * LabTrack — Laboratory Records
 * Copyright (c) 2026 Francis Muhoro. All rights reserved.
 * Author: Francis Muhoro
 */

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useBranding } from "@/lib/branding-context";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/settings")({ component: SettingsPage });

function SettingsPage() {
  const { isAdmin, rolesLoading } = useAuth();
  const { appName, logoUrl, refresh } = useBranding();
  const navigate = useNavigate();
  const [name, setName] = useState(appName);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(appName);
  }, [appName]);
  useEffect(() => {
    if (!rolesLoading && !isAdmin) navigate({ to: "/dashboard" });
  }, [isAdmin, rolesLoading, navigate]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      let newLogoUrl = logoUrl;
      if (file) {
        const ext = file.name.split(".").pop() || "png";
        const path = `logo-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("branding")
          .upload(path, file, { upsert: true });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from("branding").getPublicUrl(path);
        newLogoUrl = pub.publicUrl;
      }
      const { error } = await supabase
        .from("app_settings")
        .upsert({ id: "global", app_name: name.trim() || "Aegiscare", logo_url: newLogoUrl });
      if (error) throw error;
      await refresh();
      toast.success("Branding updated");
      setFile(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold">Customization</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Set the application name and logo shown across the app.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-6 rounded-2xl border bg-card p-6">
          <div>
            <Label htmlFor="name">Application name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
            />
          </div>

          <div>
            <Label>Current logo</Label>
            <div className="mt-2 flex h-20 w-20 items-center justify-center rounded-lg border bg-muted overflow-hidden">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="h-full w-full object-contain" />
              ) : (
                <span className="text-xs text-muted-foreground">No logo</span>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="logo">Upload new logo (PNG/JPG/SVG)</Label>
            <Input
              id="logo"
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>

          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </form>
      </div>
    </AppShell>
  );
}
