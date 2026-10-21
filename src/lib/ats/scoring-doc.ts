import type { AtsBand } from "@/types/report";

import { CHECKS } from "./checks";
import type { Check } from "./types";
import {
  BAND_DESCRIPTIONS,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  CATEGORY_WEIGHTS,
  CONFIDENCE_FACTOR,
  ENGINE_VERSION,
} from "./weights";

/** Renders docs/SCORING.md from the check registry, so the published method can't drift. */

const BAND_RANGES: [AtsBand, string][] = [
  ["excellent", "85–100"],
  ["good", "70–84"],
  ["fair", "50–69"],
  ["needs_work", "0–49"],
];

const BAND_NAMES: Record<AtsBand, string> = {
  excellent: "Excellent",
  good: "Good",
  fair: "Fair",
  needs_work: "Needs work",
};

/** Escapes characters that would break a Markdown table cell. */
const cell = (text: string) => text.replace(/\|/g, "\\|").replace(/\n/g, " ");

function checkTable(checks: Check[]): string[] {
  return [
    "| ID | Check | When it deducts | Max | Severity | Confidence | How to fix |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...checks.map(
      (c) =>
        `| ${c.id} | ${cell(c.title)} | ${cell(c.rule)} | ${c.maxDeduction} | ${c.severity} | ${c.confidence} | ${cell(c.fix)} |`,
    ),
  ];
}

export function renderScoringDoc(checks: readonly Check[] = CHECKS): string {
  const lines: string[] = [
    "# How ATSly scores resumes",
    "",
    "<!-- Generated from src/lib/ats/checks by `npm run docs:scoring`. Do not edit by hand. -->",
    "",
    `Engine version **${ENGINE_VERSION}** · ${checks.length} checks.`,
    "",
    "## The model",
    "",
    "- The overall ATS score is the weighted average of six category scores.",
    "- Each category starts at 100. Every check that finds a problem deducts points; a category never goes below 0.",
    "- A deduction is scaled by how sure the check is: " +
      `high confidence × ${CONFIDENCE_FACTOR.high}, medium × ${CONFIDENCE_FACTOR.medium}, low × ${CONFIDENCE_FACTOR.low}, rounded to whole points.`,
    "- Checks that can't be evaluated are reported as not applicable, with the reason, and deduct nothing.",
    "- Content and readability checks need at least 3 bullet points. Checks built on English word lists don't apply to resumes in other languages.",
    "- Critical and major problems are reported as failures; minor and informational ones as warnings. Both deduct.",
    "- The engine is deterministic: the same resume always gets the same score. AI can change the overall score by at most 3 points (check Q07).",
    "",
    "Overall = round(Σ category score × weight ÷ 100).",
    "",
    "## Categories",
    "",
    "| Category | Weight |",
    "| --- | --- |",
    ...CATEGORY_ORDER.map(
      (key) => `| ${CATEGORY_LABELS[key]} | ${CATEGORY_WEIGHTS[key]}% |`,
    ),
    "",
    "## Bands",
    "",
    "| Band | Score | Meaning |",
    "| --- | --- | --- |",
    ...BAND_RANGES.map(
      ([band, range]) =>
        `| ${BAND_NAMES[band]} | ${range} | ${BAND_DESCRIPTIONS[band]} |`,
    ),
    "",
    "## Checks",
  ];

  for (const key of CATEGORY_ORDER) {
    const inCategory = checks.filter((c) => c.category === key);
    lines.push(
      "",
      `### ${CATEGORY_LABELS[key]} (weight ${CATEGORY_WEIGHTS[key]})`,
      "",
      ...checkTable(inCategory),
    );
  }

  lines.push(
    "",
    "## Headline",
    "",
    "The one-line headline names the strongest category (when it scores 70 or more) and the weakest one. It's chosen by rule, without AI.",
    "",
  );
  return lines.join("\n");
}
