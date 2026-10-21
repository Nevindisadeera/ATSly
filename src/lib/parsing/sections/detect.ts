import { findSkillsInText, matchDegree, matchHeading, TITLE_WORDS } from "@/lib/taxonomy";

import { findDateRange } from "../parse/dates";
import { displayText, median, upperRatio, wordCount } from "../text";
import type { Line, SectionKind } from "../types";

/**
 * Section detection — docs/PLANNING.md §17.4.
 * Lines are scored as headings from the lexicon and visual signals; content between
 * headings becomes a section. Text before the first heading is the contact block.
 */

export type SectionSpan = {
  kind: SectionKind;
  heading?: string;
  headingIsStandard: boolean;
  /** The heading stands out visually (style, size, bold or capitals). */
  headingEmphasis: boolean;
  /** Index of the heading line, or null for the contact block. */
  headingIndex: number | null;
  /** Content lines: [contentStart, contentEnd). */
  contentStart: number;
  contentEnd: number;
  confidence: number;
};

/**
 * Lexicon words that are also common list items ("Leadership", "Tools", "Research").
 * On their own they need a visual cue (bold, caps, size, heading style) to count as a heading.
 */
const WEAK_SINGLE_WORDS = new Set([
  "leadership",
  "research",
  "training",
  "courses",
  "activities",
  "work",
  "tools",
  "strengths",
  "portfolio",
  "expertise",
  "other",
  "additional",
  "about",
  "overview",
  "employment",
  "qualifications",
  "papers",
  "presentations",
  "patents",
  "degrees",
  "achievements",
  "accomplishments",
  "recognition",
  "affiliations",
  "memberships",
  "hobbies",
  "technologies",
  "competencies",
  "proficiencies",
  "credentials",
  "scholarships",
  "internships",
  "academics",
  "schooling",
  "contact",
  "miscellaneous",
  "profile",
]);

type Candidate = {
  index: number;
  kind: SectionKind | null;
  exact: boolean;
  score: number;
  /** Visual weight alone: heading style, size, bold, capitals. */
  visual: number;
};

export function scoreHeading(
  line: Line,
  bodySize: number,
  isFirstLine: boolean,
): Candidate | null {
  const text = displayText(line.text).replace(/:\s*$/, "").trim();
  const count = wordCount(text);
  if (count === 0 || count > 6 || text.length > 48) return null;
  if (line.listItem || line.region !== "body") return null;
  if (/[.!?;,]$/.test(text) || /@|https?:|www\./i.test(text)) return null;
  if ((text.match(/\d/g) ?? []).length > 2) return null;

  const match = matchHeading(text);
  const visual =
    (line.headingLevel !== undefined && line.headingLevel > 0 ? 2 : 0) +
    (bodySize > 0 && line.fontSize >= bodySize * 1.15 ? 1 : 0) +
    (line.bold ? 1 : 0) +
    (upperRatio(text) > 0.8 ? 1 : 0);

  if (match) {
    const normalized = text.toLowerCase();
    if (match.exact && WEAK_SINGLE_WORDS.has(normalized) && visual === 0) return null;
    return {
      index: -1,
      kind: match.kind,
      exact: match.exact,
      score: (match.exact ? 3 : 2) + visual,
      visual,
    };
  }
  // The first line is almost always the person's name, which looks like a heading.
  if (isFirstLine) return null;
  // Unrecognized headings need visual weight; detectSections also accepts weaker ones
  // that share the exact style of recognized headings.
  return visual >= 1 && count <= 4
    ? { index: -1, kind: null, exact: false, score: visual, visual }
    : null;
}

/** Visual style of a line, used to recognize headings that share a style. */
function signature(line: Line, text: string): string {
  return [
    line.bold ? "b" : "",
    upperRatio(text) > 0.8 ? "u" : "",
    Math.round(line.fontSize),
    line.headingLevel ?? "",
  ].join("|");
}

