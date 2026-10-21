import type { ParsedResume } from "@/lib/parsing/types";
import type { MatchBand } from "@/types/report";

import { educationFit, experienceFit, titleFit } from "./fit";
import { createMatcher, type Requirement } from "./match";
import type {
  JobRequirements,
  SemanticAssessment,
  MatchComponent,
  MatchComponentKey,
  MatchedTerm,
  MatchReport,
  MissingTerm,
} from "./types";

/** Matching engine version — bump whenever tiers, fits, weights or extraction change. */
export const MATCH_ENGINE_VERSION = "1.1.0";

/** Component weights — docs/PLANNING.md §19.2. They sum to 100. */
export const MATCH_WEIGHTS: Record<MatchComponentKey, number> = {
  required_skills: 40,
  preferred_skills: 10,
  responsibilities: 20,
  experience: 10,
  education: 10,
  title: 10,
};

export const MATCH_LABELS: Record<MatchComponentKey, string> = {
  required_skills: "Required skills & tools",
  preferred_skills: "Preferred skills",
  responsibilities: "Responsibility alignment",
  experience: "Experience",
  education: "Education & certifications",
  title: "Title & seniority",
};

const NOT_SPECIFIED = "Not specified in the job description.";
const NEEDS_AI = "Assessed by AI analysis, which wasn't available for this scan.";

/** Match bands — §19.2. */
export function matchBandFor(score: number): MatchBand {
  if (score >= 80) return "strong";
  if (score >= 60) return "moderate";
  if (score >= 40) return "partial";
  return "low";
}

/** The sentence the scan headline gains when a job description was given — §18.6. */
export function matchHeadline(band: MatchBand): string {
  return `Keyword coverage for this role is ${band}.`;
}

/** Templated and conditional, never "Add {term}" — §19.3 honesty rules. */
export function missingSuggestion(term: string, kind: MissingTerm["kind"]): string {
  return kind === "certification"
    ? `If you hold ${term}, list it in a Certifications section.`
    : `If you have experience with ${term}, add it to Skills and reference it in a relevant bullet.`;
}

const coverage = (matched: number, total: number) =>
  total === 0 ? null : Math.round((matched / total) * 100);

/**
 * Redistribution — §19.2. Components that couldn't be assessed get no weight; the rest are
 * scaled up proportionally so the effective weights still sum to 100.
 */
export function aggregate(
  scores: Record<MatchComponentKey, { score: number | null; note?: string }>,
): { score: number; components: MatchComponent[] } {
  const keys = Object.keys(MATCH_WEIGHTS) as MatchComponentKey[];
  const available = keys.filter((key) => scores[key].score !== null);
  const total = available.reduce((sum, key) => sum + MATCH_WEIGHTS[key], 0);

  const components = keys.map((key) => {
    const { score, note } = scores[key];
    const effectiveWeight =
      score === null || total === 0
        ? 0
        : Math.round((MATCH_WEIGHTS[key] / total) * 10_000) / 100;
    return {
      key,
      label: MATCH_LABELS[key],
      weight: MATCH_WEIGHTS[key],
      effectiveWeight,
      score,
      ...(note ? { note } : {}),
    };
  });

  const weighted = available.reduce(
    (sum, key) => sum + (scores[key].score as number) * MATCH_WEIGHTS[key],
    0,
  );
  return { score: total === 0 ? 0 : Math.round(weighted / total), components };
}

/** Responsibility alignment comes from AI only; without it, or without listed duties, it's na. */
function responsibilityScore(
  job: JobRequirements,
  assessment: SemanticAssessment | null | undefined,
): { score: number | null; note?: string } {
  if (job.responsibilities.length === 0) return { score: null, note: NOT_SPECIFIED };
  const alignment = assessment?.responsibilityAlignment;
  if (!alignment) return { score: null, note: NEEDS_AI };
  return { score: Math.min(100, Math.max(0, Math.round(alignment.score))) };
}

export type MatchInput = {
  resume: ParsedResume;
  job: JobRequirements;
  /** Verified AI assessment: adds the semantic tier and responsibility alignment. */
  assessment?: SemanticAssessment | null;
};

/**
 * Credit for a semantic match — §19.2: yes with high confidence counts fully; yes with
 * medium confidence, or partial, counts half; low confidence counts nothing.
 */
export function semanticCredit(item: SemanticAssessment["coverage"][number]): number {
  if (item.covered === "no" || item.confidence === "low" || !item.evidence) return 0;
  return item.covered === "yes" && item.confidence === "high" ? 1 : 0.5;
}

/**
 * Scores how well a resume matches a job's requirements — docs/PLANNING.md §19.
 * Deterministic tiers only; AI adds the semantic tier and responsibility alignment later.
 */
