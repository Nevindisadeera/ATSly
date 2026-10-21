import type { CategoryReport } from "./types";

/**
 * Deterministic one-line summary from the strongest and weakest categories — §18.6.
 * Ties go to the earlier category in report order. No AI involvement.
 */
export function buildHeadline(categories: CategoryReport[]): string {
  if (categories.length === 0) return "";
  let best = categories[0]!;
  let weakest = categories[0]!;
  for (const c of categories) {
    if (c.score > best.score) best = c;
    if (c.score < weakest.score) weakest = c;
  }

  if (weakest.score === 100) return "Strong across every category.";
  if (weakest.score >= 85)
    return `Strong across the board. ${weakest.label} has the most room to improve.`;

  const attention = `${weakest.label} needs the most attention.`;
  if (best === weakest) return attention;
  // Only praise a category that has earned it.
  if (best.score >= 85) return `Strong ${best.label.toLowerCase()}. ${attention}`;
  if (best.score >= 70) return `Solid ${best.label.toLowerCase()}. ${attention}`;
  return attention;
}
