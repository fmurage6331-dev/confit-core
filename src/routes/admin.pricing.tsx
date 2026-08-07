import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { db } from "@/lib/supabase-untyped";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ShieldHalf,
  FlaskConical,
  Pill,
  BedDouble,
  Save,
  Loader2,
  Tag,
  Stethoscope,
  Scan,
} from "lucide-react";

export const Route = createFileRoute("/admin/pricing")({
  component: AdminPricingPage,
});

// ─── Types ───────────────────────────────────────────────────────────────────

type Insurer = {
  id: string;
  name: string;
  insurer_type: string;
  is_active: boolean;
};

type ContractedEntry = {
  id?: string;
  contracted_price: number | null;
  notes: string;
};

type PriceMap = Record<string, ContractedEntry>; // keyed by item_id

type CatalogItem = {
  id: string;
  name: string;
  kind: string;
  cash_price: number | null;
  insurance_price: number | null;
  sha_tariff_code: string | null;
};

type StockItem = {
  id: string;
  name: string;
  category: string | null;
  unit: string;
  cash_price: number | null;
  insurance_price: number | null;
};

type Ward = {
  id: string;
  name: string;
  ward_type: string | null;
  daily_rate: number | null;
};

// ─── PriceRow Component ────────────────────────────────────────────────────────────────
function PriceRow({
  itemId,
  itemType,
  itemName,
  subtitle,
  defaultPrice,
  fallbackLabel,
  contractedEntry,
  insurerId,
  onSaved,
}: {
  itemId: string;
  itemType: string;
  itemName: string;
  subtitle?: string;
  defaultPrice: number | null;
  fallbackLabel: string;
  contractedEntry: ContractedEntry | undefined;
  insurerId: string;
  onSaved: (itemId: string, entry: ContractedEntry) => void;
}) {
  const { user } = useAuth();
  const savedPrice =
    contractedEntry?.contracted_price != null ? String(contractedEntry.contracted_price) : "";
  const savedNotes = contractedEntry?.notes ?? "";

  const [price, setPrice] = useState(savedPrice);
  const [notes, setNotes] = useState(savedNotes);
  const [saving, setSaving] = useState(false);

  const isDirty = price !== savedPrice || notes !== savedNotes;
  const hasContractedRate = contractedEntry?.contracted_price != null;

  async function handleSave() {
    const parsed = parseFloat(price);
    if (isNaN(parsed) || parsed < 0) {
      toast.error("Enter a valid price (0 or above)");
      return;
    }
    setSaving(true);
    const { error } = await db.from("contracted_prices").upsert(
      {
        insurance_provider_id: insurerId,
        item_type: itemType,
        item_id: itemId,
        contracted_price: parsed,
        notes: notes.trim() || null,
        created_by: user?.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "insurance_provider_id,item_type,item_id" },
    );
    setSaving(false);
    if (error) {
      toast.error("Failed to save: " + error.message);
      return;
    }
    toast.success(`${itemName} rate saved`);
    onSaved(itemId, {
      id: contractedEntry?.id,
      contracted_price: parsed,
      notes: notes.trim(),
    });
  }

  return (
    <div className="flex items-center gap-3 py-3 border-b last:border-0">
      {/* Item info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{itemName}</p>
        {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
        <p className="text-xs text-muted-foreground">
          {fallbackLabel}: KES {defaultPrice != null ? defaultPrice.toLocaleString() : "—"}
        </p>
      </div>

      {/* Price input */}
      <div className="relative shrink-0">
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
          KES
        </span>
        <Input
          className="pl-10 w-32 h-8 text-sm"
          placeholder="0.00"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
      </div>

      {/* Notes */}
      <Input
        className="w-40 h-8 text-sm shrink-0"
        placeholder="Notes (optional)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />

      {/* Save button */}
      <Button
        size="sm"
        variant={isDirty ? "default" : "outline"}
        disabled={!isDirty || saving}
        onClick={handleSave}
        className="h-8 w-8 p-0 shrink-0"
        title="Save rate"
      >
        {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
      </Button>

      {/* Status badge */}
      {hasContractedRate && !isDirty ? (
        <Badge variant="secondary" className="text-xs shrink-0 w-20 justify-center">
          Contracted
        </Badge>
      ) : (
        <Badge
          variant="outline"
          className="text-xs shrink-0 w-20 justify-center text-muted-foreground"
        >
          Fallback
        </Badge>
      )}
    </div>
  );
}

// ─── Section Component ────────────────────────────────────────────────────────

function PriceSection({
  title,
  description,
  icon: Icon,
  iconColor,
  items,
  itemType,
  getItemName,
  getSubtitle,
  getDefaultPrice,
  getFallbackLabel,
  priceMap,
  insurerId,
  onSaved,
  scrollHeight,
}: {
  title: string;
  description: string;
  icon: React.ElementType;
  iconColor: string;
  items: { id: string }[];
  itemType: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getItemName: (item: any) => string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getSubtitle?: (item: any) => string | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getDefaultPrice: (item: any) => number | null;
  getFallbackLabel: string;
  priceMap: PriceMap;
  insurerId: string;
  onSaved: (itemId: string, entry: ContractedEntry) => void;
  scrollHeight: string;
}) {
  const contractedCount = items.filter((i) => priceMap[i.id]?.contracted_price != null).length;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Icon className={`h-4 w-4 ${iconColor}`} />
          {title}
          <Badge variant="secondary">{items.length}</Badge>
          {contractedCount > 0 && (
            <Badge variant="default" className="text-xs">
              {contractedCount} contracted
            </Badge>
          )}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No items found</p>
        ) : (
          <>
            {/* Column headers */}
            <div className="flex items-center gap-3 pb-2 border-b mb-1">
              <p className="flex-1 text-xs font-medium text-muted-foreground">Item</p>
              <p className="w-32 text-xs font-medium text-muted-foreground shrink-0">
                Contracted Price
              </p>
              <p className="w-40 text-xs font-medium text-muted-foreground shrink-0">Notes</p>
              <div className="w-8 shrink-0" />
              <div className="w-20 shrink-0" />
            </div>
            <ScrollArea className={scrollHeight}>
              {items.map((item) => (
                <PriceRow
                  key={item.id}
                  itemId={item.id}
                  itemType={itemType}
                  itemName={getItemName(item)}
                  subtitle={getSubtitle?.(item)}
                  defaultPrice={getDefaultPrice(item)}
                  fallbackLabel={getFallbackLabel}
                  contractedEntry={priceMap[item.id]}
                  insurerId={insurerId}
                  onSaved={onSaved}
                />
              ))}
            </ScrollArea>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function AdminPricingPage() {
  const { isAdmin } = useAuth();

  const [insurers, setInsurers] = useState<Insurer[]>([]);
  const [selectedInsurerId, setSelectedInsurerId] = useState<string | null>(null);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [priceMap, setPriceMap] = useState<PriceMap>({});
  const [loading, setLoading] = useState(true);
  const [loadingPrices, setLoadingPrices] = useState(false);

  // Load static catalog data once
  useEffect(() => {
    async function loadCatalog() {
      setLoading(true);
      const [insRes, catRes, stockRes, wardRes] = await Promise.all([
        db
          .from("insurance_providers")
          .select("id, name, insurer_type, is_active")
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("lab_test_catalog")
          .select("id, name, kind, cash_price, insurance_price, sha_tariff_code")
          .eq("is_active", true)
          .order("kind")
          .order("name"),
        supabase
          .from("stock_items")
          .select("id, name, category, unit, cash_price, insurance_price")
          .order("name"),
        supabase
          .from("wards")
          .select("id, name, ward_type, daily_rate")
          .eq("is_active", true)
          .order("name"),
      ]);

      const insurerData = insRes.data as Insurer[] | null;
      if (insurerData && insurerData.length > 0) {
        setInsurers(insurerData);
        setSelectedInsurerId(insurerData[0].id);
      }
      if (catRes.data) setCatalogItems(catRes.data as CatalogItem[]);
      if (stockRes.data) setStockItems(stockRes.data as StockItem[]);
      if (wardRes.data) setWards(wardRes.data as Ward[]);
      setLoading(false);
    }
    loadCatalog();
  }, []);

  // Load contracted prices when insurer tab changes
  const loadPrices = useCallback(async (insurerId: string) => {
    setLoadingPrices(true);
    const { data, error } = await db
      .from("contracted_prices")
      .select("id, item_id, item_type, contracted_price, notes")
      .eq("insurance_provider_id", insurerId);

    if (error) {
      toast.error("Failed to load rates: " + error.message);
      setLoadingPrices(false);
      return;
    }

    type ContractedPriceRow = {
      id: string;
      item_id: string;
      contracted_price: number;
      notes: string | null;
    };
    const map: PriceMap = {};
    for (const row of (data ?? []) as ContractedPriceRow[]) {
      map[row.item_id] = {
        id: row.id,
        contracted_price: row.contracted_price,
        notes: row.notes ?? "",
      };
    }
    setPriceMap(map);
    setLoadingPrices(false);
  }, []);

  useEffect(() => {
    if (selectedInsurerId) loadPrices(selectedInsurerId);
  }, [selectedInsurerId, loadPrices]);

  function handleSaved(itemId: string, entry: ContractedEntry) {
    setPriceMap((prev) => ({ ...prev, [itemId]: entry }));
  }

  // ─── Guards ─────────────────────────────────────────────────────────────────

  if (!isAdmin) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Access restricted to administrators.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-3 text-muted-foreground">Loading catalog...</span>
      </div>
    );
  }

  // ─── Derived data ────────────────────────────────────────────────────────────

  const labItems = catalogItems.filter((i) => i.kind === "lab");
  const radItems = catalogItems.filter((i) => i.kind === "radiology");
  const svcItems = catalogItems.filter((i) => i.kind === "service");

  const totalContracted = Object.values(priceMap).filter((e) => e.contracted_price != null).length;

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Tag className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Contracted Pricing</h1>
          <p className="text-sm text-muted-foreground">
            Set per-insurer rates for lab tests, radiology, clinical services, pharmacy stock, and
            ward beds. Where no contracted rate is set the system falls back to the item&apos;s
            default insurance price.
          </p>
        </div>
      </div>

      {insurers.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            No active insurance providers found. Add insurers in <strong>Admin → Insurance</strong>{" "}
            first.
          </CardContent>
        </Card>
      ) : (
        <Tabs value={selectedInsurerId ?? ""} onValueChange={setSelectedInsurerId}>
          {/* Insurer tabs */}
          <TabsList className="mb-2 flex-wrap h-auto gap-1">
            {insurers.map((ins) => (
              <TabsTrigger key={ins.id} value={ins.id} className="flex items-center gap-1.5">
                <ShieldHalf className="h-3 w-3" />
                {ins.name}
                <Badge variant="outline" className="text-xs ml-1 capitalize">
                  {ins.insurer_type === "sha_shif" ? "SHA/SHIF" : ins.insurer_type}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>

          {insurers.map((ins) => (
            <TabsContent key={ins.id} value={ins.id} className="space-y-4">
              {/* Summary bar */}
              <div className="flex items-center justify-between py-1">
                {loadingPrices ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Loading contracted rates…
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">{totalContracted}</span>{" "}
                    contracted rate{totalContracted !== 1 ? "s" : ""} configured for{" "}
                    <span className="font-medium text-foreground">{ins.name}</span>
                  </p>
                )}
              </div>

              {loadingPrices ? (
                <div className="flex items-center justify-center h-40">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Lab Tests */}
                  <PriceSection
                    title="Lab Tests"
                    description="LOINC-coded laboratory investigations"
                    icon={FlaskConical}
                    iconColor="text-blue-500"
                    items={labItems}
                    itemType="lab_test"
                    getItemName={(i: CatalogItem) => i.name}
                    getSubtitle={(i: CatalogItem) =>
                      i.sha_tariff_code ? `SHA tariff: ${i.sha_tariff_code}` : undefined
                    }
                    getDefaultPrice={(i: CatalogItem) => i.insurance_price}
                    getFallbackLabel="Default insurance"
                    priceMap={priceMap}
                    insurerId={ins.id}
                    onSaved={handleSaved}
                    scrollHeight="h-64"
                  />

                  {/* Radiology */}
                  <PriceSection
                    title="Radiology"
                    description="Imaging and radiology procedures"
                    icon={Scan}
                    iconColor="text-purple-500"
                    items={radItems}
                    itemType="lab_test"
                    getItemName={(i: CatalogItem) => i.name}
                    getSubtitle={(i: CatalogItem) =>
                      i.sha_tariff_code ? `SHA tariff: ${i.sha_tariff_code}` : undefined
                    }
                    getDefaultPrice={(i: CatalogItem) => i.insurance_price}
                    getFallbackLabel="Default insurance"
                    priceMap={priceMap}
                    insurerId={ins.id}
                    onSaved={handleSaved}
                    scrollHeight="h-48"
                  />

                  {/* Clinical Services */}
                  <PriceSection
                    title="Clinical Services"
                    description="Consultations, procedures and other billable services"
                    icon={Stethoscope}
                    iconColor="text-green-500"
                    items={svcItems}
                    itemType="lab_test"
                    getItemName={(i: CatalogItem) => i.name}
                    getSubtitle={(i: CatalogItem) =>
                      i.sha_tariff_code ? `SHA tariff: ${i.sha_tariff_code}` : undefined
                    }
                    getDefaultPrice={(i: CatalogItem) => i.insurance_price}
                    getFallbackLabel="Default insurance"
                    priceMap={priceMap}
                    insurerId={ins.id}
                    onSaved={handleSaved}
                    scrollHeight="h-64"
                  />

                  {/* Pharmacy / Stock */}
                  <PriceSection
                    title="Pharmacy & Stock"
                    description="Drug and consumable dispensing rates per insurer"
                    icon={Pill}
                    iconColor="text-orange-500"
                    items={stockItems}
                    itemType="stock_item"
                    getItemName={(i: StockItem) => i.name}
                    getSubtitle={(i: StockItem) => (i.category ? i.category : undefined)}
                    getDefaultPrice={(i: StockItem) => i.insurance_price}
                    getFallbackLabel="Default insurance"
                    priceMap={priceMap}
                    insurerId={ins.id}
                    onSaved={handleSaved}
                    scrollHeight="h-72"
                  />

                  {/* Ward / Bed Rates */}
                  <PriceSection
                    title="Ward / Bed Rates"
                    description="Daily bed charge per ward. Overrides the ward default rate for this insurer."
                    icon={BedDouble}
                    iconColor="text-red-500"
                    items={wards}
                    itemType="ward"
                    getItemName={(i: Ward) => i.name}
                    getSubtitle={(i: Ward) => (i.ward_type ? `Type: ${i.ward_type}` : undefined)}
                    getDefaultPrice={(i: Ward) => i.daily_rate}
                    getFallbackLabel="Default daily rate"
                    priceMap={priceMap}
                    insurerId={ins.id}
                    onSaved={handleSaved}
                    scrollHeight="h-48"
                  />
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
