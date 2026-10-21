import { findCertificationsInText, findSkillsInText, matchDegree } from "@/lib/taxonomy";

import {
  COUNT,
  parseCount,
  PREFERRED_CUE,
  ROLE_NOUNS,
  SENIORITY_WORDS,
  type SegmentKind,
} from "./lexicon";
import { normalizeJobText, segmentJobText, type Segment } from "./segment";
import type { Importance, JobEducationLevel, JobRequirements, Seniority } from "./types";

/**
 * Rules-based requirement extraction — docs/PLANNING.md §19.1. Deterministic and offline;
 * AI extraction (Phase 10a) produces the same shape and is merged with this.
 */

const MAX_HARD_SKILLS = 40;
const MAX_SOFT_SKILLS = 12;
const MAX_CERTIFICATIONS = 10;
const MAX_RESPONSIBILITIES = 12;

/** Sections whose skills count; company blurbs and benefits don't describe the job. */
const SKILL_SEGMENTS = new Set<SegmentKind>([
  "requirements",
  "preferred",
  "responsibilities",
  "other",
]);

function importanceOf(segment: Segment, line: string): Importance {
  return segment.kind === "preferred" || PREFERRED_CUE.test(line)
    ? "preferred"
    : "required";
}

/** Required beats preferred when a term appears in both. */
function addTerm<T extends { importance: Importance }>(
  map: Map<string, T>,
  key: string,
  value: T,
) {
  const existing = map.get(key);
  if (
    !existing ||
    (existing.importance === "preferred" && value.importance === "required")
  ) {
    map.set(key, value);
  }
}

