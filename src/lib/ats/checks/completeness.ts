import { EMAIL_RE } from "@/lib/parsing/text";

import { plural } from "../text-metrics";
import type { Check } from "../types";
import { notApplicable, pass, problem, sample } from "./helpers";

/** Completeness (weight 15): is the essential content there? — §18.4. */

const VALID_EMAIL = new RegExp(`^${EMAIL_RE.source}$`);

export const completenessChecks: Check[] = [
  {
    id: "C01",
    category: "completeness",
    title: "Email address",
    rule: "No email: −20. An email that isn't valid: −10.",
    maxDeduction: 20,
    severity: "critical",
    confidence: "high",
    fix: "Add a professional email address near the top of your resume.",
    run({ resume }) {
      const email = resume.contact.email;
      if (!email)
        return problem(
          20,
          "No email address was found. Recruiters and ATS systems need one to contact you.",
        );
      return VALID_EMAIL.test(email)
        ? pass("An email address was found.")
        : problem(10, "Your email address doesn't look valid.", [{ excerpt: email }]);
    },
  },
  {
    id: "C02",
    category: "completeness",
    title: "Phone number",
    rule: "No phone number: −15.",
    maxDeduction: 15,
    severity: "major",
    confidence: "high",
    fix: "Add a phone number with your country code, for example +44 7700 900123.",
    run({ resume }) {
      return resume.contact.phone
        ? pass("A phone number was found.")
        : problem(15, "No phone number was found.");
    },
  },
  {
    id: "C03",
    category: "completeness",
    title: "Location",
    rule: "No location: −5.",
    maxDeduction: 5,
    severity: "minor",
    confidence: "high",
    fix: "Add your city and country, such as “Berlin, Germany”. A full street address isn't needed.",
    run({ resume }) {
      return resume.contact.location
        ? pass("A location was found.")
        : problem(
            5,
            "No location was found. Many ATS searches filter candidates by location.",
          );
    },
  },
  {
    id: "C04",
    category: "completeness",
    title: "LinkedIn or portfolio link",
    rule: "No LinkedIn, GitHub or portfolio link: −5.",
    maxDeduction: 5,
    severity: "info",
    confidence: "high",
    fix: "Add your LinkedIn profile or a portfolio link to your contact details.",
    run({ resume }) {
      const professional = resume.contact.links.filter((l) => l.type !== "other");
      return professional.length > 0
        ? pass("A professional profile link was found.")
        : problem(5, "No LinkedIn, GitHub or portfolio link was found.");
    },
  },
  {
    id: "C05",
    category: "completeness",
    title: "Name",
    rule: "No name detected at the top: −10.",
    maxDeduction: 10,
    severity: "major",
    confidence: "medium",
    fix: "Put your full name on the first line, on its own.",
    run({ resume }) {
      return resume.contact.name
        ? pass("Your name was found at the top.")
        : problem(10, "Your name couldn't be found at the top of the resume.");
    },
  },
  {
    id: "C06",
    category: "completeness",
    title: "Summary",
    rule: "No summary or profile: −8.",
    maxDeduction: 8,
    severity: "minor",
    confidence: "high",
    fix: "Add a two- to three-sentence summary of who you are and what you're looking for.",
    strength: "A summary that introduces you",
    run({ resume }) {
      return resume.summary?.text.trim()
        ? pass("A summary was found.")
        : problem(8, "There's no summary or profile section.");
    },
  },
  {
    id: "C07",
    category: "completeness",
    title: "Experience or projects",
    rule: "No experience and no projects: −30.",
    maxDeduction: 30,
    severity: "critical",
    confidence: "high",
    fix: "Add an Experience section. If you're starting out, add a Projects section with what you built.",
    run({ resume }) {
      return resume.experience.length > 0 || resume.projects.length > 0
        ? pass("Experience or projects were found.")
        : problem(30, "No work experience or projects were found.");
    },
  },
  {
    id: "C08",
    category: "completeness",
    title: "Education",
    rule: "No education: −12.",
    maxDeduction: 12,
    severity: "major",
    confidence: "high",
    fix: "Add an Education section with your highest qualification.",
    run({ resume }) {
      return resume.education.length > 0
        ? pass("Education was found.")
        : problem(
            12,
            "No education was found. Many ATS filters check for a qualification.",
          );
    },
  },
  {
    id: "C09",
    category: "completeness",
    title: "Skills section",
    rule: "No skills section: −12.",
    maxDeduction: 12,
    severity: "major",
    confidence: "high",
    fix: "Add a Skills section listing your main tools and technologies.",
    run({ resume }) {
      return resume.sections.some((s) => s.kind === "skills")
        ? pass("A skills section was found.")
        : problem(12, "There's no skills section.");
    },
  },
  {
    id: "C10",
    category: "completeness",
    title: "Roles with little detail",
    rule: "Any role with fewer than 2 bullets: −8.",
    maxDeduction: 8,
    severity: "minor",
    confidence: "high",
    fix: "Give each role at least two bullet points describing what you achieved.",
    run({ resume }) {
      if (resume.experience.length === 0) return notApplicable("No experience entries.");
      const thin = resume.experience.filter((e) => e.bullets.length < 2);
      return thin.length === 0
        ? pass("Every role has at least two bullet points.")
        : problem(
            8,
            `${plural(thin.length, "role")} ${thin.length === 1 ? "has" : "have"} fewer than two bullet points.`,
            sample(thin).map((e) => ({
              location: `Experience › ${e.company ?? e.title ?? "Role"}`,
              count: e.bullets.length,
            })),
          );
    },
  },
  {
    id: "C11",
    category: "completeness",
    title: "Most recent role has no description",
    rule: "The most recent role has no description: −6.",
    maxDeduction: 6,
    severity: "minor",
    confidence: "high",
    fix: "Describe your most recent role. It's the one recruiters read first.",
    run({ resume }) {
      const latest = resume.experience[0];
      if (!latest) return notApplicable("No experience entries.");
      // Body lines after the role's header become items, whether bulleted or a paragraph.
      return latest.bullets.length > 0
        ? pass("Your most recent role is described.")
        : problem(6, "Your most recent role has no description.", [
            { location: `Experience › ${latest.company ?? latest.title ?? "Role"}` },
          ]);
    },
  },
];
