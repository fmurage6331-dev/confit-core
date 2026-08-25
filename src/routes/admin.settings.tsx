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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/settings")({ component: SettingsPage });

type FacilitySettings = {
  facility_name: string;
  facility_kmhfl_code: string;
  facility_sha_id: string;
  facility_sha_provider_no: string;
  facility_county: string;
  facility_address: string;
  facility_phone: string;
  facility_email: string;
  facility_level: string;
};

const EMPTY_FACILITY: FacilitySettings = {
  facility_name: "",
  facility_kmhfl_code: "",
  facility_sha_id: "",
  facility_sha_provider_no: "",
  facility_county: "",
  facility_address: "",
  facility_phone: "",
  facility_email: "",
  facility_level: "",
};

function mapKephLevel(level: string): string {
  const normalized = (level ?? "").trim();
  const label = /^Level\s/i.test(normalized) ? normalized : normalized ? `Level ${normalized}` : "";
  const map: Record<string, string> = {
    "Level 1": "1",
    "Level 2": "2",
    "Level 3": "3A",
    "Level 4": "4",
    "Level 5": "5",
    "Level 6": "6",
  };
  return map[label] ?? "";
}

function SettingsPage() {
  const { isAdmin, rolesLoading } = useAuth();
  const { appName, logoUrl, refresh } = useBranding();
  const navigate = useNavigate();

  // Branding state
  const [name, setName] = useState(appName);
  const [file, setFile] = useState<File | null>(null);
  const [savingBranding, setSavingBranding] = useState(false);

  // Facility state
  const [facility, setFacility] = useState<FacilitySettings>(EMPTY_FACILITY);
  const [savingFacility, setSavingFacility] = useState(false);
  const [loadingFacility, setLoadingFacility] = useState(true);
  const [syncingKmhfl, setSyncingKmhfl] = useState(false);

  useEffect(() => {
    setName(appName);
  }, [appName]);

  useEffect(() => {
    if (!rolesLoading && !isAdmin) navigate({ to: "/dashboard" });
  }, [isAdmin, rolesLoading, navigate]);

  // Load existing facility settings
  useEffect(() => {
    async function loadFacility() {
      setLoadingFacility(true);
      const { data, error } = await supabase
        .from("app_settings")
        .select(
          "facility_name,facility_kmhfl_code,facility_sha_id,facility_sha_provider_no,facility_county,facility_address,facility_phone,facility_email,facility_level",
        )
        .eq("id", "global")
        .maybeSingle();
      setLoadingFacility(false);
      if (error || !data) return;
      const d = data as unknown as Record<string, string | null>;
      setFacility({
        facility_name: d.facility_name ?? "",
        facility_kmhfl_code: d.facility_kmhfl_code ?? "",
        facility_sha_id: d.facility_sha_id ?? "",
        facility_sha_provider_no: d.facility_sha_provider_no ?? "",
        facility_county: d.facility_county ?? "",
        facility_address: d.facility_address ?? "",
        facility_phone: d.facility_phone ?? "",
        facility_email: d.facility_email ?? "",
        facility_level: d.facility_level ?? "",
      });
    }
    loadFacility();
  }, []);

  function setF(k: keyof FacilitySettings) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setFacility((prev) => ({ ...prev, [k]: e.target.value }));
  }

  async function syncFromKmhfl() {
    const code = facility.facility_kmhfl_code.trim();
    if (!code) {
      toast.error("Enter a KMHFL code before syncing");
      return;
    }
    setSyncingKmhfl(true);
    try {
      const res = await fetch(
        `https://kmhfr.health.go.ke/api/facilities/facilities/?code=${encodeURIComponent(code)}&format=json`,
      );
      if (!res.ok) throw new Error(`KMHFL request failed (${res.status})`);
      const data = (await res.json()) as {
        results?: Array<{
          name?: string;
          keph_level?: string | number;
          county?: { name?: string } | string;
        }>;
      };
      const found = data.results?.[0];
      if (!found) {
        throw new Error("Facility not found in KMHFL registry. Check the MFL code.");
      }
      const level = mapKephLevel(String(found.keph_level ?? ""));
      const county = typeof found.county === "string" ? found.county : (found.county?.name ?? "");
      setFacility((prev) => ({
        ...prev,
        facility_name: found.name ?? prev.facility_name,
        facility_level: level || prev.facility_level,
        facility_county: county || prev.facility_county,
      }));
      toast.success(
        `Synced from KMHFL: ${found.name ?? "Unknown facility"}, Level ${level || "—"}, ${county || "—"}`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to sync from KMHFL");
    } finally {
      setSyncingKmhfl(false);
    }
  }

  async function onSubmitBranding(e: FormEvent) {
    e.preventDefault();
    setSavingBranding(true);
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
        .update({ app_name: name.trim() || "Aegiscare", logo_url: newLogoUrl })
        .eq("id", "global");
      if (error) throw error;
      await refresh();
      toast.success("Branding updated");
      setFile(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSavingBranding(false);
    }
  }

  async function onSubmitFacility(e: FormEvent) {
    e.preventDefault();
    setSavingFacility(true);
    try {
      const { error } = await supabase
        .from("app_settings")
        .update({
          facility_name: facility.facility_name.trim() || null,
          facility_kmhfl_code: facility.facility_kmhfl_code.trim() || null,
          facility_sha_id: facility.facility_sha_id.trim() || null,
          facility_sha_provider_no: facility.facility_sha_provider_no.trim() || null,
          facility_county: facility.facility_county.trim() || null,
          facility_address: facility.facility_address.trim() || null,
          facility_phone: facility.facility_phone.trim() || null,
          facility_email: facility.facility_email.trim() || null,
          facility_level: facility.facility_level.trim() || null,
        } as never)
        .eq("id", "global");
      if (error) throw error;
      toast.success("Facility details saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSavingFacility(false);
    }
  }

  return (
    <AppShell>
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage application branding and facility details.
        </p>

        <Tabs defaultValue="branding" className="mt-6">
          <TabsList>
            <TabsTrigger value="branding">Branding</TabsTrigger>
            <TabsTrigger value="facility">Facility</TabsTrigger>
          </TabsList>

          {/* ── Branding tab ── */}
          <TabsContent value="branding" className="mt-4">
            <form onSubmit={onSubmitBranding} className="space-y-6 rounded-2xl border bg-card p-6">
              <p className="text-sm text-muted-foreground">
                Set the application name and logo shown across the app.
              </p>

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

              <Button type="submit" disabled={savingBranding}>
                {savingBranding ? "Saving…" : "Save branding"}
              </Button>
            </form>
          </TabsContent>

          {/* ── Facility tab ── */}
          <TabsContent value="facility" className="mt-4">
            <form onSubmit={onSubmitFacility} className="space-y-6 rounded-2xl border bg-card p-6">
              <p className="text-sm text-muted-foreground">
                Facility details are used in FHIR resources and SHA claims. Fill these in accurately
                — they identify your facility to the national health systems.
              </p>

              {loadingFacility ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : (
                <>
                  {/* Basic details */}
                  <div className="space-y-1">
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Basic details
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 pt-2">
                      <div className="sm:col-span-2">
                        <Label htmlFor="facility_name">Facility name</Label>
                        <Input
                          id="facility_name"
                          value={facility.facility_name}
                          onChange={setF("facility_name")}
                          placeholder="e.g. Aegiscare Medical Centre"
                        />
                      </div>
                      <div>
                        <Label htmlFor="facility_county">County</Label>
                        <Input
                          id="facility_county"
                          value={facility.facility_county}
                          onChange={setF("facility_county")}
                          placeholder="e.g. Nairobi"
                        />
                      </div>
                      <div>
                        <Label htmlFor="facility_phone">Phone</Label>
                        <Input
                          id="facility_phone"
                          value={facility.facility_phone}
                          onChange={setF("facility_phone")}
                          placeholder="e.g. +254 700 000 000"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <Label htmlFor="facility_address">Address</Label>
                        <Input
                          id="facility_address"
                          value={facility.facility_address}
                          onChange={setF("facility_address")}
                          placeholder="e.g. 123 Ngong Road, Nairobi"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <Label htmlFor="facility_email">Email</Label>
                        <Input
                          id="facility_email"
                          type="email"
                          value={facility.facility_email}
                          onChange={setF("facility_email")}
                          placeholder="e.g. info@facility.co.ke"
                        />
                      </div>
                    </div>
                  </div>

                  {/* National identifiers */}
                  <div className="space-y-1 border-t pt-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      National identifiers (DHA / SHA)
                    </div>
                    <p className="text-xs text-muted-foreground pt-1">
                      Required for SHA claims and FHIR submissions. Find your KMHFL code at{" "}
                      <span className="font-mono">hiskenya.org</span>.
                    </p>
                    <div className="grid gap-4 sm:grid-cols-2 pt-2">
                      <div>
                        <Label htmlFor="facility_kmhfl_code">KMHFL code</Label>
                        <div className="flex gap-2">
                          <Input
                            id="facility_kmhfl_code"
                            className="flex-1"
                            value={facility.facility_kmhfl_code}
                            onChange={setF("facility_kmhfl_code")}
                            placeholder="e.g. 13247"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-9 shrink-0"
                            onClick={() => void syncFromKmhfl()}
                            disabled={syncingKmhfl || loadingFacility}
                          >
                            <RefreshCw
                              className={`mr-1 h-3.5 w-3.5 ${syncingKmhfl ? "animate-spin" : ""}`}
                            />
                            Sync from KMHFL
                          </Button>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Fetch facility name, level and county from the public KMHFR registry.
                        </p>
                      </div>
                      <div>
                        <Label htmlFor="facility_sha_id">SHA facility ID</Label>
                        <Input
                          id="facility_sha_id"
                          value={facility.facility_sha_id}
                          onChange={setF("facility_sha_id")}
                          placeholder="e.g. SHA/F/00123"
                        />
                      </div>
                      <div>
                        <Label htmlFor="facility_sha_provider_no">SHA provider number</Label>
                        <Input
                          id="facility_sha_provider_no"
                          value={facility.facility_sha_provider_no}
                          onChange={setF("facility_sha_provider_no")}
                          placeholder="e.g. PRV/2026/00456"
                        />
                      </div>
                      <div>
                        <Label htmlFor="facility_level">Facility level</Label>
                        <select
                          id="facility_level"
                          value={facility.facility_level}
                          onChange={(e) =>
                            setFacility((prev) => ({ ...prev, facility_level: e.target.value }))
                          }
                          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                          <option value="">— Select level —</option>
                          <option value="1">Level 1 — Community Health Unit</option>
                          <option value="2">Level 2 — Dispensary / Clinic</option>
                          <option value="3A">Level 3A — Health Centre (Basic)</option>
                          <option value="3B">Level 3B — Health Centre (Advanced)</option>
                          <option value="4">Level 4 — Primary / Sub-County Hospital</option>
                          <option value="5">Level 5 — County / Secondary Hospital</option>
                          <option value="6">Level 6 — National / Teaching Hospital</option>
                        </select>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Used to filter applicable SHA benefit packages.
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}

              <Button type="submit" disabled={savingFacility || loadingFacility}>
                {savingFacility ? "Saving…" : "Save facility details"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