const TITLE_LABEL = /^(?:job title|title|position|role)\s*[:：-]\s*(.{3,80})$/i;
const HIRING_PHRASE =
  /\b(?:hiring|looking for|seeking|searching for)\s+(?:an?\s+)?((?:[A-Z][\w+#/.-]*\s+){0,5}[A-Z][\w+#/.-]*)/;

export function detectJobTitle(text: string): string | null {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  for (const line of lines.slice(0, 10)) {
    const labelled = line.match(TITLE_LABEL);
    if (labelled) return labelled[1]!.trim();
  }
  const first = lines[0];
  if (
    first &&
    first.split(/\s+/).length <= 8 &&
    first.length <= 80 &&
    ROLE_NOUNS.test(first) &&
    !/[.!?]$/.test(first)
  ) {
    return first.replace(/\s*[-–—|(].*$/, "").trim() || first;
  }
  for (const line of lines.slice(0, 6)) {
    const hiring = line.match(HIRING_PHRASE);
    if (hiring && ROLE_NOUNS.test(hiring[1]!)) return hiring[1]!.trim();
  }
  return null;
}

export function detectSeniority(title: string | null, text: string): Seniority {
  if (title) {
    const fromTitle = SENIORITY_WORDS.find((s) => s.pattern.test(title));
    if (fromTitle) return fromTitle.seniority;
  }
  const level = text.match(/\b(entry|junior|mid|senior)[ -]level\b/i)?.[1]?.toLowerCase();
  if (level === "entry" || level === "junior") return "junior";
  if (level === "mid") return "mid";
  if (level === "senior") return "senior";
  return "unspecified";
}

const YEARS_PATTERNS: { pattern: RegExp; range: boolean }[] = [
  {
    pattern: new RegExp(`\\b${COUNT}\\s*(?:-|–|to)\\s*${COUNT}\\+?\\s*years?`, "gi"),
    range: true,
  },
  { pattern: new RegExp(`\\b${COUNT}\\s*\\+\\s*years?`, "gi"), range: false },
  {
    pattern: new RegExp(
      `\\b(?:at least|minimum(?: of)?|min\\.?|over|more than)\\s*${COUNT}\\s*years?`,
      "gi",
    ),
    range: false,
  },
  {
    pattern: new RegExp(
      `\\b${COUNT}\\s*years?\\s*(?:of\\s*)?(?:professional\\s*|relevant\\s*|industry\\s*|hands-on\\s*|work\\s*|proven\\s*)*(?:experience|exp\\b)`,
      "gi",
    ),
    range: false,
  },
];

/**
 * The years of experience asked for. Postings often give an overall figure and smaller
 * ones for single skills, so the largest minimum in the requirements wins.
 */
export function detectYears(lines: string[]): { min: number | null; max: number | null } {
  let best: { min: number; max: number | null } | null = null;
  for (const line of lines) {
    // A number inside "2-4 years" belongs to the range, not to "4 years of experience".
    const claimed: [number, number][] = [];
    for (const { pattern, range } of YEARS_PATTERNS) {
      for (const m of line.matchAll(pattern)) {
        const start = m.index;
        const end = start + m[0].length;
        if (claimed.some(([s, e]) => start < e && end > s)) continue;
        claimed.push([start, end]);
        const min = parseCount(m[1]!);
        const max = range ? parseCount(m[2]!) : null;
        if (min === null || min > 30 || (max !== null && max < min)) continue;
        if (!best || min > best.min) best = { min, max };
      }
    }
  }
  return best ?? { min: null, max: null };
}

const LEVEL_RANK: Record<Exclude<JobEducationLevel, "unspecified">, number> = {
  highschool: 1,
  associate: 2,
  bachelor: 3,
  master: 4,
  doctorate: 5,
};

const GENERIC_DEGREE = /\b(?:university|college|undergraduate|bachelor'?s?)?\s*degree\b/i;
/**
 * Degree words also appear in other senses in postings ("Scrum Master", "Associate
 * Product Manager", "MS Excel", "DBA"), so only lines about education are read for degrees.
 */
const DEGREE_CONTEXT =
  /\b(?:degree|diploma|bachelor'?s|bachelors|master'?s|masters|ph\.?\s?d|doctorate|mba|bsc|msc|b\.s\.|m\.s\.|ged|high school|university|college|graduate of)\b/i;
const HIGH_SCHOOL = /\b(?:high school|secondary school|ged)\b/i;
const NOT_REQUIRED = /\bor equivalent (?:practical |work |professional )?experience\b/i;
const FIELD = /\b(?:in|of)\s+((?:[A-Z][A-Za-z&]*(?:\s+|,\s*|\s+(?:and|or)\s+)?){1,6})/;

/** The lowest degree level a posting asks for, and whether it's a hard requirement. */
export function detectEducation(segments: Segment[]): JobRequirements["education"] {
  let found: {
    level: Exclude<JobEducationLevel, "unspecified">;
    field: string | null;
    required: boolean;
  } | null = null;
  for (const segment of segments) {
    if (!SKILL_SEGMENTS.has(segment.kind)) continue;
    for (const line of segment.lines) {
      if (!DEGREE_CONTEXT.test(line)) continue;
      const degree = matchDegree(line);
      let level: Exclude<JobEducationLevel, "unspecified"> | null = null;
      if (degree && degree.level !== "other") level = degree.level;
      else if (HIGH_SCHOOL.test(line)) level = "highschool";
      else if (GENERIC_DEGREE.test(line) && /\bdegree\b/i.test(line)) level = "bachelor";
      if (!level) continue;

      const required =
        segment.kind !== "preferred" &&
        !PREFERRED_CUE.test(line) &&
        !NOT_REQUIRED.test(line);
      const field =
        line
          .match(FIELD)?.[1]
          ?.replace(/[\s,]+(?:and|or)?\s*$/, "")
          .trim() || null;
      // Keep the lowest level a requirement accepts ("Bachelor's or Master's" → bachelor).
      if (!found || LEVEL_RANK[level] < LEVEL_RANK[found.level]) {
        found = { level, field, required };
      }
    }
  }
  return found ?? { level: "unspecified", field: null, required: false };
}

export function extractJobRequirements(
  rawText: string,
  options: { title?: string | null } = {},
): JobRequirements {
  const text = normalizeJobText(rawText);
  const segments = segmentJobText(text);

  const hard = new Map<string, JobRequirements["hardSkills"][number]>();
  const soft = new Map<string, { name: string; importance: Importance }>();
  const certifications = new Map<string, JobRequirements["certifications"][number]>();
  const requirementLines: string[] = [];

  for (const segment of segments) {
    if (!SKILL_SEGMENTS.has(segment.kind)) continue;
    if (segment.kind !== "preferred") requirementLines.push(...segment.lines);
    for (const line of segment.lines) {
      const importance = importanceOf(segment, line);
      for (const skill of findSkillsInText(line)) {
        if (skill.kind === "soft")
          addTerm(soft, skill.id, { name: skill.name, importance });
        else addTerm(hard, skill.id, { name: skill.name, kind: skill.kind, importance });
      }
      for (const certification of findCertificationsInText(line)) {
        addTerm(certifications, certification.id, {
          name: certification.name,
          importance,
        });
      }
    }
  }

  const jobTitle = options.title?.trim() || detectJobTitle(text);
  const responsibilities = segments
    .filter((s) => s.kind === "responsibilities")
    .flatMap((s) => s.lines)
    .filter((line) => line.length >= 10 && line.length <= 160)
    .slice(0, MAX_RESPONSIBILITIES);

  return {
    jobTitle,
    seniority: detectSeniority(jobTitle, text),
    yearsExperience: detectYears(requirementLines),
    education: detectEducation(segments),
    hardSkills: [...hard.values()].slice(0, MAX_HARD_SKILLS),
    softSkills: [...soft.values()].map((s) => s.name).slice(0, MAX_SOFT_SKILLS),
    certifications: [...certifications.values()].slice(0, MAX_CERTIFICATIONS),
    responsibilities,
    domain: null,
  };
}
