import { CHECKS, runAtsEngine, type CheckResult } from "@/lib/ats";
import {
  PARSER_VERSION,
  type DocFormat,
  type ExperienceEntry,
  type LayoutProbe,
  type ParsedResume,
  type ParsedSkill,
} from "@/lib/parsing";
import { lookupSkill } from "@/lib/taxonomy";

/**
 * A clean resume that passes every ATS check, for tests to break one thing at a time.
 * Q07 is the exception: it is not applicable until an AI rating is supplied.
 */

export type Draft = {
  parsed: ParsedResume;
  layout: LayoutProbe;
  format: DocFormat;
  text: string;
  ai?: { contentQuality: number };
};

/** A skills-list entry as the parser would produce it. */
export function skill(raw: string): ParsedSkill {
  const known = lookupSkill(raw);
  return {
    raw,
    normalized: raw.toLowerCase(),
    taxonomyId: known?.id,
    category: known?.category,
    kind: known?.kind,
  };
}

export function role(overrides: Partial<ExperienceEntry> = {}): ExperienceEntry {
  const entry: ExperienceEntry = {
    title: "Senior Backend Engineer",
    company: "Northwind Payments",
    start: { year: 2021, month: 3 },
    end: "present",
    dateText: "Mar 2021 – Present",
    dateFormats: ["mon-yyyy"],
    bullets: [],
    rawText: "",
    confidence: 1,
    ...overrides,
  };
  if (!overrides.rawText) {
    entry.rawText = [
      `${entry.title ?? ""} ${entry.dateText ?? ""}`.trim(),
      entry.company ?? "",
      ...entry.bullets,
    ].join("\n");
  }
  return entry;
}

const SUMMARY =
  "Backend engineer with eight years of experience building reliable payment and data platforms. Focused on performance, cost and developer productivity.";

const LATEST_BULLETS = [
  "Led a team of 6 engineers to rebuild the checkout service, cutting latency by 40%",
  "Built a Python data pipeline on AWS that processes 2 million events per day",
  "Reduced cloud costs by $120,000 a year by right-sizing Kubernetes clusters with Terraform",
];

const EARLIER_BULLETS = [
  "Designed TypeScript services on Node.js that 30 partner teams rely on daily",
  "Automated release testing with Jenkins, shortening the release cycle from 2 weeks to 3 days",
];

const SKILLS = [
  "Python",
  "TypeScript",
  "Node.js",
  "AWS",
  "Kubernetes",
  "Terraform",
  "Jenkins",
  "PostgreSQL",
  "Docker",
  "React",
  "GraphQL",
];

export function cleanResume(): ParsedResume {
  const experience = [
    role({ bullets: LATEST_BULLETS }),
    role({
      title: "Software Engineer",
      company: "Contoso Retail",
      start: { year: 2017, month: 1 },
      end: { year: 2021, month: 2 },
      dateText: "Jan 2017 – Feb 2021",
      bullets: EARLIER_BULLETS,
    }),
  ];
  return {
    contact: {
      name: "Jordan Rivera",
      email: "jordan.rivera@example.com",
      phone: "+1 415 555 0134",
      location: "San Francisco, CA",
      links: [{ type: "linkedin", url: "https://linkedin.com/in/jordanrivera" }],
      inHeaderOrFooter: false,
    },
    summary: { text: SUMMARY },
    skills: SKILLS.map(skill),
    experience,
    education: [
      {
        degree: "BSc Computer Science",
        level: "bachelor",
        field: "Computer Science",
        institution: "University of Leeds",
        start: { year: 2013 },
        end: { year: 2016 },
        rawText: "BSc Computer Science\nUniversity of Leeds 2013 – 2016",
      },
    ],
    projects: [],
    certifications: [],
    languages: [],
    sections: [
      {
        kind: "contact",
        headingIsStandard: true,
        headingEmphasis: false,
        wordCount: 12,
        startLine: 0,
        endLine: 2,
        confidence: 1,
      },
      {
        kind: "summary",
        heading: "Summary",
        headingIsStandard: true,
        headingEmphasis: true,
        wordCount: 22,
        startLine: 2,
        endLine: 4,
        confidence: 1,
      },
      {
        kind: "experience",
        heading: "Experience",
        headingIsStandard: true,
        headingEmphasis: true,
        wordCount: 120,
        startLine: 4,
        endLine: 15,
        confidence: 1,
      },
      {
        kind: "skills",
        heading: "Skills",
        headingIsStandard: true,
        headingEmphasis: true,
        wordCount: 14,
        startLine: 15,
        endLine: 17,
        confidence: 1,
      },
      {
        kind: "education",
        heading: "Education",
        headingIsStandard: true,
        headingEmphasis: true,
        wordCount: 8,
        startLine: 17,
        endLine: 20,
        confidence: 1,
      },
    ],
    stats: {
      wordCount: 420,
      bulletCount: 5,
      pageCount: 1,
      totalExperienceMonths: 116,
      wordsPerPage: 420,
    },
    meta: { language: "en", parserVersion: PARSER_VERSION },
  };
}

export function cleanLayout(): LayoutProbe {
  return {
    columns: { detected: false, confidence: "high", pages: [] },
    tables: { count: 0, confidence: "high" },
    textBoxes: { count: 0 },
    images: { count: 0, imageOnlyPages: [] },
    headerFooter: {
      applicable: true,
      text: [],
      containsContact: false,
      confidence: "high",
    },
    encoding: { replacementRatio: 0 },
    fonts: ["Calibri"],
    bulletGlyphs: ["•"],
    links: [
      {
        text: "linkedin.com/in/jordanrivera",
        url: "https://linkedin.com/in/jordanrivera",
        hidden: false,
      },
    ],
  };
}

/** Body text as the parser would store it, rebuilt from the parsed resume. */
export function textOf(resume: ParsedResume): string {
  const c = resume.contact;
  return [
    c.name,
    [c.email, c.phone, c.location].filter(Boolean).join(" | "),
    "Summary",
    resume.summary?.text,
    "Experience",
    ...resume.experience.map((e) => e.rawText),
    ...resume.projects.map((p) => p.rawText),
    "Skills",
    resume.skills.map((s) => s.raw).join(", "),
    "Education",
    ...resume.education.map((e) => e.rawText),
  ]
    .filter(Boolean)
    .join("\n");
}

export function draft(): Draft {
  const parsed = cleanResume();
  return { parsed, layout: cleanLayout(), format: "docx", text: textOf(parsed) };
}

/**
 * Runs one check on the clean resume after `change` breaks something. When the change
 * edits the parsed resume but not the text, the text is rebuilt to match.
 */
export function evaluate(id: string, change?: (d: Draft) => void): CheckResult {
  const check = CHECKS.find((c) => c.id === id);
  if (!check) throw new Error(`Unknown check ${id}`);
  const d = draft();
  const originalText = d.text;
  change?.(d);
  if (d.text === originalText) d.text = textOf(d.parsed);
  const report = runAtsEngine(
    { parsed: d.parsed, layout: d.layout, format: d.format, text: d.text },
    { ai: d.ai, checks: [check] },
  );
  return report.categories.flatMap((c) => c.checks)[0]!;
}

/** Replaces all bullets with `bullets`, in one role. */
export function setBullets(d: Draft, bullets: string[]): void {
  d.parsed.experience = [role({ bullets })];
}
