import { matchDegree } from "@/lib/taxonomy";

import { displayText, stripBullet } from "../text";
import type { EducationEntry, Line } from "../types";
import { findDateRange, findDates } from "./dates";

const INSTITUTION_RE =
  /\b(university|universität|université|universidad|college|institute|institution|school|academy|polytechnic|conservatory)\b/i;

/**
 * Education entries. A new entry starts when a line brings a degree or an institution the
 * current entry already has.
 */
export function parseEducation(lines: Line[]): EducationEntry[] {
  const groups: Line[][] = [];
  let current: Line[] = [];
  let hasDegree = false;
  let hasInstitution = false;

  for (const line of lines) {
    const degree = matchDegree(line.text) !== null;
    const institution = INSTITUTION_RE.test(line.text);
    if ((degree && hasDegree) || (institution && hasInstitution && !degree)) {
      groups.push(current);
      current = [];
      hasDegree = false;
      hasInstitution = false;
    }
    current.push(line);
    hasDegree ||= degree;
    hasInstitution ||= institution;
  }
  if (current.length) groups.push(current);

  return groups
    .filter((g) => g.some((l) => matchDegree(l.text) || INSTITUTION_RE.test(l.text)))
    .map(buildEntry);
}

function buildEntry(lines: Line[]): EducationEntry {
  const texts = lines.map((l) => displayText(stripBullet(l.text)));
  const degreeLine = texts.find((t) => matchDegree(t));
  const degreeMatch = degreeLine ? matchDegree(degreeLine) : null;
  const institutionLine = texts.find((t) => INSTITUTION_RE.test(t));

  const range = texts.map((t) => findDateRange(t)).find(Boolean) ?? null;
  const singles = range ? [] : texts.flatMap((t) => findDates(t));
  const end = range?.end ?? singles.at(-1)?.date;
  const start = range?.start ?? (singles.length > 1 ? singles[0]!.date : undefined);

  /** Splits a line into parts on commas, dashes, pipes and column gaps, without dates. */
  const parts = (text: string) =>
    text
      .replace(range?.raw ?? "\u0000", "")
      .replace(/\b(?:expected|anticipated|graduated)\b/gi, "")
      .replace(
        /\b(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+)?(?:19|20)\d{2}\b/gi,
        "",
      )
      .split(/\s*(?:,|\||\t|\s{2,}|\s[–—-]\s)\s*/)
      .map((s) => s.replace(/^[\s()–—-]+|[\s()–—-]+$/g, "").trim())
      .filter(Boolean);

  let degree: string | undefined;
  let field: string | undefined;
  let institution: string | undefined;

  if (degreeLine && degreeMatch) {
    const lineParts = parts(degreeLine);
    const degreeIndex = lineParts.findIndex((p) => matchDegree(p));
    degree = lineParts[degreeIndex] ?? lineParts[0];
    // "Bachelor of Science in Computer Science" → after the last " in ".
    const inIndex = degree?.toLowerCase().lastIndexOf(" in ") ?? -1;
    if (degree && inIndex !== -1) {
      field = degree.slice(inIndex + 4).trim();
    } else if (degree) {
      // "B.S. Computer Engineering" → what follows the degree term.
      const term = matchDegree(degree)?.term ?? "";
      const after = degree
        .slice(degree.indexOf(term) + term.length)
        .replace(/^[\s.,]*(?:of\s+)?/i, "");
      if (after && !/^(?:arts|science|engineering)$/i.test(after)) field = after.trim();
    }
    // "MBA, Marketing — New York University": the next part that isn't the institution.
    const next = lineParts.slice(degreeIndex + 1).find((p) => !INSTITUTION_RE.test(p));
    field ||= next;
    institution = lineParts.find((p) => INSTITUTION_RE.test(p));
  }

  if (!institution && institutionLine) {
    institution = parts(institutionLine).find((p) => INSTITUTION_RE.test(p));
  }

  return {
    degree,
    level: degreeMatch?.level,
    field,
    institution,
    start,
    end,
    rawText: texts.join("\n"),
  };
}
