import { ACRONYMS, findSkillsInText } from "@/lib/taxonomy";
import type { ParsedResume } from "@/lib/parsing/types";

import { buzzwordCount, countTerm, percent, plural, wordsOf } from "../text-metrics";
import type { Check } from "../types";
import { englishOnly, notApplicable, pass, problem, sample } from "./helpers";

/**
 * Keywords & skills (weight 15): job-independent keyword hygiene — §18.4.
 * Role-specific keyword coverage belongs to job matching (Phase 9a), not this score.
 */

/** Text where skills are shown in use: experience and project entries. */
function workText(resume: ParsedResume): string {
  return [
    ...resume.experience.map((e) => e.rawText),
    ...resume.projects.map((p) => p.rawText),
  ].join("\n");
}

/** Hard skills listed in the skills section and recognized by the taxonomy. */
function listedHardSkills(resume: ParsedResume) {
  return resume.skills.filter((s) => s.taxonomyId && s.kind !== "soft");
}

function expansionPresent(lowerText: string, expansion: string): boolean {
  return lowerText.includes(expansion.toLowerCase().replace(/-/g, " "));
}

export const keywordChecks: Check[] = [
  {
    id: "K01",
    category: "keywords",
    title: "Dedicated skills section",
    rule: "No skills section: −25.",
    maxDeduction: 25,
    severity: "major",
    confidence: "high",
    fix: "Add a section headed “Skills” that lists your tools, technologies and methods.",
    strength: "A dedicated skills section ATS systems can read",
    run({ resume }) {
      return resume.sections.some((s) => s.kind === "skills")
        ? pass("A dedicated skills section was found.")
        : problem(
            25,
            "There's no skills section. ATS keyword searches rely heavily on it.",
          );
    },
  },
  {
    id: "K02",
    category: "keywords",
    title: "Recognized hard skills",
    rule: "Recognized hard skills across the resume: 10 or more → 0, 6–9 → −8, 3–5 → −16, fewer than 3 → −25.",
    maxDeduction: 25,
    severity: "major",
    confidence: "high",
    fix: "List the specific tools, technologies and methods you use, by their standard names.",
    strength: "A broad set of recognized skills",
    run({ resume }) {
      const ids = new Map<string, string>();
      for (const s of listedHardSkills(resume)) ids.set(s.taxonomyId!, s.raw);
      for (const s of findSkillsInText(workText(resume))) {
        if (s.kind !== "soft" && !ids.has(s.id)) ids.set(s.id, s.name);
      }
      const count = ids.size;
      const evidence = [{ count }];
      if (count >= 10) return pass(`${count} recognized skills were found.`);
      const deduction = count >= 6 ? 8 : count >= 3 ? 16 : 25;
      return problem(
        deduction,
        `Only ${plural(count, "recognized skill")} ${count === 1 ? "was" : "were"} found. ATS searches match on specific skill names.`,
        evidence,
      );
    },
  },
  {
    id: "K03",
    category: "keywords",
    title: "Skills backed by experience",
    rule: "Listed hard skills that also appear in experience or projects: 60% or more → 0, 30–59% → −10, under 30% → −20. Needs 3 listed skills.",
    maxDeduction: 20,
    severity: "major",
    confidence: "high",
    fix: "Mention your key skills in your experience or projects too, showing where you used them.",
    strength: "Listed skills are backed up by your experience",
    run({ resume }) {
      const listed = listedHardSkills(resume);
      if (listed.length < 3)
        return notApplicable(
          "Needs at least three recognized skills in a skills section.",
        );
      const used = new Set(findSkillsInText(workText(resume)).map((s) => s.id));
      const unbacked = listed.filter((s) => !used.has(s.taxonomyId!));
      const share = percent(listed.length - unbacked.length, listed.length);
      if (share >= 60)
        return pass(
          `${share}% of your listed skills also appear in your experience or projects.`,
        );
      return problem(
        share >= 30 ? 10 : 20,
        `Only ${share}% of your listed skills appear in your experience or projects. Skills shown in context rank higher with ATS systems and recruiters.`,
        sample(unbacked, 5).map((s) => ({ excerpt: s.raw, location: "Skills" })),
      );
    },
  },
  {
    id: "K04",
    category: "keywords",
    title: "Acronyms and their full forms",
    rule: "A common acronym without its full form, or the reverse: −5. English only.",
    maxDeduction: 5,
    severity: "info",
    confidence: "high",
    fix: "Write both forms once, such as “Search engine optimization (SEO)”, so searches for either one match.",
    run({ text, resume }) {
      const skip = englishOnly(resume);
      if (skip) return skip;
      const lower = text.toLowerCase().replace(/-/g, " ");
      const mismatched: { term: string; missing: string }[] = [];
      for (const [acronym, expansion] of Object.entries(ACRONYMS)) {
        const hasAcronym = countTerm(text, acronym) > 0;
        const hasExpansion = expansionPresent(lower, expansion);
        if (hasAcronym && !hasExpansion)
          mismatched.push({ term: acronym, missing: expansion });
        else if (hasExpansion && !hasAcronym)
          mismatched.push({ term: expansion, missing: acronym });
      }
      if (mismatched.length === 0)
        return pass("Acronyms and full forms are used together.");
      return problem(
        5,
        `${plural(mismatched.length, "term")} ${mismatched.length === 1 ? "appears" : "appear"} in only one form. A recruiter may search for the other.`,
        sample(mismatched).map((m) => ({
          excerpt: m.term,
          location: `Also add “${m.missing}”`,
        })),
      );
    },
  },
  {
    id: "K05",
    category: "keywords",
    title: "Keyword stuffing",
    rule: "More than 40 skills listed, or one skill repeated more than 8 times: −8.",
    maxDeduction: 8,
    severity: "minor",
    confidence: "high",
    fix: "Keep your skills list to what you'd discuss in an interview, and mention each skill naturally.",
    run({ resume, text }) {
      if (resume.skills.length > 40) {
        return problem(
          8,
          `${resume.skills.length} skills are listed. Very long lists can look like keyword stuffing to ATS systems and recruiters.`,
          [{ count: resume.skills.length, location: "Skills" }],
        );
      }
      const repeated = resume.skills
        .map((s) => ({ term: s.raw, count: countTerm(text, s.raw) }))
        .filter((r) => r.count > 8);
      return repeated.length === 0
        ? pass("Skills are listed and repeated in moderation.")
        : problem(
            8,
            `${repeated.map((r) => `“${r.term}”`).join(", ")} ${repeated.length === 1 ? "is" : "are"} repeated more than eight times, which can look like keyword stuffing.`,
            sample(repeated).map((r) => ({ excerpt: r.term, count: r.count })),
          );
    },
  },
  {
    id: "K06",
    category: "keywords",
    title: "Mostly soft skills",
    rule: "More than half of the recognized listed skills are soft skills: −10. Needs 4 recognized skills.",
    maxDeduction: 10,
    severity: "minor",
    confidence: "high",
    fix: "List concrete tools and methods in your skills section, and show soft skills through your achievements.",
    run({ resume }) {
      const recognized = resume.skills.filter((s) => s.taxonomyId);
      if (recognized.length < 4)
        return notApplicable("Needs at least four recognized skills.");
      const soft = recognized.filter((s) => s.kind === "soft");
      return soft.length / recognized.length <= 0.5
        ? pass("Your skills section focuses on concrete skills.")
        : problem(
            10,
            `${percent(soft.length, recognized.length)}% of your recognized skills are soft skills, which ATS systems rarely search for.`,
            sample(soft, 5).map((s) => ({ excerpt: s.raw, location: "Skills" })),
          );
    },
  },
  {
    id: "K07",
    category: "keywords",
    title: "Buzzwords",
    rule: "Buzzwords above 2% of all words: −7. English only.",
    maxDeduction: 7,
    severity: "minor",
    confidence: "high",
    fix: "Replace clichés like “results-driven” with specific achievements that show the quality.",
    run({ text, resume }) {
      const skip = englishOnly(resume);
      if (skip) return skip;
      const total = wordsOf(text).length;
      if (total < 50) return notApplicable("Not enough text to measure.");
      const { count, found } = buzzwordCount(text);
      return count / total <= 0.02
        ? pass("Little or no buzzword language.")
        : problem(
            7,
            `Buzzwords make up about ${percent(count, total)}% of your text. They take space without telling a recruiter anything specific.`,
            sample(found, 5).map((excerpt) => ({ excerpt })),
          );
    },
  },
];
