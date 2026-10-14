import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { ParseFailureCode, SectionKind } from "@/lib/parsing";

import { buildDocx, type Block } from "../../support/docx-builder";

/**
 * Resume fixtures with expected parser output. PDFs are rendered from ./src by
 * scripts/fixtures/build-resume-pdfs.mjs; DOCX files are built here in code.
 */

export type FixtureExpectation = {
  /** Section kinds (excluding contact) that should be found, in any order. */
  sections?: SectionKind[];
  name?: string;
  email?: string;
  phone?: boolean;
  experienceEntries?: number;
  educationEntries?: number;
  /** At least this many recognized skills. */
  minSkills?: number;
  pageCount?: number;
  columns?: boolean;
  tables?: boolean;
  textBoxes?: boolean;
  contactInHeaderOrFooter?: boolean;
  language?: "en" | "other";
  /** Substrings expected among warnings. */
  warnings?: string[];
  /** The fixture should fail with this code. */
  error?: ParseFailureCode;
  /** Exclude from section-detection accuracy (e.g. non-English). */
  excludeFromAccuracy?: boolean;
};

export type Fixture = {
  name: string;
  format: "pdf" | "docx";
  load: () => Buffer;
  expect: FixtureExpectation;
};

const dir = join(process.cwd(), "tests/fixtures/resumes");
const pdf = (file: string) => () => readFileSync(join(dir, file));

const h = (text: string): Block => ({ text, style: "Heading1" });
const b = (text: string): Block => ({ text, bullet: true });
const p = (text: string, extra: Partial<Block> = {}): Block =>
  ({ text, ...extra }) as Block;
const role = (title: string, dates: string): Block => ({
  runs: [{ text: title, bold: true }, { text: "", tab: true }, { text: dates }],
});

const tablesDocx = () =>
  buildDocx({
    pages: 1,
    blocks: [
      { text: "Marcus Lee", style: "Title" },
      p("marcus.lee@example.com | +1 206 555 0110 | Seattle, WA"),
      h("Summary"),
      p(
        "Data analyst with four years of experience turning operational data into dashboards and forecasts for logistics teams.",
      ),
      h("Experience"),
      {
        table: [
          ["Data Analyst, Cascade Freight", "Apr 2022 – Present"],
          ["Junior Data Analyst, Harbor Logistics", "Jan 2020 – Mar 2022"],
        ],
      },
      b("Built Tableau dashboards tracking delivery times across 40 warehouses."),
      b("Automated weekly reporting in Python and SQL, saving 10 hours per week."),
      b("Forecast seasonal demand with a model that reduced overstock by 15%."),
      h("Education"),
      p("Bachelor of Science in Statistics, University of Washington, 2019"),
      h("Skills"),
      {
        table: [
          ["SQL", "Python", "Tableau"],
          ["Excel", "Power BI", "Statistics"],
        ],
      },
    ],
  });

const textBoxDocx = () =>
  buildDocx({
    pages: 1,
    header: ["Sofia Alvarez | sofia.alvarez@example.com | +1 305 555 0187"],
    blocks: [
      {
        textBox: [
          { text: "Sofia Alvarez", bold: true, size: 20 },
          { text: "Registered Nurse" },
        ],
      },
      h("Professional Summary"),
      p(
        "Registered nurse with eight years of acute care experience in emergency and intensive care units.",
      ),
      h("Work Experience"),
      role("Charge Nurse, Mercy General Hospital", "Mar 2019 – Present"),
      b(
        "Supervise a team of 12 nurses across day and night shifts in a 30-bed emergency department.",
      ),
      b("Introduced a triage checklist that cut average wait time by 22 minutes."),
      role("Staff Nurse, Bayview Medical Center", "Jun 2016 – Feb 2019"),
      b("Cared for up to six ICU patients per shift, including ventilator management."),
      h("Education"),
      p("Bachelor of Science in Nursing, University of Miami, 2016"),
      h("Certifications"),
      p("Basic Life Support (BLS), American Heart Association, 2024"),
      p("Advanced Cardiac Life Support (ACLS), American Heart Association, 2024"),
      h("Skills"),
      p(
        "Patient Assessment, Triage, Critical Care, Electronic Health Records, Communication, Leadership",
      ),
    ],
  });

const nonstandardDocx = () =>
  buildDocx({
    pages: 1,
    blocks: [
      { text: "Noah Williams", bold: true, size: 20 },
      p("noah.williams@example.com · 415-555-0123 · San Francisco, CA"),
      p("MY JOURNEY", { bold: true, size: 13 } as Partial<Block>),
      role("Backend Engineer, Cloudline", "2021 – Present"),
      b(
        "Designed Go microservices handling 5,000 requests per second with 99.95% uptime.",
      ),
      b("Moved deployments to Kubernetes and Terraform, halving release time."),
      role("Software Developer, Quartz Systems", "2018 – 2021"),
      b("Maintained Java and Spring services for payment processing."),
      p("WHAT I KNOW", { bold: true, size: 13 } as Partial<Block>),
      p("Go, Java, Spring Boot, Kubernetes, Terraform, PostgreSQL, Kafka, AWS"),
      p("WHERE I STUDIED", { bold: true, size: 13 } as Partial<Block>),
      p("Bachelor of Engineering in Software Engineering, University of Waterloo, 2018"),
    ],
  });

