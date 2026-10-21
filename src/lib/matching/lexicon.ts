import type { Seniority } from "./types";

/** Vocabularies for reading job descriptions — docs/PLANNING.md §19.1. */

export type SegmentKind =
  "about" | "responsibilities" | "requirements" | "preferred" | "benefits" | "other";

/** Section headings, matched against a whole line after trimming a trailing colon. */
export const SEGMENT_HEADINGS: { kind: SegmentKind; pattern: RegExp }[] = [
  {
    kind: "preferred",
    pattern:
      /^(?:nice[ -]to[ -]haves?|preferred(?: qualifications| skills| experience)?|bonus(?: points)?|pluses|(?:it'?s )?a plus(?: if you have)?|additional qualifications|desired(?: skills| qualifications| experience)?|ideally,? you(?:'ll)? have|good to have|extra credit)$/i,
  },
  {
    kind: "requirements",
    pattern:
      /^(?:requirements|job requirements|qualifications|minimum qualifications|basic qualifications|required qualifications|required skills|key skills|skills|skills (?:and|&) experience|experience (?:and|&) skills|what you(?:'ll)? (?:need|bring)|what we(?:'re| are) looking for|who you are|about you|you (?:have|bring|are)|must[ -]haves?|your (?:skills|experience|profile|background)|the ideal candidate|technical skills)$/i,
  },
  {
    kind: "responsibilities",
    pattern:
      /^(?:responsibilities|key responsibilities|main responsibilities|your responsibilities|what you(?:'ll| will) do|what you(?:'ll| will) be doing|the role|about the role|role overview|your role|in this role,? you(?:'ll| will)|day[ -]to[ -]day|duties|key duties|your impact|you will|the job|job description|position summary)$/i,
  },
  {
    kind: "about",
    pattern:
      /^(?:about us|about the company|about the team|who we are|our (?:mission|team|company|story)|company overview|the company|the team|overview|why us|about [a-z0-9][\w.&' -]{0,40})$/i,
  },
  {
    kind: "benefits",
    pattern:
      /^(?:benefits|perks|perks (?:and|&) benefits|benefits (?:and|&) perks|what we offer|we offer|why join us|why you'?ll love (?:it|working here)|compensation|salary|pay range|salary range|what'?s in it for you|our offer)$/i,
  },
];

/** A line saying the item is optional ("Kubernetes is a plus"). */
export const PREFERRED_CUE =
  /\b(?:nice to have|nice-to-have|preferred|is a plus|are a plus|a big plus|a plus|bonus|ideally|desirable|advantageous|would be great|not required|optional)\b/i;

/** Equal-opportunity and legal boilerplate, dropped before analysis. */
export const BOILERPLATE =
  /\b(?:equal opportunity|equal employment|affirmative action|regardless of (?:race|age|gender)|without regard to|protected veteran|reasonable accommodation|e-verify|eeo\b)/i;

/** Seniority words in job titles, most specific first. */
export const SENIORITY_WORDS: { seniority: Seniority; pattern: RegExp }[] = [
  { seniority: "intern", pattern: /\b(?:intern|internship|trainee|apprentice)\b/i },
  {
    seniority: "executive",
    pattern:
      /\b(?:chief|ceo|cto|cfo|coo|cmo|cio|vp|svp|evp|vice president|c-level|president)\b/i,
  },
  { seniority: "director", pattern: /\b(?:director|head of)\b/i },
  { seniority: "principal", pattern: /\b(?:principal|distinguished|fellow)\b/i },
  { seniority: "lead", pattern: /\b(?:lead|staff|tech lead|team lead)\b/i },
  { seniority: "manager", pattern: /\bmanager\b/i },
  { seniority: "senior", pattern: /\b(?:senior|sr\.?)(?![\w])/i },
  {
    seniority: "junior",
    pattern: /\b(?:junior|jr\.?|entry[ -]level|graduate|associate)(?![\w])/i,
  },
  { seniority: "mid", pattern: /\b(?:mid[ -]level|mid|intermediate)\b/i },
];

/** Position on the seniority ladder; managers sit beside leads (§19.2). */
export const SENIORITY_RANK: Record<Exclude<Seniority, "unspecified">, number> = {
  intern: 0,
  junior: 1,
  mid: 2,
  senior: 3,
  lead: 4,
  manager: 4,
  principal: 5,
  director: 6,
  executive: 7,
};

/** Words dropped when comparing titles: seniority markers and filler. */
export const TITLE_STOPWORDS = new Set([
  "senior",
  "sr",
  "junior",
  "jr",
  "lead",
  "staff",
  "principal",
  "head",
  "intern",
  "mid",
  "level",
  "entry",
  "i",
  "ii",
  "iii",
  "iv",
  "of",
  "and",
  "the",
  "for",
  "to",
  "a",
  "an",
  "in",
  "at",
  "with",
  "remote",
  "hybrid",
  "contract",
  "temporary",
  "part",
  "full",
  "time",
]);

/** Title words that mean the same thing for matching purposes. */
export const TITLE_SYNONYMS: Record<string, string> = {
  developer: "engineer",
  dev: "engineer",
  programmer: "engineer",
  swe: "engineer",
  sde: "engineer",
  coder: "engineer",
  "front-end": "frontend",
  "back-end": "backend",
  "full-stack": "fullstack",
  fullstack: "fullstack",
  ux: "ux",
  ui: "ui",
  "user-experience": "ux",
  accountant: "accounting",
  accounting: "accounting",
  analytics: "analyst",
  marketer: "marketing",
  pm: "product",
  mgr: "manager",
};

/** Words that make a short first line look like a job title. */
export const ROLE_NOUNS =
  /\b(?:engineer|developer|programmer|architect|analyst|scientist|designer|manager|director|lead|specialist|coordinator|consultant|accountant|administrator|associate|executive|officer|strategist|marketer|writer|editor|researcher|recruiter|representative|technician|assistant|intern|head|owner|controller|planner|advisor|nurse|teacher)s?\b/i;

const WORD_NUMBERS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  twelve: 12,
  fifteen: 15,
};

/** "5", "five" → 5. */
export function parseCount(value: string): number | null {
  const n = Number(value);
  if (Number.isFinite(n)) return n;
  return WORD_NUMBERS[value.toLowerCase()] ?? null;
}

export const COUNT =
  "(\\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|twelve|fifteen)";
