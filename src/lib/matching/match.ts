import type { ParsedResume } from "@/lib/parsing/types";
import {
  CERTIFICATIONS,
  findCertificationsInText,
  findSkillsInText,
  lookupSkill,
} from "@/lib/taxonomy";

import type { Importance, MatchedTerm, TermKind } from "./types";

/**
 * Matching tiers — docs/PLANNING.md §19.1. Per requirement, the first hit wins:
 * 1. exact: the requirement's words appear in the resume;
 * 2. normalized: a taxonomy alias of it does (JS ≡ JavaScript, React.js ≡ React).
 * The semantic tier (AI with verified evidence) is added in Phase 10a.
 */

export type ResumeEntry = { text: string; location: string };

const MAX_EVIDENCE = 200;

/**
 * The resume as located text. Experience and projects come first so evidence prefers a
 * skill shown in use over a skill only listed.
 */
export function resumeEntries(resume: ParsedResume): ResumeEntry[] {
  const entries: ResumeEntry[] = [];
  resume.experience.forEach((e, i) => {
    const where = `Experience › ${e.company ?? e.title ?? `Role ${i + 1}`}`;
    e.bullets.forEach((text, b) =>
      entries.push({ text, location: `${where} › bullet ${b + 1}` }),
    );
    const header = [e.title, e.company].filter(Boolean).join(", ");
    if (header) entries.push({ text: header, location: where });
  });
  resume.projects.forEach((p, i) => {
    const where = `Projects › ${p.name ?? `Project ${i + 1}`}`;
    p.bullets.forEach((text, b) =>
      entries.push({ text, location: `${where} › bullet ${b + 1}` }),
    );
    const header = [p.name, p.technologies.join(", ")].filter(Boolean).join(": ");
    if (header) entries.push({ text: header, location: where });
  });
  if (resume.summary?.text)
    entries.push({ text: resume.summary.text, location: "Summary" });
  for (const skill of resume.skills)
    entries.push({ text: skill.raw, location: "Skills" });
  for (const education of resume.education) {
    entries.push({ text: education.rawText.replace(/\n/g, ", "), location: "Education" });
  }
  for (const certification of resume.certifications) {
    const text = [certification.name, certification.issuer].filter(Boolean).join(", ");
    entries.push({ text, location: "Certifications" });
  }
  return entries;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Whole-word pattern for a requirement. Short names ("Go", "R", "SQL") match their exact
 * casing only, so ordinary words don't count.
 */
export function termPattern(term: string): RegExp {
  const flags = term.length >= 4 ? "iu" : "u";
  return new RegExp(
    `(?<![\\p{L}\\p{N}])${escapeRegExp(term)}(?![\\p{L}\\p{N}+#])`,
    flags,
  );
}

function evidence(entry: ResumeEntry): Pick<MatchedTerm, "evidence" | "location"> {
  const text =
    entry.text.length > MAX_EVIDENCE
      ? `${entry.text.slice(0, MAX_EVIDENCE - 1).trimEnd()}…`
      : entry.text;
  return { evidence: text, location: entry.location };
}

export type Requirement = { term: string; kind: TermKind; importance: Importance };

/** Precomputed lookups so each requirement is matched without rescanning the resume. */
export function createMatcher(resume: ParsedResume) {
  const entries = resumeEntries(resume);
  const skillsByEntry = entries.map(
    (entry) => new Set(findSkillsInText(entry.text).map((s) => s.id)),
  );
  const certificationsByEntry = entries.map(
    (entry) => new Set(findCertificationsInText(entry.text).map((c) => c.id)),
  );
  // Skills-list items are matched by the parser's own lookup, which knows list-only aliases.
  const listed = new Map(
    resume.skills.filter((s) => s.taxonomyId).map((s) => [s.taxonomyId!, s.raw]),
  );

  function exact(term: string): ResumeEntry | undefined {
    const pattern = termPattern(term);
    return entries.find((entry) => pattern.test(entry.text));
  }

  return {
    match(requirement: Requirement): MatchedTerm | null {
      const base = {
        term: requirement.term,
        kind: requirement.kind,
        importance: requirement.importance,
      };
      const literal = exact(requirement.term);
      if (literal) return { ...base, matchType: "exact", ...evidence(literal) };

      if (requirement.kind === "certification") {
        const certification = CERTIFICATIONS.find(
          (c) => c.name.toLowerCase() === requirement.term.toLowerCase(),
        );
        const index = certification
          ? certificationsByEntry.findIndex((ids) => ids.has(certification.id))
          : -1;
        return index === -1
          ? null
          : { ...base, matchType: "normalized", ...evidence(entries[index]!) };
      }

      const skill = lookupSkill(requirement.term);
      if (!skill) return null;
      const index = skillsByEntry.findIndex((ids) => ids.has(skill.id));
      if (index !== -1)
        return { ...base, matchType: "normalized", ...evidence(entries[index]!) };
      const raw = listed.get(skill.id);
      return raw
        ? { ...base, matchType: "normalized", evidence: raw, location: "Skills" }
        : null;
    },
  };
}