export function runMatchEngine({ resume, job, assessment }: MatchInput): MatchReport {
  const matcher = createMatcher(resume);
  const matched: MatchedTerm[] = [];
  const missing: MissingTerm[] = [];

  const requirements: Requirement[] = [
    ...job.hardSkills.map((s) => ({
      term: s.name,
      kind: s.kind,
      importance: s.importance,
    })),
    ...job.certifications.map((c) => ({
      term: c.name,
      kind: "certification" as const,
      importance: c.importance,
    })),
  ];
  const coverageByTerm = new Map(
    (assessment?.coverage ?? []).map((c) => [c.requirement.toLowerCase(), c]),
  );
  for (const requirement of requirements) {
    const hit = matcher.match(requirement);
    if (hit) {
      matched.push(hit);
      continue;
    }
    // A certification is held or not, so it only matches by name or alias.
    const semantic =
      requirement.kind === "certification"
        ? undefined
        : coverageByTerm.get(requirement.term.toLowerCase());
    const credit = semantic ? semanticCredit(semantic) : 0;
    if (semantic && credit > 0) {
      matched.push({
        term: requirement.term,
        kind: requirement.kind,
        importance: requirement.importance,
        matchType: "semantic",
        evidence: semantic.evidence ?? undefined,
        ...(credit < 1 ? { partial: true } : {}),
      });
    } else
      missing.push({
        term: requirement.term,
        kind: requirement.kind,
        importance: requirement.importance,
        suggestion: missingSuggestion(requirement.term, requirement.kind),
      });
  }
  // Soft skills are shown when found but never listed as missing: they're demonstrated, not listed.
  for (const name of job.softSkills) {
    const hit = matcher.match({ term: name, kind: "soft", importance: "preferred" });
    if (hit) matched.push(hit);
  }

  const isSkill = (t: { kind: string }) =>
    t.kind !== "certification" && t.kind !== "soft";
  const credit = (importance: "required" | "preferred") =>
    matched
      .filter((t) => t.importance === importance && isSkill(t))
      .reduce((sum, t) => sum + (t.partial ? 0.5 : 1), 0);
  const total = (importance: "required" | "preferred") =>
    [...matched, ...missing].filter((t) => t.importance === importance && isSkill(t))
      .length;
  const requiredMatched = credit("required");
  const requiredTotal = total("required");
  const preferredMatched = credit("preferred");
  const preferredTotal = total("preferred");

  const certifications = {
    matched: matched
      .filter((t) => t.kind === "certification" && t.importance === "required")
      .reduce((sum, t) => sum + (t.partial ? 0.5 : 1), 0),
    total: job.certifications.filter((c) => c.importance === "required").length,
  };

  const experience = experienceFit(resume, job);
  const education = educationFit(resume, job, certifications);
  const title = titleFit(resume, job);

  const requiredScore = coverage(requiredMatched, requiredTotal);
  const preferredScore = coverage(preferredMatched, preferredTotal);
  const { score, components } = aggregate({
    required_skills: {
      score: requiredScore,
      note: requiredScore === null ? NOT_SPECIFIED : undefined,
    },
    preferred_skills: {
      score: preferredScore,
      note: preferredScore === null ? NOT_SPECIFIED : undefined,
    },
    responsibilities: responsibilityScore(job, assessment),
    experience: {
      score: experience.score,
      note: experience.score === null ? NOT_SPECIFIED : undefined,
    },
    education: {
      score: education.score,
      note: education.score === null ? NOT_SPECIFIED : undefined,
    },
    title: { score: title.score, note: title.score === null ? NOT_SPECIFIED : undefined },
  });

  const honestyFlags = [
    ...new Set(
      [
        experience.flag,
        education.flag,
        ...missing
          .filter((t) => t.kind === "certification" && t.importance === "required")
          .map((t) => `The posting requires ${t.term}, which isn't on your resume.`),
        ...(assessment?.honestyFlags ?? []),
      ].filter((flag): flag is string => Boolean(flag)),
    ),
  ];
  if (components.every((c) => c.score === null)) {
    honestyFlags.unshift(
      "We couldn't find specific requirements in this job description, so the match score isn't meaningful.",
    );
  }

  return {
    score,
    band: matchBandFor(score),
    components,
    matched,
    // Required first, as the plan's missing list is ordered.
    missing: [...missing].sort(
      (a, b) =>
        Number(a.importance === "preferred") - Number(b.importance === "preferred"),
    ),
    strongMatches: (assessment?.responsibilityAlignment?.strong ?? []).map((s) => ({
      requirement: s.responsibility,
      evidence: s.evidence,
    })),
    weakMatches: (assessment?.responsibilityAlignment?.weak ?? []).map((w) => ({
      requirement: w.responsibility,
      reason: w.reason,
    })),
    fit: { experience: experience.row, education: education.row, title: title.row },
    honestyFlags: honestyFlags.slice(0, 5),
    version: MATCH_ENGINE_VERSION,
  };
}
