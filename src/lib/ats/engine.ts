import type { DocFormat, LayoutProbe, ParsedResume } from "@/lib/parsing/types";

import { CHECKS } from "./checks";
import { buildHeadline } from "./headline";
import { applyConfidence, buildCategories, overallScore } from "./scoring";
import type { AtsReport, Check, CheckContext, CheckResult, Evidence } from "./types";
import { bandFor, ENGINE_VERSION } from "./weights";

export type AtsInput = {
  parsed: ParsedResume;
  layout: LayoutProbe;
  format: DocFormat;
  /** Body text as stored with the resume (one line per line). */
  text: string;
};

export type AtsOptions = {
  /** AI content rating, 0–100. Without it, check Q07 is not applicable. */
  ai?: { contentQuality: number };
  /** Checks to run; defaults to the full registry. For tests. */
  checks?: readonly Check[];
};

const MAX_STRENGTHS = 5;
const MAX_EXCERPT = 160;

function collectBullets(resume: ParsedResume): CheckContext["bullets"] {
  const experience = resume.experience.flatMap((entry, i) =>
    entry.bullets.map((text, b) => ({
      text,
      location: `Experience › ${entry.company ?? entry.title ?? `Role ${i + 1}`} › bullet ${b + 1}`,
    })),
  );
  const projects = resume.projects.flatMap((project, i) =>
    project.bullets.map((text, b) => ({
      text,
      location: `Projects › ${project.name ?? `Project ${i + 1}`} › bullet ${b + 1}`,
    })),
  );
  return [...experience, ...projects];
}

function trimExcerpt(evidence: Evidence): Evidence {
  const excerpt = evidence.excerpt?.trim();
  if (excerpt === undefined || excerpt.length <= MAX_EXCERPT) return evidence;
  const cut = excerpt.slice(0, MAX_EXCERPT);
  const space = cut.lastIndexOf(" ");
  return {
    ...evidence,
    excerpt: `${space > MAX_EXCERPT / 2 ? cut.slice(0, space) : cut}…`,
  };
}

function runCheck(check: Check, ctx: CheckContext): CheckResult {
  const base = { id: check.id, category: check.category, title: check.title };
  const outcome = check.run(ctx);

  if ("na" in outcome) {
    return {
      ...base,
      status: "na",
      severity: check.severity,
      confidence: check.confidence,
      deduction: 0,
      explanation: outcome.na,
      evidence: [],
    };
  }

  const severity = outcome.severity ?? check.severity;
  const confidence = outcome.confidence ?? check.confidence;
  const evidence = (outcome.evidence ?? []).map(trimExcerpt);

  if (outcome.status === "pass") {
    return {
      ...base,
      status: "pass",
      severity,
      confidence,
      deduction: 0,
      explanation: outcome.explanation,
      evidence,
    };
  }

  // Minor and informational problems are warnings; they still deduct.
  const status = severity === "critical" || severity === "major" ? "fail" : "warn";
  return {
    ...base,
    status,
    severity,
    confidence,
    deduction: applyConfidence(
      Math.min(outcome.rawDeduction, check.maxDeduction),
      confidence,
    ),
    explanation: outcome.explanation,
    fix: check.fix,
    evidence,
  };
}

/**
 * Scores a parsed resume against every ATS check — docs/PLANNING.md §18.
 * Pure and deterministic: the same input and options always produce the same report.
 */
export function runAtsEngine(input: AtsInput, options: AtsOptions = {}): AtsReport {
  const checks = options.checks ?? CHECKS;
  const ctx: CheckContext = {
    resume: input.parsed,
    layout: input.layout,
    format: input.format,
    text: input.text,
    bullets: collectBullets(input.parsed),
    ai: options.ai,
  };

  const results = checks.map((check) => runCheck(check, ctx));
  const categories = buildCategories(results);
  const score = overallScore(categories);

  const byId = new Map(checks.map((c) => [c.id, c]));
  const strengths = results
    .filter((r) => r.status === "pass" && byId.get(r.id)?.strength)
    .sort((a, b) => byId.get(b.id)!.maxDeduction - byId.get(a.id)!.maxDeduction)
    .slice(0, MAX_STRENGTHS)
    .map((r) => byId.get(r.id)!.strength!);

  const issues = results
    .filter((r) => r.status === "fail" || r.status === "warn")
    .sort((a, b) => b.deduction - a.deduction);

  return {
    score,
    band: bandFor(score),
    headline: buildHeadline(categories),
    categories,
    strengths,
    issues,
    engineVersion: ENGINE_VERSION,
  };
}
