import { describe, expect, it } from "vitest";

import { collectItems } from "@/lib/parsing/parse/bullets";
import { parseContact } from "@/lib/parsing/parse/contact";
import { parseEducation } from "@/lib/parsing/parse/education";
import { parseExperience, readHeader } from "@/lib/parsing/parse/experience";
import { isLocation, splitTrailingLocation } from "@/lib/parsing/parse/location";
import {
  parseCertifications,
  parseLanguages,
  parseProjects,
} from "@/lib/parsing/parse/other-sections";
import { parseSkills } from "@/lib/parsing/parse/skills";
import { detectSections, scoreHeading } from "@/lib/parsing/sections/detect";
import { findPhone, leadingBullet, normalizeText } from "@/lib/parsing/text";

import { heading, line } from "../../support/lines";

describe("text helpers", () => {
  it("normalizes ligatures, dashes and spaces but keeps column gaps", () => {
    expect(normalizeText("ﬁnance  team‑lead \t 2021")).toBe("finance team-lead\t2021");
  });

  it("recognizes bullet glyphs, including hyphens only when followed by a space", () => {
    expect(leadingBullet("• Built things")).toBe("•");
    expect(leadingBullet("➤ Built things")).toBe("➤");
    expect(leadingBullet("- Built things")).toBe("-");
    expect(leadingBullet("-5% churn")).toBeNull();
  });

  it("finds phone numbers but not year ranges", () => {
    expect(findPhone("Call (617) 555-0199 today")).toBe("(617) 555-0199");
    expect(findPhone("+44 20 7946 0958")).toBe("+44 20 7946 0958");
    expect(findPhone("2019 - 2021")).toBeUndefined();
  });
});

describe("location", () => {
  it.each(["Austin, TX", "London, United Kingdom", "Remote", "Madrid, España"])(
    "accepts %s",
    (text) => expect(isLocation(text)).toBe(true),
  );

  it.each(["Senior Engineer, Northwind Labs", "React, TypeScript", "Austin"])(
    "rejects %s",
    (text) => expect(isLocation(text)).toBe(false),
  );

  it("splits a trailing location off a company", () => {
    expect(splitTrailingLocation("Acme Analytics, New York, NY")).toEqual({
      rest: "Acme Analytics",
      location: "New York, NY",
    });
  });
});

describe("experience headers", () => {
  it.each([
    [
      "Senior Software Engineer, Northwind Labs",
      "Senior Software Engineer",
      "Northwind Labs",
    ],
    ["Product Designer at Atlas Travel", "Product Designer", "Atlas Travel"],
    ["Acme Corp | Data Analyst | Remote", "Data Analyst", "Acme Corp"],
    [
      "Lecturer, Introduction to Climate Science, University of Edinburgh",
      "Lecturer",
      "University of Edinburgh",
    ],
  ])("reads %s", (text, title, company) => {
    expect(readHeader(text)).toMatchObject({ title, company });
  });

  it("reads locations from their own segment or a trailing city", () => {
    expect(readHeader("Analyst\tAcme Analytics, New York, NY").location).toBe(
      "New York, NY",
    );
    expect(readHeader("Engineer | Cloudline | Remote").location).toBe("Remote");
  });
});

describe("parseExperience", () => {
  it("splits entries at date ranges and collects bullets", () => {
    const entries = parseExperience([
      line("Senior Engineer, Acme Corp\tJan 2021 – Present", { bold: true }),
      line("• Led a migration to TypeScript across six services."),
      line("• Cut build times by 40% with caching."),
      line("Engineer, Globex\tJun 2018 – Dec 2020", { bold: true }),
      line("• Built internal tools in Python."),
    ]);
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      title: "Senior Engineer",
      company: "Acme Corp",
      end: "present",
      bullets: [
        "Led a migration to TypeScript across six services.",
        "Cut build times by 40% with caching.",
      ],
      confidence: 1,
    });
    expect(entries[1]).toMatchObject({
      title: "Engineer",
      start: { year: 2018, month: 6 },
    });
  });

  it("keeps a company line that follows the date line in the header", () => {
    const [entry] = parseExperience([
      line("Marketing Manager\tMarch 2016 – January 2020", { bold: true }),
      line("Brightline Software, Boston, MA"),
      line("Grew traffic by 210% with a content plan.", { x: 0.14 }),
    ]);
    expect(entry).toMatchObject({
      title: "Marketing Manager",
      company: "Brightline Software",
      location: "Boston, MA",
      bullets: ["Grew traffic by 210% with a content plan."],
    });
  });

  it("returns a low-confidence entry when there are no dates", () => {
    const [entry] = parseExperience([
      line("Barista, Blue Bottle", { bold: true }),
      line("• Served customers.", { listItem: true }),
    ]);
    expect(entry).toMatchObject({
      title: "Barista",
      company: "Blue Bottle",
      confidence: 0.6,
    });
  });
});

describe("collectItems", () => {
  it("merges wrapped PDF lines into one bullet", () => {
    const items = collectItems(
      [
        line("Built a React dashboard used by 40 managers, cutting", { x: 0.14 }),
        line("preparation time by 80%.", { x: 0.14 }),
        line("Led migration to TypeScript.", { x: 0.14 }),
      ],
      0.1,
    );
    expect(items.map((i) => i.text)).toEqual([
      "Built a React dashboard used by 40 managers, cutting preparation time by 80%.",
      "Led migration to TypeScript.",
    ]);
  });

  it("never merges Word list items", () => {
    const items = collectItems(
      [
        line("first item", { listItem: true, right: 1 }),
        line("second item", { listItem: true, right: 1 }),
      ],
      0.1,
    );
    expect(items).toHaveLength(2);
  });
});

