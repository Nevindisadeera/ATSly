import type { DocFormat, LayoutProbe, ParsedResume } from "@/lib/parsing/types";
import type { AtsBand, Severity } from "@/types/report";

/**
 * ATS engine types — docs/PLANNING.md §17.5 and §18.
 * The engine is pure: the same input always produces the same report.
 */

export type Confidence = "high" | "medium" | "low";
export type CategoryKey =
  "formatting" | "structure" | "completeness" | "keywords" | "content" | "readability";

export type CheckStatus = "pass" | "fail" | "warn" | "na";

export type Evidence = {
  /** Exact text from the resume, when the check is about specific text. */
  excerpt?: string;
  /** Where it was found, e.g. "Experience › Acme Corp › bullet 2". */
  location?: string;
  /** A count, when the evidence is a measurement. */
  count?: number;
};

export type CheckResult = {
  id: string;
  category: CategoryKey;
  title: string;
  status: CheckStatus;
  severity: Severity;
  confidence: Confidence;
  /** Points removed from the category score (after the confidence factor). */
  deduction: number;
  /** Plain-language explanation of what was found. */
  explanation: string;
  /** What to do about it; present when the check did not pass. */
  fix?: string;
  evidence: Evidence[];
};

/** Everything a check may look at. */
export type CheckContext = {
  resume: ParsedResume;
  layout: LayoutProbe;
  format: DocFormat;
  /** Body text, one line per line, as stored with the resume. */
  text: string;
  /** All achievement bullets (experience and projects), with their location. */
  bullets: { text: string; location: string }[];
  /** AI content rating (0–100); absent until AI analysis runs (Phase 10a). */
  ai?: { contentQuality: number };
};

/**
 * A check's verdict before scoring. `rawDeduction` is reduced by the confidence factor.
 * A check that can't be evaluated returns `{ na: reason }` instead.
 */
export type Finding = {
  status: Exclude<CheckStatus, "na">;
  rawDeduction: number;
  confidence?: Confidence;
  severity?: Severity;
  explanation: string;
  evidence?: Evidence[];
};

export type Check = {
  id: string;
  category: CategoryKey;
  title: string;
  /** When the check deducts and by how much; published in docs/SCORING.md. */
  rule: string;
  /** The largest deduction this check can make, before confidence. */
  maxDeduction: number;
  severity: Severity;
  /** Typical confidence; findings may override it. */
  confidence: Confidence;
  /** How to fix a failure. */
  fix: string;
  /** Short positive statement shown as a strength when the check passes. */
  strength?: string;
  /** Why the check is not applicable, when run() returns { na }. */
  run(ctx: CheckContext): Finding | { na: string };
};

export type CategoryReport = {
  key: CategoryKey;
  label: string;
  /** Percentage weight in the overall score. */
  weight: number;
  score: number;
  /** score × weight / 100, unrounded to two decimals. */
  weightedPoints: number;
  checks: CheckResult[];
};

export type AtsReport = {
  score: number;
  band: AtsBand;
  headline: string;
  categories: CategoryReport[];
  strengths: string[];
  /** Failed and warned checks, largest deduction first. */
  issues: CheckResult[];
  engineVersion: string;
};
