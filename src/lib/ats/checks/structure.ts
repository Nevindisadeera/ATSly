import type { ExperienceEntry, SectionKind } from "@/lib/parsing/types";

import { plural } from "../text-metrics";
import type { Check } from "../types";
import { notApplicable, pass, problem, sample } from "./helpers";

/** Structure (weight 20): can sections and entries be recognized? — §18.4. */

const IGNORED: SectionKind[] = ["contact", "other"];

function entryLabel(entry: ExperienceEntry, index: number): string {
  return `Experience › ${entry.company ?? entry.title ?? `Entry ${index + 1}`}`;
}

function monthIndex(
  date: ExperienceEntry["start"] | "present" | undefined,
  now: number,
): number | null {
  if (!date) return null;
  if (date === "present") return now;
  return date.year * 12 + (date.month ?? 1);
}

export const structureChecks: Check[] = [
  {
    id: "S01",
    category: "structure",
    title: "Non-standard section headings",
    rule: "−10 for each recognized section with a non-standard heading, up to −30.",
    maxDeduction: 30,
    severity: "major",
    confidence: "high",
    fix: "Use standard headings such as Experience, Education, Skills and Summary.",
    strength: "Standard section headings that ATS systems recognize",
    run({ resume }) {
      const unusual = resume.sections.filter(
        (s) => s.heading && !s.headingIsStandard && !IGNORED.includes(s.kind),
      );
      if (unusual.length === 0) return pass("Section headings are standard.");
      return problem(
        Math.min(30, unusual.length * 10),
        `${plural(unusual.length, "heading")} ${unusual.length === 1 ? "isn't" : "aren't"} standard. ATS systems may not recognize what ${unusual.length === 1 ? "that section contains" : "those sections contain"}.`,
        sample(unusual, 3).map((s) => ({
          excerpt: s.heading,
          location: `Looks like ${s.kind}`,
        })),
      );
    },
  },
  {
    id: "S02",
    category: "structure",
    title: "Content without a heading",
    rule: "More than 60 words above the first heading: −15.",
    maxDeduction: 30,
    severity: "major",
    confidence: "medium",
    fix: "Add a heading above every block of content, such as Summary for an opening paragraph.",
    run({ resume }) {
      const top = resume.sections.find((s) => s.kind === "contact" && !s.heading);
      if (!top || top.wordCount === undefined)
        return notApplicable("No content above the first heading.");
      // A contact block is short; a long one usually holds an unlabelled summary or more.
      return top.wordCount <= 60
        ? pass("All content sits under a heading.")
        : problem(
            15,
            "There's a block of text above your first heading that isn't contact details. ATS systems may not know which section it belongs to.",
            [{ count: top.wordCount, location: "Top of the resume" }],
          );
    },
  },
  {
    id: "S03",
    category: "structure",
    title: "Section order",
    rule: "Education before Experience with more than 3 years of experience: −5.",
    maxDeduction: 5,
    severity: "minor",
    confidence: "high",
    fix: "With several years of experience, put Experience before Education.",
    run({ resume }) {
      const order = resume.sections.map((s) => s.kind);
      const exp = order.indexOf("experience");
      const edu = order.indexOf("education");
      if (exp === -1 || edu === -1)
        return notApplicable("Needs both Experience and Education sections.");
      const months = resume.stats.totalExperienceMonths ?? 0;
      if (edu > exp || months <= 36) return pass("Sections are in a conventional order.");
      return problem(
        5,
        "Education comes before Experience even though you have more than three years of experience. Recruiters expect your experience first.",
      );
    },
  },
  {
    id: "S04",
    category: "structure",
    title: "Roles without dates",
    rule: "Any role without dates: −15.",
    maxDeduction: 15,
    severity: "major",
    confidence: "high",
    fix: "Add start and end dates to every role, for example “Jan 2021 – Present”.",
    strength: "Every role has dates",
    run({ resume }) {
      if (resume.experience.length === 0) return notApplicable("No experience entries.");
      const missing = resume.experience
        .map((e, i) => ({ e, i }))
        .filter(({ e }) => !e.start);
      return missing.length === 0
        ? pass("Every role has dates.")
        : problem(
            15,
            `${plural(missing.length, "role")} ${missing.length === 1 ? "has" : "have"} no dates. ATS systems use dates to calculate your years of experience.`,
            sample(missing).map(({ e, i }) => ({ location: entryLabel(e, i) })),
          );
    },
  },
  {
    id: "S05",
    category: "structure",
    title: "Roles missing a title or company",
    rule: "Any role without a clear title or company: −10.",
    maxDeduction: 10,
    severity: "major",
    confidence: "medium",
    fix: "Give every role a job title and a company name on its own line or separated by a comma.",
    run({ resume }) {
      if (resume.experience.length === 0) return notApplicable("No experience entries.");
      const incomplete = resume.experience
        .map((e, i) => ({ e, i }))
        .filter(({ e }) => !e.title || !e.company);
      return incomplete.length === 0
        ? pass("Every role has a title and a company.")
        : problem(
            10,
            `${plural(incomplete.length, "role")} ${incomplete.length === 1 ? "is" : "are"} missing a clear job title or company.`,
            sample(incomplete).map(({ e, i }) => ({
              excerpt: e.rawText.split("\n")[0],
              location: entryLabel(e, i),
            })),
          );
    },
  },
  {
    id: "S06",
    category: "structure",
    title: "Mixed date formats",
    rule: "Dates written in more than one format: −6.",
    maxDeduction: 6,
    severity: "minor",
    confidence: "high",
    fix: "Write every date the same way, for example “Mar 2021”.",
    run({ resume }) {
      const formats = new Set(resume.experience.flatMap((e) => e.dateFormats));
      if (formats.size === 0) return notApplicable("No dates found.");
      return formats.size === 1
        ? pass("Dates use one consistent format.")
        : problem(
            6,
            `Dates are written in ${formats.size} different formats. Consistent dates parse more reliably.`,
            resume.experience
              .filter((e) => e.dateText)
              .slice(0, 3)
              .map((e) => ({ excerpt: e.dateText })),
          );
    },
  },
  {
    id: "S07",
    category: "structure",
    title: "Roles not in reverse-chronological order",
    rule: "Dated roles not listed most recent first: −6. Needs two dated roles.",
    maxDeduction: 6,
    severity: "minor",
    confidence: "high",
    fix: "List your most recent role first.",
    run({ resume }) {
      const now = 10_000 * 12;
      const starts = resume.experience
        .map((e) => monthIndex(e.end, now) ?? monthIndex(e.start, now))
        .filter((m): m is number => m !== null);
      if (starts.length < 2) return notApplicable("Needs at least two dated roles.");
      const ordered = starts.every((m, i) => i === 0 || m <= starts[i - 1]!);
      return ordered
        ? pass("Roles are listed most recent first.")
        : problem(
            6,
            "Your roles aren't listed with the most recent first, which is what ATS systems and recruiters expect.",
          );
    },
  },
  {
    id: "S08",
    category: "structure",
    title: "Resume length",
    rule: "More than 3 pages: −20. More than 2 pages with under 10 years of experience: −10. Under 250 words: −15.",
    maxDeduction: 20,
    severity: "major",
    confidence: "high",
    // One fix for both directions: S08 fails for resumes that are too long or too short.
    fix: "Keep it to one or two pages (three only with over ten years of experience), with at least 250 words so ATS systems have enough to match.",
    strength: "A sensible length for your experience",
    run({ resume }) {
      const { pageCount, wordCount, totalExperienceMonths } = resume.stats;
      const years = (totalExperienceMonths ?? 0) / 12;
      if (pageCount > 3) {
        return problem(
          20,
          `Your resume is ${pageCount} pages. Most recruiters expect no more than two.`,
          [{ count: pageCount }],
        );
      }
      if (pageCount > 2 && years < 10) {
        return problem(
          10,
          `Your resume is ${pageCount} pages with under ten years of experience. Two pages is usually enough.`,
          [{ count: pageCount }],
        );
      }
      if (wordCount < 250) {
        return problem(
          15,
          `Your resume has only ${wordCount} words. It may not give ATS systems enough to match against.`,
          [{ count: wordCount }],
        );
      }
      return pass("The length suits your experience.");
    },
  },
  {
    id: "S09",
    category: "structure",
    title: "Headings that don't stand out",
    rule: "Any heading that looks like body text: −8.",
    maxDeduction: 8,
    severity: "minor",
    confidence: "medium",
    fix: "Make headings bold, larger or in capitals so both ATS parsers and readers can find sections.",
    run({ resume }) {
      const headed = resume.sections.filter(
        (s) => s.heading && s.headingEmphasis !== undefined,
      );
      if (headed.length === 0) return notApplicable("No headings to assess.");
      const plain = headed.filter((s) => !s.headingEmphasis);
      return plain.length === 0
        ? pass("Headings stand out from the body text.")
        : problem(
            8,
            `${plural(plain.length, "heading")} ${plain.length === 1 ? "looks" : "look"} the same as body text.`,
            sample(plain).map((s) => ({ excerpt: s.heading })),
          );
    },
  },
  {
    id: "S10",
    category: "structure",
    title: "Repeated sections",
    rule: "The same kind of section appears more than once: −6.",
    maxDeduction: 6,
    severity: "minor",
    confidence: "medium",
    fix: "Combine sections of the same kind under one heading.",
    run({ resume }) {
      const counts = new Map<SectionKind, number>();
      for (const s of resume.sections) {
        if (IGNORED.includes(s.kind)) continue;
        counts.set(s.kind, (counts.get(s.kind) ?? 0) + 1);
      }
      const repeated = [...counts.entries()].filter(([, n]) => n > 1);
      return repeated.length === 0
        ? pass("Each kind of section appears once.")
        : problem(
            6,
            `Some content is split across several sections of the same kind (${repeated.map(([k]) => k).join(", ")}).`,
            repeated.map(([kind, count]) => ({ location: kind, count })),
          );
    },
  },
];
