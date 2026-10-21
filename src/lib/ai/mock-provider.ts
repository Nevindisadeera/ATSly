import {
  isPassive,
  isQuantified,
  startsWithActionVerb,
  weakPhrasesIn,
  wordsOf,
} from "@/lib/ats/text-metrics";
import { extractJobRequirements } from "@/lib/matching";
import { ENGLISH_STOPWORDS } from "@/lib/taxonomy";

import type { CompactResume } from "./inputs";
import {
  AiError,
  type AiProvider,
  type AiRequest,
  type AiResult,
  type AiTaskName,
} from "./provider";
import type {
  AiJobRequirements,
  ContentAnalysis,
  MatchAssessment,
  Recommendation,
} from "./schemas";

/**
 * Deterministic, offline provider — docs/PLANNING.md §20. Used without an API key and in
 * tests. Its answers are derived from the input by simple rules, quote the resume verbatim
 * and follow the same schemas, so the whole AI path can be exercised and demonstrated.
 */

type Bullet = {
  text: string;
  section: "experience" | "projects";
  entryIndex: number;
  bulletIndex: number;
};

function bulletsOf(resume: CompactResume): Bullet[] {
  return [
    ...resume.experience.flatMap((e) =>
      e.bullets.map((b) => ({
        text: b.text,
        section: "experience" as const,
        entryIndex: e.entryIndex,
        bulletIndex: b.bulletIndex,
      })),
    ),
    ...resume.projects.flatMap((p) =>
      p.bullets.map((b) => ({
        text: b.text,
        section: "projects" as const,
        entryIndex: p.entryIndex,
        bulletIndex: b.bulletIndex,
      })),
    ),
  ];
}

function bulletScore(text: string): number {
  const words = wordsOf(text).length;
  return (
    (startsWithActionVerb(text) ? 40 : 0) +
    (isQuantified(text) ? 40 : 0) +
    (words >= 8 && words <= 30 ? 20 : 0)
  );
}

const average = (values: number[]) =>
  values.length === 0
    ? null
    : Math.round(values.reduce((a, b) => a + b, 0) / values.length);

/** Keeps every fact; leads with an action and leaves a placeholder for the missing result. */
export function mockRewrite(text: string): string {
  let rest = text.trim().replace(/\.$/, "");
  for (const phrase of weakPhrasesIn(rest)) {
    rest = rest.replace(new RegExp(`^${phrase}\\s+`, "i"), "");
  }
  const lead = startsWithActionVerb(rest) ? "" : "Delivered ";
  const body = lead ? rest.charAt(0).toLowerCase() + rest.slice(1) : rest;
  const result = isQuantified(text) ? "" : ", improving [metric] by [X %]";
  return `${lead}${body}${result}.`;
}

function analyzeContent(data: { resume: CompactResume }): ContentAnalysis {
  const { resume } = data;
  const bullets = bulletsOf(resume);
  const scored = bullets.map((b) => ({ ...b, score: bulletScore(b.text) }));
  const experience = average(
    scored.filter((b) => b.section === "experience").map((b) => b.score),
  );
  const projects = average(
    scored.filter((b) => b.section === "projects").map((b) => b.score),
  );

  const weakest = scored
    .filter((b) => b.score < 80)
    .sort(
      (a, b) =>
        a.score - b.score || a.entryIndex - b.entryIndex || a.bulletIndex - b.bulletIndex,
    )
    .slice(0, 3);
  const bulletFindings = weakest.map((b) => {
    const issues: ContentAnalysis["bulletFindings"][number]["issues"] = [];
    if (!isQuantified(b.text)) issues.push("no_metrics");
    if (!startsWithActionVerb(b.text)) issues.push("no_impact");
    if (weakPhrasesIn(b.text).length > 0) issues.push("vague");
    if (isPassive(b.text)) issues.push("passive");
    if (wordsOf(b.text).length > 30) issues.push("too_long");
    return {
      original: b.text,
      target: {
        section: b.section,
        entryIndex: b.entryIndex,
        bulletIndex: b.bulletIndex,
      },
      issues: issues.length > 0 ? issues : ["vague" as const],
      rewrite: mockRewrite(b.text),
      rationale:
        "Leads with the task rather than the result; a measurable outcome would show impact.",
    };
  });

  const recommendations: Recommendation[] = bulletFindings.map((f) => ({
    priority: "medium",
    category: "content",
    title: "Show the result of this work",
    detail:
      "Start with a strong verb and add the outcome, with a number where you have one.",
    before: f.original,
    after: f.rewrite,
    target: f.target,
  }));
  if (!resume.summary) {
    recommendations.push({
      priority: "low",
      category: "completeness",
      title: "Add a short summary",
      detail:
        "Two or three sentences on your focus and strengths help recruiters place you quickly.",
      before: null,
      after: null,
      target: { section: "summary", entryIndex: null, bulletIndex: null },
    });
  }

  const overall = average(scored.map((b) => b.score)) ?? 50;
  return {
    overallQuality: Math.min(100, Math.max(0, overall)),
    sectionQuality: {
      summary: resume.summary ? 70 : null,
      experience,
      skills: resume.skills.length >= 5 ? 75 : resume.skills.length > 0 ? 55 : null,
      projects,
    },
    bulletFindings,
    possibleTypos: [],
    recommendations: recommendations.slice(0, 8),
  };
}

