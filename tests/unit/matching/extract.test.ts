import { describe, expect, it } from "vitest";

import { extractJobRequirements, normalizeJobText, segmentJobText } from "@/lib/matching";
import { detectEducation, detectJobTitle, detectYears } from "@/lib/matching/extract";

import { JOB_FIXTURES } from "../../fixtures/jobs/jobs";

describe.each(JOB_FIXTURES)("$name", (fixture) => {
  const job = extractJobRequirements(fixture.load());
  const want = fixture.expect;
  const named = (importance: "required" | "preferred") =>
    job.hardSkills.filter((s) => s.importance === importance).map((s) => s.name);

  it("extracts title, seniority, years and education", () => {
    expect(job.jobTitle).toBe(want.title);
    expect(job.seniority).toBe(want.seniority);
    expect(job.yearsExperience).toEqual(want.years);
    expect(job.education.level).toBe(want.education.level);
    if (want.education.required !== undefined) {
      expect(job.education.required).toBe(want.education.required);
    }
  });

  it("classifies skills as required or preferred", () => {
    expect(named("required")).toEqual(expect.arrayContaining(want.required));
    expect(named("preferred")).toEqual(expect.arrayContaining(want.preferred));
    // Nothing is both.
    const required = new Set(named("required"));
    expect(named("preferred").filter((s) => required.has(s))).toEqual([]);
  });

  it("finds certifications and responsibilities", () => {
    expect(job.certifications).toEqual(want.certifications ?? []);
    expect(job.responsibilities.length).toBeGreaterThanOrEqual(
      want.minResponsibilities ?? 0,
    );
  });
});

describe("normalization and segments", () => {
  it("normalizes unicode, whitespace and blank lines", () => {
    expect(normalizeJobText("Ｓｅｎｉｏｒ  Engineer\r\n\r\n\r\n\tRemote ")).toBe(
      "Senior Engineer\n\nRemote",
    );
  });

  it("splits sections by heading and drops equal-opportunity boilerplate", () => {
    const segments = segmentJobText(
      [
        "Intro line",
        "Requirements:",
        "- 3+ years of React",
        "Nice to have",
        "- GraphQL",
        "Benefits",
        "- Health insurance",
        "We are an equal opportunity employer and consider all applicants without regard to race.",
      ].join("\n"),
    );
    expect(segments.map((s) => s.kind)).toEqual([
      "other",
      "requirements",
      "preferred",
      "benefits",
    ]);
    expect(segments[1]!.lines).toEqual(["3+ years of React"]);
    expect(segments.flatMap((s) => s.lines).join(" ")).not.toContain("equal opportunity");
  });

  it("keeps an inline heading to its own line", () => {
    const segments = segmentJobText(
      "Must have: React\nNice to have: Vue\nWe value kindness.",
    );
    expect(segments.map((s) => [s.kind, s.lines])).toEqual([
      ["requirements", ["React"]],
      ["preferred", ["Vue"]],
      ["other", ["We value kindness."]],
    ]);
  });

  it("treats skills in benefits and company blurbs as not required", () => {
    const job = extractJobRequirements(
      "About us\nWe love Kubernetes.\nRequirements\n- Python\nPerks\n- Free Figma licenses",
    );
    expect(job.hardSkills.map((s) => s.name)).toEqual(["Python"]);
  });

  it("marks skills preferred by cue words on the line", () => {
    const job = extractJobRequirements(
      "Requirements\n- Python\n- Docker is a plus\n- Ideally some Terraform",
    );
    expect(job.hardSkills.map((s) => [s.name, s.importance])).toEqual([
      ["Python", "required"],
      ["Docker", "preferred"],
      ["Terraform", "preferred"],
    ]);
  });

  it("keeps required when a skill appears as both", () => {
    const job = extractJobRequirements(
      "Requirements\n- SQL\nNice to have\n- SQL and dbt",
    );
    expect(job.hardSkills.find((s) => s.name === "SQL")?.importance).toBe("required");
  });
});

describe("years of experience", () => {
  it.each([
    ["5+ years of experience", { min: 5, max: null }],
    ["2-4 years of experience in analytics", { min: 2, max: 4 }],
    ["3 to 5 years in product design", { min: 3, max: 5 }],
    ["At least three years of relevant experience", { min: 3, max: null }],
    ["Minimum of 7 years managing projects", { min: 7, max: null }],
    ["Experience with Python", { min: null, max: null }],
  ])("%s", (line, years) => {
    expect(detectYears([line])).toEqual(years);
  });

  it("takes the overall figure over smaller per-skill ones", () => {
    expect(detectYears(["5+ years of software experience", "2+ years with Go"])).toEqual({
      min: 5,
      max: null,
    });
  });

  it("ignores implausible numbers", () => {
    expect(detectYears(["Founded 50 years ago"])).toEqual({ min: null, max: null });
  });
});

describe("education", () => {
  const education = (
    lines: string[],
    kind: "requirements" | "preferred" = "requirements",
  ) => detectEducation([{ kind, lines }]);

  it("finds the lowest accepted level and the field", () => {
    expect(education(["Bachelor's or Master's degree in Computer Science"])).toEqual({
      level: "bachelor",
      field: "Computer Science",
      required: true,
    });
    expect(education(["PhD in Machine Learning"]).level).toBe("doctorate");
    expect(education(["High school diploma or GED"]).level).toBe("highschool");
    expect(education(["A university degree"]).level).toBe("bachelor");
  });

  it("isn't fooled by degree abbreviations used in other senses", () => {
    for (const line of [
      "Location: Boston, MA",
      "Advanced MS Excel",
      "Scrum Master certification preferred",
      "Associate Product Manager",
      "Work with the DBA team",
    ]) {
      expect(education([line]).level, line).toBe("unspecified");
    }
  });

  it("marks degrees optional with equivalent experience or in a preferred section", () => {
    expect(education(["Bachelor's degree or equivalent experience"]).required).toBe(
      false,
    );
    expect(education(["Master's degree"], "preferred").required).toBe(false);
  });
});

describe("job title", () => {
  it("reads labelled titles, first lines and hiring phrases", () => {
    expect(detectJobTitle("Job title: IT Project Manager\nWe are hiring.")).toBe(
      "IT Project Manager",
    );
    expect(detectJobTitle("Senior Data Engineer\nAbout us")).toBe("Senior Data Engineer");
    expect(detectJobTitle("Digital Marketing Manager - Growth Team\nText")).toBe(
      "Digital Marketing Manager",
    );
    expect(detectJobTitle("Brightline is hiring a Product Designer to join us.")).toBe(
      "Product Designer",
    );
    expect(detectJobTitle("We build software for clinics.\nCome join us.")).toBeNull();
  });

  it("prefers the title the user typed", () => {
    expect(
      extractJobRequirements("Senior Data Engineer\nPython", { title: "Analyst" })
        .jobTitle,
    ).toBe("Analyst");
  });
});
