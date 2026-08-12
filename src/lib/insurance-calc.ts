/**
 * AegisCare — Insurance coverage calculation utility
 * Single source of truth for all coverage math across
 * register-patient, patients.$id, rooms.$id
 */

export type CoverageRule = "percentage" | "fixed_per_visit" | "percentage_with_cap";

export interface InsurerConfig {
  coverage_percentage: number;
  coverage_rule: CoverageRule;
  per_visit_limit?: number | null;
}

export interface CoverageResult {
  insuranceCovered: number;
  patientDue: number;
  limitReached: boolean;
}

/**
 * Calculate how much insurance covers for a given subtotal.
 * Never allows insurance to cover more than the subtotal.
 * Never returns negative patient_due.
 */
export function calcInsuranceCoverage(
  subtotal: number,
  mode: string,
  insurer: InsurerConfig | null,
): CoverageResult {
  if (mode === "free") {
    return { insuranceCovered: 0, patientDue: 0, limitReached: false };
  }
  if (mode !== "insurance" || !insurer) {
    return {
      insuranceCovered: 0,
      patientDue: +subtotal.toFixed(2),
      limitReached: false,
    };
  }

  const pct = Number(insurer.coverage_percentage ?? 0);
  const rule: CoverageRule = insurer.coverage_rule ?? "percentage";
  const limit = Number(insurer.per_visit_limit ?? 0);

  let raw = 0;
  let limitReached = false;

  if (rule === "percentage") {
    raw = +((subtotal * pct) / 100).toFixed(2);
  } else if (rule === "fixed_per_visit") {
    raw = Math.min(subtotal, limit);
    limitReached = subtotal > limit;
  } else if (rule === "percentage_with_cap") {
    const byPct = +((subtotal * pct) / 100).toFixed(2);
    raw = Math.min(byPct, limit);
    limitReached = byPct > limit;
  }

  // Safety: never cover more than the subtotal
  const insuranceCovered = +Math.min(raw, subtotal).toFixed(2);
  const patientDue = +Math.max(0, subtotal - insuranceCovered).toFixed(2);

  return { insuranceCovered, patientDue, limitReached };
}