describe("parseContact", () => {
  it("reads name, email, phone, location and links from the top block", () => {
    const contact = parseContact(
      [
        line("Jordan Rivera", { fontSize: 22, bold: true }),
        line(
          "jordan@example.com | +1 512 555 0142 | Austin, TX | linkedin.com/in/jordan",
        ),
        line("jordanrivera.dev"),
      ],
      [],
      { links: [] },
    );
    expect(contact).toMatchObject({
      name: "Jordan Rivera",
      email: "jordan@example.com",
      phone: "+1 512 555 0142",
      location: "Austin, TX",
      inHeaderOrFooter: false,
    });
    expect(contact.links.map((l) => l.type).sort()).toEqual(["linkedin", "portfolio"]);
  });

  it("flags contact details that appear only in a header", () => {
    const header = line("Sam Lee | sam@example.com", { region: "header" });
    const contact = parseContact([line("Sam Lee")], [header, line("Sam Lee")], {
      links: [],
    });
    expect(contact.email).toBe("sam@example.com");
    expect(contact.inHeaderOrFooter).toBe(true);
  });
});

describe("section detection", () => {
  it("ignores lexicon words that are list items without visual emphasis", () => {
    expect(scoreHeading(line("Leadership"), 10.5, false)).toBeNull();
    expect(scoreHeading(line("LEADERSHIP", { bold: true }), 10.5, false)).not.toBeNull();
  });

  it("never treats the first line as an unrecognized heading", () => {
    expect(
      scoreHeading(line("JORDAN RIVERA", { bold: true, fontSize: 22 }), 10.5, true),
    ).toBeNull();
  });

  it("doesn't turn bold capital company names into sections", () => {
    const lines = [
      line("Jordan Rivera", { fontSize: 22, bold: true }),
      line("jordan@example.com"),
      heading("Experience"),
      heading("Acme Corp"),
      line("Engineer\t2020 – 2022"),
      line("Built several things for many customers over two years.", { x: 0.14 }),
      heading("Globex"),
      line("Engineer\t2018 – 2020"),
      line("Maintained services used by thousands of people each day.", { x: 0.14 }),
      heading("Initech"),
      line("Intern\t2017 – 2018"),
      line("Wrote internal tools for the finance team in Python.", { x: 0.14 }),
      heading("Education"),
      line("BSc Physics, University of Leeds, 2017"),
    ];
    expect(detectSections(lines).map((s) => s.kind)).toEqual([
      "contact",
      "experience",
      "education",
    ]);
  });

  it("learns the heading style from recognized headings", () => {
    const lines = [
      line("Jordan Rivera", { fontSize: 22, bold: true }),
      line("jordan@example.com"),
      heading("Experience"),
      line("Engineer, Acme\t2020 – 2022"),
      line("Built several things for many customers over two years.", { x: 0.14 }),
      heading("Volunteer Firefighting"),
      line("Volunteer, County Fire Dept\t2019 – 2021"),
      line("Responded to emergency calls on weekends across the county.", { x: 0.14 }),
      heading("Education"),
      line("BSc Physics, University of Leeds, 2019"),
    ];
    const sections = detectSections(lines);
    expect(sections.map((s) => s.kind)).toEqual([
      "contact",
      "experience",
      "experience",
      "education",
    ]);
    expect(sections[2]).toMatchObject({
      heading: "VOLUNTEER FIREFIGHTING",
      headingIsStandard: false,
    });
  });
});

describe("smaller sections", () => {
  it("parses skills lists with labels, separators and notes", () => {
    const skills = parseSkills([
      line("Languages: Python, TypeScript | Go"),
      line("• React (5 years) · Next.js"),
      line("Proficient in Docker and Kubernetes for container orchestration at scale"),
    ]);
    expect(skills.map((s) => s.taxonomyId)).toEqual([
      "python",
      "typescript",
      "go",
      "react",
      "nextjs",
      "docker",
      "kubernetes",
    ]);
  });

  it("parses education with degree, field, institution and year", () => {
    expect(parseEducation([line("MBA, Marketing — New York University, 2016")])).toEqual([
      expect.objectContaining({
        degree: "MBA",
        level: "master",
        field: "Marketing",
        institution: "New York University",
        end: { year: 2016 },
      }),
    ]);
  });

  it("keeps bracketed abbreviations in certification names", () => {
    expect(
      parseCertifications([
        line("Basic Life Support (BLS), American Heart Association, 2024"),
      ]),
    ).toEqual([
      {
        name: "Basic Life Support (BLS)",
        issuer: "American Heart Association",
        date: { year: 2024 },
      },
    ]);
  });

  it("reads spoken languages with levels and ignores other words", () => {
    expect(parseLanguages([line("English (Native), Spanish – Fluent, Python")])).toEqual([
      { name: "English", level: "Native" },
      { name: "Spanish", level: "Fluent" },
    ]);
  });

  it("splits projects and finds their technologies", () => {
    const projects = parseProjects([
      line("StudyBuddy\t2025", { bold: true }),
      line("Built a Next.js and PostgreSQL planner.", { x: 0.14 }),
      line("Ray Tracer", { bold: true }),
      line("Wrote a renderer in Rust.", { x: 0.14 }),
    ]);
    expect(projects.map((p) => [p.name, p.technologies])).toEqual([
      ["StudyBuddy", ["Next.js", "PostgreSQL"]],
      ["Ray Tracer", ["Rust"]],
    ]);
  });
});
