import { ROLE_NOUNS } from "./lexicon";

/**
 * Job title detection. Kept apart from extraction, which loads the skills taxonomy, so the
 * browser can prefill the title field without downloading it.
 */

const TITLE_LABEL = /^(?:job title|title|position|role)\s*[:：-]\s*(.{3,80})$/i;
const HIRING_PHRASE =
  /\b(?:hiring|looking for|seeking|searching for)\s+(?:an?\s+)?((?:[A-Z][\w+#/.-]*\s+){0,5}[A-Z][\w+#/.-]*)/;

/** A labelled title ("Job title: …"), a title-like first line, or "hiring a …". */
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
