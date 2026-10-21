import type { CategoryKey, CategoryReport, CheckResult, Confidence } from "./types";
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  CATEGORY_WEIGHTS,
  CONFIDENCE_FACTOR,
} from "./weights";

/** Scoring model — docs/PLANNING.md §18.2. */

/** Points a finding removes: the raw deduction scaled by confidence, rounded. */
export function applyConfidence(rawDeduction: number, confidence: Confidence): number {
  return Math.round(rawDeduction * CONFIDENCE_FACTOR[confidence]);
}

/** A category starts at 100 and loses every deduction, never going below 0. */
export function categoryScore(checks: CheckResult[]): number {
  const deducted = checks.reduce((sum, c) => sum + c.deduction, 0);
  return Math.max(0, 100 - deducted);
}

export function buildCategories(results: CheckResult[]): CategoryReport[] {
  return CATEGORY_ORDER.map((key: CategoryKey) => {
    const checks = results.filter((r) => r.category === key);
    const score = categoryScore(checks);
    const weight = CATEGORY_WEIGHTS[key];
    return {
      key,
      label: CATEGORY_LABELS[key],
      weight,
      score,
      // Integer arithmetic first, so 87 × 25 / 100 is exactly 21.75.
      weightedPoints: (score * weight) / 100,
      checks,
    };
  });
}

/** Overall = round(Σ score × weight / 100). Summed as integers to avoid float drift. */
export function overallScore(categories: CategoryReport[]): number {
  const total = categories.reduce((sum, c) => sum + c.score * c.weight, 0);
  return Math.round(total / 100);
}