export function detectSections(lines: Line[]): SectionSpan[] {
  const body = lines.filter((l) => l.region === "body");
  const bodySize = median(
    body.filter((l) => wordCount(l.text) >= 4).map((l) => l.fontSize),
  );
  const firstBody = lines.findIndex((l) => l.region === "body");

  const candidates: Candidate[] = [];
  lines.forEach((line, index) => {
    const candidate = scoreHeading(line, bodySize, index === firstBody);
    if (candidate) candidates.push({ ...candidate, index });
  });

  // Learn the heading style from recognized headings that are visually distinct, as long
  // as ordinary body lines rarely share it (so bold job titles don't qualify).
  const sig = (i: number) => signature(lines[i]!, displayText(lines[i]!.text));
  const recognized = candidates.filter((c) => c.kind !== null && c.score >= 3);
  const recognizedIndexes = new Set(recognized.map((c) => c.index));
  const learned = new Set(
    recognized.filter((c) => c.score >= 4).map((c) => sig(c.index)),
  );
  for (const s of learned) {
    // Lines other than recognized headings that share the style.
    const others = lines.filter(
      (l, i) =>
        l.region === "body" &&
        !recognizedIndexes.has(i) &&
        signature(l, displayText(l.text)) === s,
    ).length;
    // Reject the style if ordinary text often uses it, or if there would be more extra
    // "headings" than real ones — the sign of bold-caps company names, not section titles.
    const share = others / Math.max(1, body.length - recognized.length);
    if (share > 0.2 || others > Math.max(1, Math.floor(recognized.length / 2)))
      learned.delete(s);
  }

  const headings = candidates.filter((c) =>
    c.kind !== null ? c.score >= 3 : c.score >= 3 || learned.has(sig(c.index)),
  );

  const spans: SectionSpan[] = [];
  const firstHeading = headings[0]?.index ?? lines.length;
  if (lines.slice(0, firstHeading).some((l) => l.region === "body")) {
    spans.push({
      kind: "contact",
      headingIsStandard: true,
      headingEmphasis: false,
      headingIndex: null,
      contentStart: 0,
      contentEnd: firstHeading,
      confidence: 0.9,
    });
  }

  headings.forEach((heading, i) => {
    const contentStart = heading.index + 1;
    const contentEnd = headings[i + 1]?.index ?? lines.length;
    const content = lines.slice(contentStart, contentEnd);
    const kind = heading.kind ?? classifyByContent(content);
    spans.push({
      kind,
      heading: displayText(lines[heading.index]!.text).replace(/:\s*$/, ""),
      headingIsStandard: heading.kind !== null && heading.exact,
      headingEmphasis: heading.visual > 0,
      headingIndex: heading.index,
      contentStart,
      contentEnd,
      confidence: heading.kind
        ? heading.exact
          ? 0.95
          : 0.8
        : kind === "other"
          ? 0.4
          : 0.6,
    });
  });
  return spans;
}

/** Guesses what a section is when its heading isn't recognized ("My Journey"). */
export function classifyByContent(lines: Line[]): SectionKind {
  const text = lines.map((l) => l.text).join("\n");
  const dateLines = lines.filter((l) => findDateRange(l.text)).length;
  const degreeLines = lines.filter((l) => matchDegree(l.text)).length;
  const institutionLines = lines.filter((l) =>
    /\b(university|college|institute|school|academy|polytechnic)\b/i.test(l.text),
  ).length;
  const listLike = lines.filter((l) => l.listItem || wordCount(l.text) >= 6).length;
  const skills = findSkillsInText(text).length;
  const words = wordCount(text);

  const titleLines = lines.filter((l) =>
    l.text
      .toLowerCase()
      .split(/[^\p{L}]+/u)
      .some((w) => TITLE_WORDS.has(w)),
  ).length;

  if (degreeLines > 0) return "education";
  // Roles with dates ("Lecturer, University of X (2015 – 2018)") are experience, even at a university.
  if (dateLines > 0 && (listLike > 0 || titleLines > 0)) return "experience";
  if (institutionLines > 0) return "education";
  if (skills >= 3 && words / Math.max(1, skills) < 6) return "skills";
  if (lines.length <= 4 && words >= 20 && dateLines === 0) return "summary";
  return "other";
}
