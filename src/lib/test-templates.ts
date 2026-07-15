/**
 * LabTrack — Laboratory Records
 * Copyright (c) 2026 Francis Muhoro. All rights reserved.
 * Author: Francis Muhoro
 */

import { supabase } from "@/integrations/supabase/client";
import { TEST_PARAMETERS, type Parameter } from "@/lib/test-parameters";

export type TestTemplate = {
  id?: string;
  test_name: string;
  parameters: Parameter[];
};

/** Built-in defaults converted to template rows. */
export function getDefaultTemplates(): TestTemplate[] {
  return Object.entries(TEST_PARAMETERS).map(([test_name, parameters]) => ({
    test_name,
    parameters,
  }));
}

/** Fetch all templates, merging DB overrides on top of built-in defaults. */
export async function fetchMergedTemplates(): Promise<TestTemplate[]> {
  const { data, error } = await supabase
    .from("test_templates")
    .select("id, test_name, parameters");
  if (error) throw error;

  const byName = new Map<string, TestTemplate>();
  for (const t of getDefaultTemplates()) byName.set(t.test_name, t);
  for (const row of data ?? []) {
    byName.set(row.test_name, {
      id: row.id,
      test_name: row.test_name,
      parameters: (row.parameters as Parameter[]) ?? [],
    });
  }
  return Array.from(byName.values()).sort((a, b) =>
    a.test_name.localeCompare(b.test_name),
  );
}

export async function fetchTemplateFor(testName: string): Promise<Parameter[] | null> {
  if (!testName) return null;
  const { data, error } = await supabase
    .from("test_templates")
    .select("parameters")
    .eq("test_name", testName)
    .maybeSingle();
  if (error) throw error;
  if (data) return (data.parameters as Parameter[]) ?? [];
  return TEST_PARAMETERS[testName] ?? null;
}