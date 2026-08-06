/**
 * LabTrack — Shared service/test picker
 * A compact searchable dropdown used everywhere services or tests are requested,
 * replacing the long grids of buttons.
 */

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export type PickerService = {
  id: string;
  name: string;
  kind?: string | null;
  category?: string | null;
};

function groupLabel(raw: string) {
  const map: Record<string, string> = {
    lab: "Lab tests",
    service: "Services",
    procedure: "Procedures",
    consultation: "Consultation",
    radiology: "Radiology",
    imaging: "Imaging",
  };
  return map[raw] ?? raw.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

export function ServicePicker<T extends PickerService>({
  items,
  selectedIds,
  onToggle,
  priceFor,
  placeholder = "Search and add a service or test…",
  emptyLabel = "No services configured yet.",
}: {
  items: T[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  priceFor?: (item: T) => number;
  placeholder?: string;
  emptyLabel?: string;
}) {
  const [open, setOpen] = useState(false);

  const grouped = useMemo(() => {
    const g: Record<string, T[]> = {};
    items.forEach((s) => {
      const k = s.kind || s.category || "service";
      (g[k] ??= []).push(s);
    });
    return g;
  }, [items]);

  const picked = useMemo(() => items.filter((s) => selectedIds.has(s.id)), [items, selectedIds]);

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal"
          >
            <span className="truncate text-muted-foreground">
              {picked.length > 0 ? `${picked.length} selected — add more…` : placeholder}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder="Type to search…" />
            <CommandList className="max-h-72">
              <CommandEmpty>{items.length === 0 ? emptyLabel : "No match found."}</CommandEmpty>
              {Object.entries(grouped).map(([kind, list]) => (
                <CommandGroup key={kind} heading={groupLabel(kind)}>
                  {list.map((s) => {
                    const active = selectedIds.has(s.id);
                    return (
                      <CommandItem
                        key={s.id}
                        value={`${s.name} ${s.category ?? ""}`}
                        onSelect={() => onToggle(s.id)}
                      >
                        <Check className={`mr-2 h-4 w-4 ${active ? "opacity-100" : "opacity-0"}`} />
                        <span className="flex-1 truncate">{s.name}</span>
                        {priceFor && (
                          <span className="ml-2 text-xs tabular-nums text-muted-foreground">
                            KSh {priceFor(s).toFixed(2)}
                          </span>
                        )}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {picked.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {picked.map((s) => (
            <Badge key={s.id} variant="secondary" className="gap-1 py-1 pl-2 pr-1">
              <span>{s.name}</span>
              {priceFor && (
                <span className="tabular-nums text-muted-foreground">
                  KSh {priceFor(s).toFixed(2)}
                </span>
              )}
              <button
                type="button"
                aria-label={`Remove ${s.name}`}
                onClick={() => onToggle(s.id)}
                className="rounded-sm p-0.5 hover:bg-background"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
