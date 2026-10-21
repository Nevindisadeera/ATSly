import type { AtsBand } from "@/types/report";

import type { CategoryKey, Confidence } from "./types";

/** Engine version — bump whenever checks, deductions or weights change. */
export const ENGINE_VERSION = "1.0.0";

/** Final category weights — docs/PLANNING.md §18.1. They sum to 100. */
export const CATEGORY_WEIGHTS: Record<CategoryKey, number> = {
  formatting: 25,
  structure: 20,
  keywords: 15,
  content: 15,
  completeness: 15,
  readability: 10,
};

export const CATEGORY_LABELS: Record<CategoryKey, string> = {
  formatting: "Formatting",
  structure: "Structure",
  keywords: "Keywords & skills",
  content: "Content quality",
  completeness: "Completeness",
  readability: "Readability",
};

/** Display order of categories in reports. */
export const CATEGORY_ORDER: CategoryKey[] = [
  "formatting",
  "structure",
  "completeness",
  "keywords",
  "content",
  "readability",
];

/** Uncertain detections deduct less — §18.2. */
export const CONFIDENCE_FACTOR: Record<Confidence, number> = {
  high: 1,
  medium: 0.75,
  low: 0.5,
};

/** Score bands — §18.3. */
export function bandFor(score: number): AtsBand {
  if (score >= 85) return "excellent";
  if (score >= 70) return "good";
  if (score >= 50) return "fair";
  return "needs_work";
}

export const BAND_DESCRIPTIONS: Record<AtsBand, string> = {
  excellent: "ATS-ready",
  good: "Minor improvements",
  fair: "Needs attention",
  needs_work: "At risk",
};
