import "server-only";

import type { StoredRecommendation } from "@/lib/ai/recommendations";
import { containment, MIN_SIMILARITY, normalizedTokens } from "@/lib/ai/verify";
import { CATEGORY_LABELS } from "@/lib/ats/weights";
import { resumeEntries } from "@/lib/matching/match";
import type { ParsedResume } from "@/lib/parsing/types";
import type { ScanAiDetail } from "@/types/api";

import type {
  RecommendationPriority,
  RecommendationsNotice,
  RecommendationsView,
  RecommendationView,
  RetryView,
} from "./types";

/**
 * The recommendations section — docs/PLANNING.md §7.3, section 8, §20 and §24: the
 * recommendations stored on the scan, located in the resume, and what to say when AI
 * review failed or didn't run.
 */

export const checkAnchor = (id: string) => `check-${id}`;
export const recommendationAnchor = (id: string) => `recommendation-${id}`;

export type QuoteLocator = (quote: string) => string | undefined;

/**
 * Finds where a quote from the resume sits, e.g. "Experience › Acme › bullet 2", using the
 * same similarity threshold as evidence verification. Undefined without the resume.
 */
export function quoteLocator(resume: ParsedResume | null): QuoteLocator {
  if (!resume) return () => undefined;
  const entries = resumeEntries(resume).map((entry) => ({
    location: entry.location,
    tokens: normalizedTokens(entry.text),
  }));
  return (quote) => {
    const tokens = normalizedTokens(quote);
    let best: { location: string; score: number } | undefined;
    for (const entry of entries) {
      const score = containment(tokens, entry.tokens);
      if (score >= MIN_SIMILARITY && (!best || score > best.score)) {
        best = { location: entry.location, score };
      }
    }
    return best?.location;
  };
}

const SECTION_NAMES: Record<
  NonNullable<StoredRecommendation["target"]>["section"],
  string | null
> = {
  summary: "Summary",
  experience: "Experience",
  projects: "Projects",
  skills: "Skills",
  education: "Education",
  other: null,
};

/** A recommendation's target as a path, in the same form as match evidence locations. */
export function targetLocation(
  target: StoredRecommendation["target"],
  resume: ParsedResume | null,
): string | null {
  if (!target) return null;
  const section = SECTION_NAMES[target.section];
  if (!section) return null;
  const index = target.entryIndex;
  if (
    (target.section !== "experience" && target.section !== "projects") ||
    index === null
  )
    return section;
  if (index < 0) return section;

  const isRole = target.section === "experience";
  let name: string | undefined;
  let bulletCount: number | undefined;
  if (resume && isRole) {
    const role = resume.experience[index];
    if (!role) return section;
    name = role.company ?? role.title ?? undefined;
    bulletCount = role.bullets.length;
  } else if (resume) {
    const project = resume.projects[index];
    if (!project) return section;
    name = project.name ?? undefined;
    bulletCount = project.bullets.length;
  }
  const where = `${section} › ${name ?? `${isRole ? "Role" : "Project"} ${index + 1}`}`;
  const bullet = target.bulletIndex;
  if (
    bullet === null ||
    bullet < 0 ||
    (bulletCount !== undefined && bullet >= bulletCount)
  )
    return where;
  return `${where} › bullet ${bullet + 1}`;
}

/** Placeholders a rewrite leaves for the user, e.g. "[X %]" or "[metric]". */
export function placeholdersIn(text: string): string[] {
  return [...new Set(text.match(/\[[^[\]]{1,24}\]/g) ?? [])];
}

const CATEGORY_LABEL: Record<StoredRecommendation["category"], string> = {
  ...CATEGORY_LABELS,
  job_match: "Job match",
};