const weakBulletsDocx = () =>
  buildDocx({
    blocks: [
      { text: "Taylor Brooks", style: "Title" },
      p("taylor.brooks@example.com | 773-555-0164 | Chicago, IL"),
      h("Experience"),
      role("Customer Support Specialist, Brightway Telecom", "Aug 2021 – Present"),
      b("Responsible for answering customer calls."),
      b("Worked on tickets in the support queue."),
      b("Helped with training new team members."),
      role("Sales Associate, Lakeside Outfitters", "May 2019 – Jul 2021"),
      b("Duties included stocking shelves and helping customers."),
      b("Responsible for the cash register."),
      h("Education"),
      p("Associate of Arts, Harold Washington College, 2019"),
      h("Skills"),
      p("Customer Service, Salesforce, Communication, Microsoft Excel, Problem Solving"),
    ],
  });

export const FIXTURES: Fixture[] = [
  {
    name: "clean-single-column",
    format: "pdf",
    load: pdf("clean-single-column.pdf"),
    expect: {
      sections: ["summary", "experience", "education", "skills", "certifications"],
      name: "Jordan Rivera",
      email: "jordan.rivera@example.com",
      phone: true,
      experienceEntries: 3,
      educationEntries: 1,
      minSkills: 12,
      pageCount: 1,
      columns: false,
    },
  },
  {
    name: "two-column",
    format: "pdf",
    load: pdf("two-column.pdf"),
    expect: {
      sections: ["skills", "languages", "education", "summary", "experience"],
      name: "Priya Natarajan",
      email: "priya.natarajan@example.com",
      phone: true,
      experienceEntries: 3,
      educationEntries: 1,
      minSkills: 5,
      columns: true,
    },
  },
  {
    name: "student-projects",
    format: "pdf",
    load: pdf("student-projects.pdf"),
    expect: {
      sections: ["education", "projects", "skills", "volunteering"],
      name: "Kofi Mensah",
      email: "kofi.mensah@example.com",
      phone: true,
      experienceEntries: 0,
      educationEntries: 1,
      minSkills: 10,
    },
  },
  {
    name: "strong-bullets",
    format: "pdf",
    load: pdf("strong-bullets.pdf"),
    expect: {
      sections: ["summary", "experience", "education", "skills"],
      name: "Elena Petrova",
      email: "elena.petrova@example.com",
      phone: true,
      experienceEntries: 2,
      educationEntries: 2,
      minSkills: 7,
    },
  },
  {
    name: "long-cv",
    format: "pdf",
    load: pdf("long-cv.pdf"),
    expect: {
      sections: [
        "experience",
        "education",
        "publications",
        "awards",
        "experience",
        "publications",
        "skills",
        "other",
      ],
      name: "Dr. Amelia Chen",
      email: "amelia.chen@example.ac.uk",
      experienceEntries: 4,
      educationEntries: 3,
      contactInHeaderOrFooter: true,
    },
  },
  {
    name: "spanish",
    format: "pdf",
    load: pdf("spanish.pdf"),
    expect: {
      name: "Lucía Fernández",
      email: "lucia.fernandez@example.com",
      language: "other",
      warnings: ["doesn't appear to be in English"],
      excludeFromAccuracy: true,
    },
  },
  {
    name: "scanned",
    format: "pdf",
    load: pdf("scanned.pdf"),
    expect: { error: "EMPTY_DOCUMENT" },
  },
  {
    name: "tables",
    format: "docx",
    load: tablesDocx,
    expect: {
      sections: ["summary", "experience", "education", "skills"],
      name: "Marcus Lee",
      email: "marcus.lee@example.com",
      phone: true,
      educationEntries: 1,
      minSkills: 6,
      tables: true,
      pageCount: 1,
    },
  },
  {
    name: "textbox-header-contact",
    format: "docx",
    load: textBoxDocx,
    expect: {
      sections: ["summary", "experience", "education", "certifications", "skills"],
      name: "Sofia Alvarez",
      email: "sofia.alvarez@example.com",
      phone: true,
      experienceEntries: 2,
      educationEntries: 1,
      textBoxes: true,
      contactInHeaderOrFooter: true,
    },
  },
  {
    name: "nonstandard-headings",
    format: "docx",
    load: nonstandardDocx,
    expect: {
      sections: ["experience", "skills", "education"],
      name: "Noah Williams",
      email: "noah.williams@example.com",
      experienceEntries: 2,
      educationEntries: 1,
      minSkills: 6,
    },
  },
  {
    name: "weak-bullets",
    format: "docx",
    load: weakBulletsDocx,
    expect: {
      sections: ["experience", "education", "skills"],
      name: "Taylor Brooks",
      email: "taylor.brooks@example.com",
      phone: true,
      experienceEntries: 2,
      educationEntries: 1,
      minSkills: 4,
    },
  },
];
