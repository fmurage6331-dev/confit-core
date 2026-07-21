/**
 * LabTrack — Laboratory Records
 * Copyright (c) 2026 Francis Muhoro. All rights reserved.
 * Author: Francis Muhoro
 */

import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Plus, Search } from "lucide-react";
import { computeFlag, type ParameterResult, type StructuredResult } from "@/lib/test-parameters";
import { cn } from "@/lib/utils";

type Props = {
  value: StructuredResult;
  onChange: (next: StructuredResult) => void;
};

export function ParameterTable({ value, onChange }: Props) {
  const [filter, setFilter] = useState("");

  const update = (idx: number, patch: Partial<ParameterResult>) => {
    const parameters = value.parameters.map((p, i) => (i === idx ? { ...p, ...patch } : p));
    onChange({ ...value, parameters });
  };

  const remove = (idx: number) => {
    onChange({ ...value, parameters: value.parameters.filter((_, i) => i !== idx) });
  };

  const addCustom = () => {
    onChange({
      ...value,
      parameters: [...value.parameters, { name: "", value: "", unit: "", low: null, high: null }],
    });
  };

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return value.parameters
      .map((p, i) => ({ p, i }))
      .filter(({ p }) => (!q ? true : p.name.toLowerCase().includes(q)));
  }, [filter, value.parameters]);

  const parseNum = (v: string): number | null => {
    if (v.trim() === "") return null;
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Filter parameters…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-8"
          />
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addCustom}>
          <Plus className="mr-1 h-4 w-4" /> Add custom parameter
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Parameter</th>
              <th className="px-3 py-2 text-left font-medium w-28">Result</th>
              <th className="px-3 py-2 text-left font-medium w-24">Unit</th>
              <th className="px-3 py-2 text-left font-medium w-20">Low</th>
              <th className="px-3 py-2 text-left font-medium w-20">High</th>
              <th className="px-3 py-2 text-left font-medium w-20">Flag</th>
              <th className="px-2 py-2 w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {visible.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                  No parameters match "{filter}".
                </td>
              </tr>
            )}
            {visible.map(({ p, i }) => {
              const flag = computeFlag(p.value, p.low, p.high);
              return (
                <tr key={i} className="align-top">
                  <td className="px-3 py-2">
                    <Input
                      value={p.name}
                      onChange={(e) => update(i, { name: e.target.value })}
                      placeholder="Parameter name"
                      className="h-8"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      inputMode="decimal"
                      value={p.value}
                      onChange={(e) => update(i, { value: e.target.value })}
                      className="h-8 font-mono"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      value={p.unit}
                      onChange={(e) => update(i, { unit: e.target.value })}
                      className="h-8"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      inputMode="decimal"
                      value={p.low ?? ""}
                      onChange={(e) => update(i, { low: parseNum(e.target.value) })}
                      className="h-8 font-mono"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      inputMode="decimal"
                      value={p.high ?? ""}
                      onChange={(e) => update(i, { high: parseNum(e.target.value) })}
                      className="h-8 font-mono"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={cn(
                        "inline-flex h-6 items-center rounded px-2 text-xs font-medium",
                        flag === "High" && "bg-destructive/15 text-destructive",
                        flag === "Low" && "bg-amber-500/15 text-amber-700 dark:text-amber-400",
                        flag === "Normal" &&
                          "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
                        flag === "" && "text-muted-foreground",
                      )}
                    >
                      {flag || "—"}
                    </span>
                  </td>
                  <td className="px-2 py-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => remove(i)}
                      aria-label="Remove parameter"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div>
        <Label htmlFor="param-summary">
          Interpretation / summary <span className="text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          id="param-summary"
          rows={2}
          value={value.summary ?? ""}
          onChange={(e) => onChange({ ...value, summary: e.target.value })}
          placeholder="Overall interpretation, clinical note…"
        />
      </div>
    </div>
  );
}
