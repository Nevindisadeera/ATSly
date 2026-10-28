import type { AtsReport, CheckResult } from "@/lib/ats/types";
import type { MatchReport } from "@/lib/matching/types";

import type { ContentAnalysis, MatchAssessment, Recommendation } from "./schemas";

/**
 * Recommendation merging and prioritization — docs/PLANNING.md §20. Deterministic templates
 * from the ATS issues and job match always exist, so recommendations never depend on AI;
 * verified AI recommendations and bullet rewrites are added on top.
 */

export type StoredRecommendation = Recommendation & {
  id: string;
  source: "rules" | "ai";
  /** The ATS check a rules recommendation comes from. */
  checkId?: string;
};

export const MAX_RECOMMENDATIONS = 12;
const MAX_FROM_ISSUES = 6;
const PRIORITY_RANK = { high: 0, medium: 1, low: 2 } as const;

function priorityFor(issue: CheckResult): Recommendation["priority"] {
  if (issue.severity === "critical" || issue.deduction >= 15) return "high";
  if (issue.deduction >= 6) return "medium";
  return "low";
}

function fromIssue(issue: CheckResult): Omit<StoredRecommendation, "id"> {
  return {
    source: "rules",
    checkId: issue.id,
    priority: priorityFor(issue),
    category: issue.category,
    title: issue.title,
    detail: `${issue.explanation} ${issue.fix ?? ""}`.trim().slice(0, 500),
    before: null,
    after: null,
    target: null,
  };
}

function fromMissingSkills(match: MatchReport): Omit<StoredRecommendation, "id"> | null {
  const missing = match.missing.filter(
    (m) => m.importance === "required" && m.kind !== "certification",
  );
  if (missing.length === 0) return null;
  const names = missing.slice(0, 5).map((m) => m.term);
  return {
    source: "rules",
    priority: missing.length >= 2 ? "high" : "medium",
    category: "job_match",
    title: "Show the required skills you have",
    detail: `The posting asks for ${names.join(", ")}. If you have experience with these, add them to Skills and mention them in the bullets where you used them.`,
    before: null,
    after: null,
    target: null,
  };
}

const normalizedKey = (text: string | null) =>
  text
    ? text
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .trim()
    : null;

export function mergeRecommendations(input: {
  ats: AtsReport;
  match?: MatchReport | null;
  /** Already verified (verifyContentAnalysis). */
  content?: ContentAnalysis | null;
  /** Already verified (verifyMatchAssessment). */
  assessment?: MatchAssessment | null;
}): StoredRecommendation[] {
  const candidates: Omit<StoredRecommendation, "id">[] = [];

  for (const issue of input.ats.issues.slice(0, MAX_FROM_ISSUES))
    candidates.push(fromIssue(issue));
  const skills = input.match ? fromMissingSkills(input.match) : null;
  if (skills) candidates.push(skills);

  for (const rec of input.content?.recommendations ?? [])
    candidates.push({ ...rec, source: "ai" });
  // Rewrites the model offered without a matching recommendation still deserve one.
  for (const finding of input.content?.bulletFindings ?? []) {
    if (!finding.rewrite) continue;
    candidates.push({
      source: "ai",
      priority: "medium",
      category: "content",
      title: "Strengthen this bullet",
      detail: finding.rationale,
      before: finding.original,
      after: finding.rewrite,
      target: finding.target,
    });
  }
  for (const rec of input.assessment?.tailoringRecommendations ?? []) {
    candidates.push({ ...rec, source: "ai" });
  }

  // One recommendation per quoted bullet and per title.
  const seen = new Set<string>();
  const unique = candidates.filter((rec) => {
    const keys = [normalizedKey(rec.before), `title:${normalizedKey(rec.title)}`].filter(
      (k): k is string => k !== null,
    );
    if (keys.some((k) => seen.has(k))) return false;
    keys.forEach((k) => seen.add(k));
    return true;
  });

  // Stable sort: priority first; within a priority, rules (they explain the score) then AI.
  return unique
    .map((rec, order) => ({ rec, order }))
    .sort(
      (a, b) =>
        PRIORITY_RANK[a.rec.priority] - PRIORITY_RANK[b.rec.priority] ||
        Number(a.rec.source === "ai") - Number(b.rec.source === "ai") ||
        a.order - b.order,
    )
    .slice(0, MAX_RECOMMENDATIONS)
    .map(({ rec }, index) => ({ ...rec, id: `${rec.source}-${index + 1}` }));
}
