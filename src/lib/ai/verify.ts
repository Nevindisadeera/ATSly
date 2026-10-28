import type { ParsedResume } from "@/lib/parsing/types";

import type { ContentAnalysis, MatchAssessment, Recommendation } from "./schemas";

/**
 * Evidence verification — docs/PLANNING.md §20 (critical guardrail). Anything the model
 * quotes from the resume must really be there, and rewrites may not introduce numbers or
 * names the resume doesn't contain. Failing items are dropped and counted.
 */

export const MIN_SIMILARITY = 0.9;

/** Lowercase words with quotes, dashes and punctuation unified away. */
export function normalizedTokens(text: string): string[] {
  return (
    text
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[‘’‚‛′]/g, "'")
      .replace(/[“”„‟″]/g, '"')
      .replace(/[–—−]/g, "-")
      .match(/[\p{L}\p{N}]+(?:['.+#][\p{L}\p{N}]+)*/gu) ?? []
  );
}

/** Share of the quote's tokens (with repeats) found in the source. */
export function containment(quote: string[], source: string[]): number {
  if (quote.length === 0) return 0;
  const available = new Map<string, number>();
  for (const token of source) available.set(token, (available.get(token) ?? 0) + 1);
  let found = 0;
  for (const token of quote) {
    const left = available.get(token) ?? 0;
    if (left > 0) {
      found += 1;
      available.set(token, left - 1);
    }
  }
  return found / quote.length;
}

export type ResumeTextIndex = {
  /** Bullets, summary, entry lines and skills, each tokenized. */
  units: string[][];
  /** The whole resume as one normalized string, for quotes spanning lines. */
  joined: string;
  /** Every token in the resume, for rewrite checks. */
  vocabulary: Set<string>;
  /** Every number in the resume without separators ("120,000" → "120000"). */
  numbers: Set<string>;
};

const NUMBER = /\d+(?:[.,]\d+)*/g;
const digitsOf = (number: string) => number.replace(/[.,]/g, "");

export function indexResume(resume: ParsedResume, text = ""): ResumeTextIndex {
  const pieces: string[] = [
    resume.summary?.text ?? "",
    ...resume.experience.flatMap((e) => [e.rawText, ...e.bullets]),
    ...resume.projects.flatMap((p) => [p.rawText, ...p.bullets]),
    ...resume.education.map((e) => e.rawText),
    ...resume.skills.map((s) => s.raw),
    ...resume.certifications.map((c) => c.name),
    ...text.split("\n"),
  ].filter(Boolean);
  const units = pieces.flatMap((piece) => piece.split("\n")).map(normalizedTokens);
  const all = pieces.flatMap(normalizedTokens);
  return {
    units: [...units, ...pieces.map(normalizedTokens)],
    joined: all.join(" "),
    vocabulary: new Set(all),
    numbers: new Set(pieces.flatMap((piece) => piece.match(NUMBER) ?? []).map(digitsOf)),
  };
}

/** True when the quote is in the resume (≥ 0.9 token containment in one place, or verbatim). */
export function verifyQuote(
  quote: string | null | undefined,
  index: ResumeTextIndex,
): boolean {
  if (!quote) return false;
  const tokens = normalizedTokens(quote);
  if (tokens.length === 0) return false;
  if (index.joined.includes(tokens.join(" "))) return true;
  return index.units.some((unit) => containment(tokens, unit) >= MIN_SIMILARITY);
}

const PLACEHOLDER = /\[[^\]]{0,20}\]/g;
const SENTENCE_START = /(?:^|[.!?:;]\s+|\n\s*)$/;

/**
 * A rewrite is faithful when every number and every capitalized word that isn't starting a
 * sentence also appears in the resume. Placeholders such as "[X %]" are allowed.
 */
export function isFaithfulRewrite(rewrite: string, index: ResumeTextIndex): boolean {
  const text = rewrite.replace(PLACEHOLDER, " ");
  for (const number of text.match(NUMBER) ?? []) {
    if (!index.numbers.has(digitsOf(number))) return false;
  }
  for (const match of text.matchAll(/\b[A-Z][\p{L}\p{N}+#.]*/gu)) {
    const before = text.slice(0, match.index);
    if (SENTENCE_START.test(before)) continue;
    const word = normalizedTokens(match[0])[0];
    if (word && !index.vocabulary.has(word)) return false;
  }
  return true;
}

export type VerificationCount = { checked: number; dropped: number };

function verifyRecommendation(
  rec: Recommendation,
  index: ResumeTextIndex,
  count: VerificationCount,
): Recommendation | null {
  if (rec.before) {
    count.checked += 1;
    if (!verifyQuote(rec.before, index)) {
      count.dropped += 1;
      return null;
    }
  }
  if (rec.after && !isFaithfulRewrite(rec.after, index)) {
    count.dropped += 1;
    return { ...rec, after: null };
  }
  return rec;
}

export function verifyContentAnalysis(
  analysis: ContentAnalysis,
  index: ResumeTextIndex,
): { analysis: ContentAnalysis; count: VerificationCount } {
  const count: VerificationCount = { checked: 0, dropped: 0 };
  const bulletFindings = analysis.bulletFindings.flatMap((finding) => {
    count.checked += 1;
    if (!verifyQuote(finding.original, index)) {
      count.dropped += 1;
      return [];
    }
    if (finding.rewrite && !isFaithfulRewrite(finding.rewrite, index)) {
      count.dropped += 1;
      return [{ ...finding, rewrite: null }];
    }
    return [finding];
  });
  const recommendations = analysis.recommendations
    .map((rec) => verifyRecommendation(rec, index, count))
    .filter((rec): rec is Recommendation => rec !== null);
  return { analysis: { ...analysis, bulletFindings, recommendations }, count };
}

/**
 * Coverage claimed with evidence that isn't in the resume becomes "no"; strong alignments
 * need verified evidence too.
 */
export function verifyMatchAssessment(
  assessment: MatchAssessment,
  index: ResumeTextIndex,
): { assessment: MatchAssessment; count: VerificationCount } {
  const count: VerificationCount = { checked: 0, dropped: 0 };
  const coverage = assessment.coverage.map((item) => {
    if (item.covered === "no") return item;
    count.checked += 1;
    if (verifyQuote(item.evidence, index)) return item;
    count.dropped += 1;
    return { ...item, covered: "no" as const, evidence: null };
  });
  const strong = assessment.responsibilityAlignment.strong.filter((item) => {
    count.checked += 1;
    const ok = verifyQuote(item.evidence, index);
    if (!ok) count.dropped += 1;
    return ok;
  });
  const tailoringRecommendations = assessment.tailoringRecommendations
    .map((rec) => verifyRecommendation(rec, index, count))
    .filter((rec): rec is Recommendation => rec !== null);
  return {
    assessment: {
      ...assessment,
      coverage,
      responsibilityAlignment: { ...assessment.responsibilityAlignment, strong },
      tailoringRecommendations,
    },
    count,
  };
}
