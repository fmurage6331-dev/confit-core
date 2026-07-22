/**
 * LabTrack — Laboratory Records
 * Copyright (c) 2026 Francis Muhoro. All rights reserved.
 * Author: Francis Muhoro
 */

// Reference parameter templates for composite lab tests.
// Normal ranges are typical adult values — editable per record.

export type Parameter = {
  name: string;
  unit: string;
  low: number | null;
  high: number | null;
};

export const TEST_PARAMETERS: Record<string, Parameter[]> = {
  "Complete Blood Count (CBC)": [
    { name: "WBC", unit: "10^9/L", low: 4.0, high: 11.0 },
    { name: "RBC", unit: "10^12/L", low: 4.2, high: 5.9 },
    { name: "Hemoglobin", unit: "g/dL", low: 12.0, high: 17.5 },
    { name: "Hematocrit", unit: "%", low: 36, high: 50 },
    { name: "Platelets", unit: "10^9/L", low: 150, high: 450 },
    { name: "MCV", unit: "fL", low: 80, high: 100 },
    { name: "MCH", unit: "pg", low: 27, high: 33 },
    { name: "MCHC", unit: "g/dL", low: 32, high: 36 },
    { name: "Neutrophils", unit: "%", low: 40, high: 70 },
    { name: "Lymphocytes", unit: "%", low: 20, high: 40 },
    { name: "Monocytes", unit: "%", low: 2, high: 10 },
    { name: "Eosinophils", unit: "%", low: 1, high: 6 },
    { name: "Basophils", unit: "%", low: 0, high: 2 },
  ],
  "Liver Function Test (LFT)": [
    { name: "Total Bilirubin", unit: "mg/dL", low: 0.1, high: 1.2 },
    { name: "Direct Bilirubin", unit: "mg/dL", low: 0.0, high: 0.3 },
    { name: "AST (SGOT)", unit: "U/L", low: 10, high: 40 },
    { name: "ALT (SGPT)", unit: "U/L", low: 7, high: 56 },
    { name: "ALP", unit: "U/L", low: 44, high: 147 },
    { name: "Total Protein", unit: "g/dL", low: 6.0, high: 8.3 },
    { name: "Albumin", unit: "g/dL", low: 3.5, high: 5.0 },
    { name: "Globulin", unit: "g/dL", low: 2.0, high: 3.5 },
  ],
  "Kidney Function Test (KFT)": [
    { name: "Urea", unit: "mg/dL", low: 15, high: 40 },
    { name: "Creatinine", unit: "mg/dL", low: 0.6, high: 1.3 },
    { name: "Uric Acid", unit: "mg/dL", low: 3.5, high: 7.2 },
    { name: "Sodium", unit: "mmol/L", low: 135, high: 145 },
    { name: "Potassium", unit: "mmol/L", low: 3.5, high: 5.1 },
    { name: "Chloride", unit: "mmol/L", low: 98, high: 107 },
    { name: "Bicarbonate", unit: "mmol/L", low: 22, high: 29 },
  ],
  "Lipid Profile": [
    { name: "Total Cholesterol", unit: "mg/dL", low: 0, high: 200 },
    { name: "Triglycerides", unit: "mg/dL", low: 0, high: 150 },
    { name: "HDL", unit: "mg/dL", low: 40, high: 60 },
    { name: "LDL", unit: "mg/dL", low: 0, high: 100 },
    { name: "VLDL", unit: "mg/dL", low: 2, high: 30 },
  ],
  Urinalysis: [
    { name: "Color", unit: "", low: null, high: null },
    { name: "Appearance", unit: "", low: null, high: null },
    { name: "pH", unit: "", low: 4.5, high: 8.0 },
    { name: "Specific Gravity", unit: "", low: 1.005, high: 1.03 },
    { name: "Protein", unit: "", low: null, high: null },
    { name: "Glucose", unit: "", low: null, high: null },
    { name: "Ketones", unit: "", low: null, high: null },
    { name: "Blood", unit: "", low: null, high: null },
    { name: "Leukocytes", unit: "/hpf", low: 0, high: 5 },
    { name: "Erythrocytes", unit: "/hpf", low: 0, high: 3 },
  ],
  "Blood Glucose (RBS / FBS)": [
    { name: "Fasting Blood Sugar", unit: "mg/dL", low: 70, high: 100 },
    { name: "Random Blood Sugar", unit: "mg/dL", low: 70, high: 140 },
  ],
  "Erythrocyte Sedimentation Rate (ESR)": [{ name: "ESR", unit: "mm/hr", low: 0, high: 20 }],
};

export type ParameterResult = {
  name: string;
  value: string;
  unit: string;
  low: number | null;
  high: number | null;
};

export type StructuredResult = {
  version: 1;
  parameters: ParameterResult[];
  summary?: string;
};

export function getParametersFor(testName: string): Parameter[] | null {
  return TEST_PARAMETERS[testName] ?? null;
}

export function computeFlag(
  value: string,
  low: number | null,
  high: number | null,
): "Low" | "Normal" | "High" | "" {
  const n = parseFloat(value);
  if (!Number.isFinite(n)) return "";
  if (low !== null && n < low) return "Low";
  if (high !== null && n > high) return "High";
  if (low === null && high === null) return "";
  return "Normal";
}

export function tryParseStructured(raw: string | null | undefined): StructuredResult | null {
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw);
    if (obj && obj.version === 1 && Array.isArray(obj.parameters)) return obj as StructuredResult;
  } catch {
    /* not JSON */
  }
  return null;
}

export function formatStructuredForPrint(s: StructuredResult): string {
  const lines = s.parameters
    .filter((p) => p.value.trim() !== "")
    .map((p) => {
      const flag = computeFlag(p.value, p.low, p.high);
      const range = p.low !== null && p.high !== null ? `  (${p.low}–${p.high} ${p.unit})` : "";
      return `${p.name}: ${p.value} ${p.unit}${flag ? `  [${flag}]` : ""}${range}`;
    });
  if (s.summary?.trim()) lines.push("", s.summary.trim());
  return lines.join("\n");
}
