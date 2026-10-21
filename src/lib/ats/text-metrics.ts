import { ACTION_VERBS, BUZZWORDS, WEAK_PHRASES } from "@/lib/taxonomy";

/** Text measurements used by content and readability checks. Deterministic heuristics. */

export function wordsOf(text: string): string[] {
  return text.match(/[\p{L}\p{N}][\p{L}\p{N}'’.+#&/-]*/gu) ?? [];
}

/** The verb a bullet opens with, skipping a leading adverb ("Successfully led" → "led"). */
export function openingVerb(bullet: string): string | undefined {
  const words = wordsOf(bullet.toLowerCase().replace(/[^\p{L}\s'-]/gu, " "));
  const [first, second] = words;
  if (first && first.endsWith("ly") && second) return second;
  return first;
}

export function startsWithActionVerb(bullet: string): boolean {
  const verb = openingVerb(bullet);
  return verb !== undefined && ACTION_VERBS.has(verb);
}

const NUMBER_WORDS =
  /\b(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|hundreds?|thousands?|millions?|billions?|dozens?|double[ds]?|triple[ds]?|halved|half)\b/i;

/** Contains a number, percentage, currency amount or number word. */
export function isQuantified(text: string): boolean {
  return /\d/.test(text) || /[%$£€¥]/.test(text) || NUMBER_WORDS.test(text);
}

const PASSIVE =
  /\b(?:was|were|been|being|is|are|got)\s+(?:\w+ly\s+)?(?:\w+ed|built|made|done|led|run|written|given|taken|chosen|seen|known|sent|held|kept|brought|taught|won)\b/i;

export function isPassive(text: string): boolean {
  return PASSIVE.test(text);
}

const FIRST_PERSON = /(?:^|[^\p{L}])(?:I|me|my|mine|myself|we|our|ours)(?![\p{L}])/u;

export function hasFirstPerson(text: string): boolean {
  // "I" is only a pronoun in capitals; the others are matched case-insensitively.
  return (
    FIRST_PERSON.test(text) ||
    /(?:^|[^\p{L}])(?:Me|My|Mine|We|Our)(?![\p{L}])/u.test(text)
  );
}

export function weakPhrasesIn(text: string): string[] {
  const lower = text.toLowerCase();
  return WEAK_PHRASES.filter((p) => lower.includes(p));
}

export function buzzwordCount(text: string): { count: number; found: string[] } {
  const lower = text.toLowerCase();
  const found: string[] = [];
  let count = 0;
  for (const phrase of BUZZWORDS) {
    const occurrences = lower.split(phrase).length - 1;
    if (occurrences > 0) {
      count += occurrences;
      found.push(phrase);
    }
  }
  return { count, found };
}

/** Approximate English syllable count. */
export function syllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (w.length <= 3) return w.length > 0 ? 1 : 0;
  const trimmed = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "");
  const groups = trimmed.match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups?.length ?? 1);
}

/** Flesch–Kincaid grade level over sentences (each bullet counts as a sentence). */
export function readingGrade(sentences: string[]): number | null {
  const usable = sentences.filter((s) => wordsOf(s).length >= 3);
  if (usable.length < 3) return null;
  const words = usable.flatMap(wordsOf);
  const syllableCount = words.reduce((sum, w) => sum + syllables(w), 0);
  return (
    0.39 * (words.length / usable.length) + 11.8 * (syllableCount / words.length) - 15.59
  );
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Whole-word occurrences of a term. Short terms ("Go", "R", "QA") match their exact casing
 * only, so they aren't counted inside ordinary prose.
 */
export function countTerm(text: string, term: string): number {
  const flags = term.length >= 4 ? "giu" : "gu";
  const pattern = new RegExp(
    `(?<![\\p{L}\\p{N}])${escapeRegExp(term)}(?![\\p{L}\\p{N}+#])`,
    flags,
  );
  return text.match(pattern)?.length ?? 0;
}

export function percent(part: number, whole: number): number {
  return whole === 0 ? 0 : Math.round((part / whole) * 100);
}

export function plural(
  count: number,
  singular: string,
  pluralForm = `${singular}s`,
): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}
