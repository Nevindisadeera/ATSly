import { describe, expect, it } from "vitest";

import {
  CERTIFICATIONS,
  findCertificationsInText,
  findSkillsInText,
  lookupSkill,
  matchDegree,
  matchHeading,
  normalizeSkill,
  SKILLS,
} from "@/lib/taxonomy";

describe("certifications", () => {
  const ids = (text: string) => findCertificationsInText(text).map((c) => c.id);

  it("finds certifications by name and alias, in order", () => {
    expect(ids("PMP certified; also a Certified Public Accountant")).toEqual([
      "pmp",
      "cpa",
    ]);
    expect(ids("AWS Certified Solutions Architect – Associate")).toEqual([
      "aws-certification",
      "aws-solutions-architect",
    ]);
    expect(ids("CompTIA Security+ and ITIL Foundation")).toEqual([
      "comptia-security",
      "itil",
    ]);
  });

  it("matches short codes only in capitals, so ordinary words don't count", () => {
    expect(ids("The cma office manager reviewed the phr notes")).toEqual([]);
    expect(ids("CMA and PHR holder")).toEqual(["cma", "phr"]);
  });

  it("has unique ids", () => {
    expect(new Set(CERTIFICATIONS.map((c) => c.id)).size).toBe(CERTIFICATIONS.length);
  });
});

describe("expanded skills", () => {
  it("recognizes marketing, finance, design and project skills by alias", () => {
    expect(lookupSkill("fp&a")?.id).toBe("fpa");
    expect(lookupSkill("Facebook Ads")?.id).toBe("meta-ads");
    expect(lookupSkill("Google Data Studio")?.id).toBe("looker-studio");
    expect(lookupSkill("MS Project")?.id).toBe("ms-project");
    expect(lookupSkill("objectives and key results")?.id).toBe("okrs");
    expect(SKILLS.length).toBeGreaterThanOrEqual(270);
  });

  it("matches product names that are also words only with their own casing", () => {
    expect(
      findSkillsInText("Logged hours each workday and avoided a waterfall of tasks"),
    ).toEqual([]);
    expect(findSkillsInText("Managed payroll in Workday").map((s) => s.id)).toEqual([
      "workday",
    ]);
  });
});

describe("matchHeading", () => {
  it("matches standard headings exactly, ignoring case and punctuation", () => {
    expect(matchHeading("WORK EXPERIENCE")).toEqual({ kind: "experience", exact: true });
    expect(matchHeading("Skills:")).toEqual({ kind: "skills", exact: true });
    expect(matchHeading("Education & Training")).toEqual({
      kind: "education",
      exact: true,
    });
  });

  it("matches headings that extend a known phrase as non-standard", () => {
    expect(matchHeading("Professional Experience Highlights")).toEqual({
      kind: "experience",
      exact: false,
    });
  });

  it("returns null for unrelated text", () => {
    expect(matchHeading("My Journey")).toBeNull();
    expect(matchHeading("Senior Software Engineer")).toBeNull();
  });
});

describe("matchDegree", () => {
  it.each([
    ["Bachelor of Science in Computer Science", "bachelor"],
    ["B.Sc. (Hons) Software Engineering", "bachelor"],
    ["BS, Mathematics", "bachelor"],
    ["MBA, Finance", "master"],
    ["M.S. in Data Science", "master"],
    ["PhD in Physics", "doctorate"],
    ["Associate of Arts", "associate"],
    ["High School Diploma", "highschool"],
  ])("reads %s as %s", (text, level) => {
    expect(matchDegree(text)?.level).toBe(level);
  });

  it("ignores lowercase English words that look like abbreviations", () => {
    expect(matchDegree("worked as a lead and ma de decisions")).toBeNull();
  });
});

describe("skills", () => {
  it("normalizes versions and resolves aliases", () => {
    expect(normalizeSkill("Python 3.11")).toBe("python");
    expect(lookupSkill("ReactJS")?.id).toBe("react");
    expect(lookupSkill("k8s")?.id).toBe("kubernetes");
    expect(lookupSkill("C++")?.id).toBe("cpp");
    expect(lookupSkill("C#")?.id).toBe("csharp");
    expect(lookupSkill("Node.js")?.id).toBe("nodejs");
    expect(lookupSkill("Basket weaving")).toBeUndefined();
  });

  it("finds skills in prose without matching ambiguous everyday words", () => {
    const ids = findSkillsInText(
      "Built a Next.js app in TypeScript with PostgreSQL and Docker; helped the rest of the team go live.",
    ).map((s) => s.id);
    expect(ids).toEqual(["nextjs", "typescript", "postgresql", "docker"]);
  });

  it("still finds ambiguous skills when written with their exact name", () => {
    expect(
      findSkillsInText("Services written in Go and exposed over REST").map((s) => s.id),
    ).toEqual(["go", "rest"]);
  });
});