function toView(
  rec: StoredRecommendation,
  resume: ParsedResume | null,
  locate: QuoteLocator,
): RecommendationView {
  return {
    id: rec.id,
    anchor: recommendationAnchor(rec.id),
    priority: rec.priority,
    categoryLabel: CATEGORY_LABEL[rec.category],
    title: rec.title,
    detail: rec.detail,
    before: rec.before,
    after: rec.after,
    placeholders: rec.after ? placeholdersIn(rec.after) : [],
    // A verified quote locates itself more reliably than the model's target indexes.
    location:
      (rec.before ? locate(rec.before) : undefined) ?? targetLocation(rec.target, resume),
    source: rec.source,
    sourceLabel:
      rec.source === "ai"
        ? "AI suggestion"
        : rec.checkId
          ? "From the checks"
          : "From the job match",
    checkAnchor: rec.checkId ? checkAnchor(rec.checkId) : null,
    related: rec.checkId
      ? { href: `#${checkAnchor(rec.checkId)}`, label: "See the check" }
      : rec.source === "rules" && rec.category === "job_match"
        ? { href: "#job-match", label: "See the job match" }
        : null,
  };
}

const SCORES_UNAFFECTED = "Your scores aren't affected.";

function noticeFor(
  ai: ScanAiDetail,
  hasItems: boolean,
  retry: RetryView | null,
): RecommendationsNotice | null {
  switch (ai.status) {
    case "complete":
      return null;
    case "partial":
    case "failed":
      return {
        tone: "warning",
        title: hasItems
          ? "Some recommendations are temporarily unavailable."
          : "Recommendations are temporarily unavailable.",
        body: [
          ai.status === "partial"
            ? "Part of the AI review didn't finish, so some suggested rewrites may be missing."
            : "The AI review didn't finish, so this report has no suggested rewrites.",
          SCORES_UNAFFECTED,
          retry ? "Running the analysis again usually fixes this." : "",
        ]
          .filter(Boolean)
          .join(" "),
        retry,
      };
    case "skipped":
      return ai.skippedReason === "budget"
        ? {
            tone: "info",
            title: "Suggested rewrites are paused for today.",
            body: `We've reached today's limit for AI review, so ${hasItems ? "the recommendations below come from the checks" : "there are no suggested rewrites"}. ${SCORES_UNAFFECTED} Scan again tomorrow for suggested rewrites.`,
            retry: null,
          }
        : {
            tone: "info",
            title: "Suggested rewrites aren't available.",
            body: `AI review isn't switched on, so ${hasItems ? "the recommendations below come from the checks" : "there are no suggested rewrites"}. ${SCORES_UNAFFECTED}`,
            retry: null,
          };
  }
}

export function buildRecommendationsView(input: {
  ai: ScanAiDetail | null;
  resume: ParsedResume | null;
  resumeId: string;
  /** The saved job description the scan was matched against, if any. */
  jobDescriptionId: string | null;
}): RecommendationsView {
  const { ai, resume } = input;
  // Retrying needs the resume; the job description is reused as it was saved.
  const retry: RetryView | null = resume
    ? { resumeId: input.resumeId, jobDescriptionId: input.jobDescriptionId }
    : null;

  const locate = quoteLocator(resume);
  const items = (ai?.recommendations ?? []).map((rec) => toView(rec, resume, locate));
  const counts: Record<RecommendationPriority, number> = { high: 0, medium: 0, low: 0 };
  for (const item of items) counts[item.priority] += 1;

  // Reports from before recommendations existed: skipped, with no reason and nothing saved.
  if (!ai || (ai.status === "skipped" && !ai.skippedReason && items.length === 0)) {
    return {
      items,
      counts,
      notice: null,
      empty: {
        title: "No recommendations were saved with this report",
        description: retry
          ? "It was created before recommendations were added. Scan the resume again to get them."
          : "It was created before recommendations were added.",
        retry,
      },
    };
  }

  const notice = noticeFor(ai, items.length > 0, retry);
  const empty =
    items.length > 0 || notice?.tone === "warning"
      ? null
      : {
          title: "Nothing to recommend",
          description:
            ai.status === "complete"
              ? "Your resume passed every check that applied, and the AI review found nothing to change."
              : "Your resume passed every check that applied.",
          retry: null,
        };
  return { items, counts, notice, empty };
}
