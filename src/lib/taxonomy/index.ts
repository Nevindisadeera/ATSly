import type { EducationLevel, SectionKind, SkillKind } from "@/lib/parsing/types";

import degreesJson from "./degrees.json";
import headingsJson from "./section-headings.json";
import skillsJson from "./skills.json";
import actionVerbsJson from "./action-verbs.json";
import phrasesJson from "./phrases.json";

/** Static vocabularies used by the parser and, later, the ATS and matching engines. */

export type TaxonomySkill = {
  id: string;
  name: string;
  category: string;
  kind: SkillKind;
  aliases: string[];
};

const skills = skillsJson as TaxonomySkill[];

/** Lowercase, "&" → "and", drop punctuation and trailing colons, collapse spaces. */
export function normalizeHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const HEADINGS = new Map<string, SectionKind>();
for (const [kind, phrases] of Object.entries(headingsJson)) {
  for (const phrase of phrases)
    HEADINGS.set(normalizeHeading(phrase), kind as SectionKind);
}

export type HeadingMatch = { kind: SectionKind; exact: boolean };

/**
 * Matches a candidate heading against the lexicon. Exact matches are standard headings;
 * a heading that starts with a known phrase ("Experience & Leadership") is a partial match.
 */
export function matchHeading(text: string): HeadingMatch | null {
  const normalized = normalizeHeading(text);
  if (!normalized) return null;
  const exact = HEADINGS.get(normalized);
  if (exact) return { kind: exact, exact: true };
  let best: { kind: SectionKind; length: number } | null = null;
  for (const [phrase, kind] of HEADINGS) {
    if (phrase.length < 4) continue;
    if (normalized.startsWith(`${phrase} `) || normalized.endsWith(` ${phrase}`)) {
      if (!best || phrase.length > best.length) best = { kind, length: phrase.length };
    }
  }
  return best ? { kind: best.kind, exact: false } : null;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Builds a whole-word pattern for a degree term. Periods are optional ("B.S." matches "BS").
 * Two-letter abbreviations ("AS", "MA", "BS") are also English words, so they match only in capitals.
 */
function degreePattern(term: string): RegExp {
  const short = term.replace(/\./g, "").length <= 2;
  const source = (short ? term.toUpperCase() : term)
    .split(".")
    .map(escapeRegExp)
    .join("\\.?");
  return new RegExp(`(?<![\\p{L}\\p{N}])${source}(?![\\p{L}\\p{N}])`, short ? "u" : "iu");
}

const DEGREE_TERMS: { pattern: RegExp; level: EducationLevel; length: number }[] =
  Object.entries(degreesJson)
    .flatMap(([level, terms]) =>
      terms.map((term) => ({
        level: level as EducationLevel,
        pattern: degreePattern(term),
        length: term.length,
      })),
    )
    .sort((a, b) => b.length - a.length);

/** Finds the highest-specificity degree mentioned in a line. */
export function matchDegree(
  text: string,
): { level: EducationLevel; term: string } | null {
  for (const { pattern, level } of DEGREE_TERMS) {
    const m = text.match(pattern);
    if (m) return { level, term: m[0] };
  }
  return null;
}

const ALIASES = new Map<string, TaxonomySkill>();
for (const skill of skills) {
  ALIASES.set(skill.name.toLowerCase(), skill);
  ALIASES.set(skill.id, skill);
  for (const alias of skill.aliases) ALIASES.set(alias, skill);
}

/** Lowercase, trim, and drop trailing version numbers ("Python 3.11" → "python"). */
export function normalizeSkill(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[()[\]]/g, " ")
    .replace(/\s+v?\d+(\.\d+)*\+?$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function lookupSkill(raw: string): TaxonomySkill | undefined {
  return ALIASES.get(normalizeSkill(raw));
}

/**
 * Aliases too ambiguous to match inside sentences ("rest of the team", "go to market").
 * They still match as standalone items in a skills list.
 */
const AMBIGUOUS_IN_PROSE = new Set([
  "c",
  "r",
  "go",
  "ts",
  "rest",
  "node",
  "next",
  "spring",
  "slack",
  "notion",
  "sales",
  "analytics",
  "testing",
  "documentation",
  "organization",
  "flexibility",
  "collaboration",
  "coaching",
  "presenting",
  "sourcing",
  "lambda",
  "torch",
  "excel",
  "ux",
  "ml",
  "oracle",
  "security",
  "dns",
  "branding",
  "forecasting",
  "troubleshooting",
  "experimentation",
  "prioritization",
  "leadership",
  "communication",
  "creativity",
  "negotiation",
  "mentoring",
]);

type ProsePattern = { skill: TaxonomySkill; pattern: RegExp };

const PROSE_PATTERNS: ProsePattern[] = [];
const prosePattern = (term: string, flags: string) =>
  new RegExp(`(?<![\\p{L}\\p{N}.])${escapeRegExp(term)}(?![\\p{L}\\p{N}+#])`, flags);

for (const skill of skills) {
  const terms = new Set([skill.name.toLowerCase(), ...skill.aliases]);
  for (const term of terms) {
    if (term.length < 2) continue;
    if (!AMBIGUOUS_IN_PROSE.has(term)) {
      PROSE_PATTERNS.push({ skill, pattern: prosePattern(term, "iu") });
    } else if (term.length <= 4) {
      // Short ambiguous aliases count when written as an acronym: "REST", "UX", "ML", "DNS".
      PROSE_PATTERNS.push({ skill, pattern: prosePattern(term.toUpperCase(), "u") });
    }
  }
  // Ambiguous canonical names count with their exact casing: "Go", "Spring", "Excel".
  if (skill.name.length >= 2 && AMBIGUOUS_IN_PROSE.has(skill.name.toLowerCase())) {
    PROSE_PATTERNS.push({ skill, pattern: prosePattern(skill.name, "u") });
  }
}

/** Taxonomy skills mentioned anywhere in free text, deduplicated, in first-seen order. */
export function findSkillsInText(text: string): TaxonomySkill[] {
  const found = new Map<string, { skill: TaxonomySkill; index: number }>();
  for (const { skill, pattern } of PROSE_PATTERNS) {
    if (found.has(skill.id)) continue;
    const m = pattern.exec(text);
    if (m) found.set(skill.id, { skill, index: m.index });
  }
  return [...found.values()].sort((a, b) => a.index - b.index).map((f) => f.skill);
}

export const SKILLS: readonly TaxonomySkill[] = skills;

/** Words that usually appear in job titles; used to tell titles from company names. */
export const TITLE_WORDS = new Set([
  "engineer",
  "developer",
  "programmer",
  "architect",
  "manager",
  "director",
  "lead",
  "head",
  "analyst",
  "scientist",
  "designer",
  "consultant",
  "specialist",
  "coordinator",
  "assistant",
  "associate",
  "officer",
  "administrator",
  "intern",
  "internship",
  "trainee",
  "executive",
  "president",
  "vp",
  "founder",
  "co-founder",
  "cofounder",
  "owner",
  "partner",
  "principal",
  "staff",
  "senior",
  "junior",
  "sr",
  "jr",
  "chief",
  "cto",
  "ceo",
  "cfo",
  "coo",
  "teacher",
  "tutor",
  "instructor",
  "lecturer",
  "professor",
  "researcher",
  "nurse",
  "accountant",
  "representative",
  "agent",
  "advisor",
  "adviser",
  "strategist",
  "writer",
  "editor",
  "marketer",
  "recruiter",
  "technician",
  "supervisor",
  "clerk",
  "cashier",
  "attendant",
  "volunteer",
  "fellow",
  "contractor",
  "freelancer",
  "freelance",
  "product",
  "owner",
]);

/** Common words in company names, used as a weak signal. */
export const COMPANY_WORDS = new Set([
  "inc",
  "inc.",
  "llc",
  "ltd",
  "ltd.",
  "limited",
  "corp",
  "corp.",
  "corporation",
  "company",
  "co",
  "co.",
  "group",
  "gmbh",
  "plc",
  "pvt",
  "technologies",
  "solutions",
  "labs",
  "studio",
  "studios",
  "agency",
  "bank",
  "university",
  "college",
  "hospital",
  "foundation",
  "systems",
]);

export const SPOKEN_LANGUAGES = new Set([
  "english",
  "spanish",
  "french",
  "german",
  "italian",
  "portuguese",
  "dutch",
  "russian",
  "chinese",
  "mandarin",
  "cantonese",
  "japanese",
  "korean",
  "arabic",
  "hindi",
  "bengali",
  "urdu",
  "punjabi",
  "tamil",
  "telugu",
  "sinhala",
  "sinhalese",
  "malay",
  "indonesian",
  "thai",
  "vietnamese",
  "turkish",
  "persian",
  "farsi",
  "hebrew",
  "greek",
  "polish",
  "czech",
  "swedish",
  "norwegian",
  "danish",
  "finnish",
  "ukrainian",
  "romanian",
  "hungarian",
  "tagalog",
  "filipino",
  "swahili",
  "afrikaans",
  "catalan",
  "irish",
  "welsh",
  "nepali",
  "marathi",
  "gujarati",
  "kannada",
  "malayalam",
  "sign language",
  "asl",
]);

/** Frequent English function words, for a lightweight language check. */
export const ENGLISH_STOPWORDS = new Set([
  "the",
  "and",
  "to",
  "of",
  "a",
  "in",
  "for",
  "with",
  "on",
  "by",
  "as",
  "at",
  "from",
  "an",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "this",
  "that",
  "it",
  "or",
  "using",
  "into",
  "over",
  "across",
  "through",
  "within",
  "while",
  "including",
  "per",
  "my",
  "our",
  "their",
  "which",
  "who",
  "than",
  "more",
  "new",
  "all",
  "team",
  "teams",
  "led",
  "built",
  "managed",
  "developed",
  "improved",
  "increased",
  "reduced",
  "created",
  "designed",
  "worked",
]);

/** Strong verbs that open achievement bullets ("Led", "Built", "Reduced"). */
export const ACTION_VERBS: ReadonlySet<string> = new Set(actionVerbsJson as string[]);

/** Phrases that describe duties rather than results ("responsible for", "worked on"). */
export const WEAK_PHRASES: readonly string[] = phrasesJson.weakPhrases;

/** Self-descriptions recruiters skim past ("results-driven", "team player"). */
export const BUZZWORDS: readonly string[] = phrasesJson.buzzwords;

/** Common acronyms and their expansions; ATS searches may use either form. */
export const ACRONYMS: Readonly<Record<string, string>> = phrasesJson.acronyms;

/** Novelty and symbol fonts that some ATS parsers render as garbage. */
export const DECORATIVE_FONTS: readonly string[] = phrasesJson.decorativeFonts;