function contentWords(text: string, minLength: number): Set<string> {
  return new Set(
    wordsOf(text.toLowerCase()).filter(
      (w) => w.length >= minLength && !ENGLISH_STOPWORDS.has(w),
    ),
  );
}

function bestEvidence(
  words: Set<string>,
  pieces: string[],
): { text: string; hits: number } | null {
  let best: { text: string; hits: number } | null = null;
  for (const text of pieces) {
    const own = contentWords(text, 3);
    let hits = 0;
    for (const w of words) if (own.has(w)) hits += 1;
    if (hits > 0 && (!best || hits > best.hits)) best = { text, hits };
  }
  return best;
}

function assessMatch(data: {
  resume: CompactResume;
  requirements: { name: string; importance: "required" | "preferred" }[];
  responsibilities: string[];
}): MatchAssessment {
  const pieces = [
    ...bulletsOf(data.resume).map((b) => b.text),
    ...(data.resume.summary ? [data.resume.summary] : []),
  ];

  const coverage = data.requirements.slice(0, 40).map((requirement) => {
    const words = contentWords(requirement.name, 3);
    const evidence = bestEvidence(words, pieces);
    if (!evidence) {
      return {
        requirement: requirement.name,
        covered: "no" as const,
        evidence: null,
        confidence: "high" as const,
      };
    }
    const complete = evidence.hits === words.size;
    return {
      requirement: requirement.name,
      covered: complete ? ("yes" as const) : ("partial" as const),
      evidence: evidence.text,
      confidence: complete ? ("high" as const) : ("medium" as const),
    };
  });

  const strong: MatchAssessment["responsibilityAlignment"]["strong"] = [];
  const weak: MatchAssessment["responsibilityAlignment"]["weak"] = [];
  for (const responsibility of data.responsibilities.slice(0, 12)) {
    const evidence = bestEvidence(contentWords(responsibility, 4), pieces);
    if (evidence && evidence.hits >= 2)
      strong.push({ responsibility, evidence: evidence.text });
    else weak.push({ responsibility, reason: "No clear example of this in the resume." });
  }
  const total = strong.length + weak.length;

  const tailoringRecommendations: Recommendation[] = coverage
    .filter((c) => c.covered === "partial")
    .slice(0, 3)
    .map((c) => ({
      priority:
        data.requirements.find((r) => r.name === c.requirement)?.importance === "required"
          ? "high"
          : "medium",
      category: "job_match",
      title: `Name ${c.requirement} where you used it`,
      detail: `The posting asks for ${c.requirement}. If this work involved it, say so in the bullet so searches for it find your resume.`,
      before: c.evidence,
      after: null,
      target: null,
    }));

  return {
    coverage,
    responsibilityAlignment: {
      score: total === 0 ? 50 : Math.round((strong.length / total) * 100),
      strong: strong.slice(0, 6),
      weak: weak.slice(0, 6),
    },
    tailoringRecommendations,
    honestyFlags: [],
  };
}

function extract(data: { jobDescription: string }): AiJobRequirements {
  const rules = extractJobRequirements(data.jobDescription);
  const clamp = (n: number | null) => (n === null ? null : Math.min(40, Math.max(0, n)));
  return {
    ...rules,
    jobTitle: rules.jobTitle?.slice(0, 120) ?? null,
    yearsExperience: {
      min: clamp(rules.yearsExperience.min),
      max: clamp(rules.yearsExperience.max),
    },
    education: {
      ...rules.education,
      field: rules.education.field?.slice(0, 120) ?? null,
    },
    hardSkills: rules.hardSkills.map((s) => ({ ...s, name: s.name.slice(0, 60) })),
    softSkills: rules.softSkills.map((s) => s.slice(0, 40)),
    certifications: rules.certifications.map((c) => ({
      ...c,
      name: c.name.slice(0, 80),
    })),
    responsibilities: rules.responsibilities.map((r) => r.slice(0, 160)),
    domain: null,
  };
}

const TASKS: Record<AiTaskName, (data: never) => unknown> = {
  extractJobRequirements: extract,
  analyzeContent,
  assessMatch,
};

const tokens = (value: unknown) => Math.ceil(JSON.stringify(value).length / 4);

export function createMockProvider(): AiProvider {
  return {
    name: "mock",
    model: "mock",
    async complete<T>(request: AiRequest<T>): Promise<AiResult<T>> {
      const started = Date.now();
      if (request.signal?.aborted)
        throw new AiError("timeout", `${request.task}: aborted`);
      const output = TASKS[request.task](request.data as never);
      const result = request.schema.safeParse(output);
      if (!result.success)
        throw new AiError("invalid_output", `${request.task}: mock output invalid`);
      return {
        data: result.data,
        usage: { inputTokens: tokens(request.data), outputTokens: tokens(output) },
        latencyMs: Date.now() - started,
        repaired: false,
      };
    },
  };
}
