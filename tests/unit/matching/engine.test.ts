import { describe, expect, it } from "vitest";

import {
  aggregate,
  MATCH_WEIGHTS,
  matchBandFor,
  matchHeadline,
  missingSuggestion,
  runMatchEngine,
  type JobRequirements,
  type MatchComponentKey,
} from "@/lib/matching";
import {
  educationFit,
  experienceFit,
  jaccard,
  titleFit,
  titleTokens,
} from "@/lib/matching/fit";

import { cleanResume } from "../../support/ats";

/** A job with nothing specified; tests fill in what they need. */
function job(overrides: Partial<JobRequirements> = {}): JobRequirements {
  return {
    jobTitle: null,
    seniority: "unspecified",
    yearsExperience: { min: null, max: null },
    education: { level: "unspecified", field: null, required: false },
    hardSkills: [],
    softSkills: [],
    certifications: [],
    responsibilities: [],
    domain: null,
    ...overrides,
  };
}

const skill = (name: string, importance: "required" | "preferred" = "required") => ({
  name,
  kind: "technology" as const,
  importance,
});

describe("matching tiers", () => {
  it("matches exact terms with evidence from experience before the skills list", () => {
    const report = runMatchEngine({
      resume: cleanResume(),
      job: job({ hardSkills: [skill("Kubernetes")] }),
    });
    expect(report.matched[0]).toMatchObject({
      term: "Kubernetes",
      matchType: "exact",
      location: "Experience › Northwind Payments › bullet 3",
    });
    expect(report.matched[0]!.evidence).toContain("Kubernetes clusters");
  });

  it("matches aliases through the taxonomy as normalized", () => {
    const resume = cleanResume();
    resume.experience[0]!.bullets.push(
      "Shipped dashboards in ReactJS for the finance team",
    );
    const report = runMatchEngine({
      resume,
      job: job({ hardSkills: [skill("Golang"), skill("JS"), skill("Postgres")] }),
    });
    const byTerm = Object.fromEntries(report.matched.map((m) => [m.term, m]));
    // PostgreSQL is listed in Skills under its own name, so "Postgres" matches as an alias.
    expect(byTerm.Postgres).toMatchObject({
      matchType: "normalized",
      location: "Skills",
    });
    expect(report.missing.map((m) => m.term)).toEqual(expect.arrayContaining(["Golang"]));
  });

  it("doesn't match short terms inside ordinary words", () => {
    const resume = cleanResume();
    resume.summary = { text: "Engineers go the extra mile." };
    const report = runMatchEngine({ resume, job: job({ hardSkills: [skill("Go")] }) });
    expect(report.matched).toEqual([]);
  });

  it("lists missing terms required first, with conditional suggestions", () => {
    const report = runMatchEngine({
      resume: cleanResume(),
      job: job({
        hardSkills: [skill("Scala", "preferred"), skill("Rust"), skill("Python")],
      }),
    });
    expect(report.missing.map((m) => [m.term, m.importance])).toEqual([
      ["Rust", "required"],
      ["Scala", "preferred"],
    ]);
    for (const m of report.missing) {
      expect(m.suggestion).toBe(
        `If you have experience with ${m.term}, add it to Skills and reference it in a relevant bullet.`,
      );
      expect(m.suggestion).not.toMatch(/^Add /);
    }
  });

  it("matches certifications by name or alias and flags missing required ones", () => {
    const resume = cleanResume();
    resume.certifications = [{ name: "AWS Certified Solutions Architect – Associate" }];
    const report = runMatchEngine({
      resume,
      job: job({
        certifications: [
          { name: "AWS Certification", importance: "preferred" },
          { name: "PMP", importance: "required" },
        ],
      }),
    });
    expect(report.matched).toEqual([
      expect.objectContaining({
        term: "AWS Certification",
        kind: "certification",
        matchType: "normalized",
      }),
    ]);
    expect(report.missing[0]).toMatchObject({
      term: "PMP",
      suggestion: "If you hold PMP, list it in a Certifications section.",
    });
    expect(report.honestyFlags).toContain(
      "The posting requires PMP, which isn't on your resume.",
    );
  });

  it("shows soft skills when found but never lists them as missing", () => {
    const resume = cleanResume();
    resume.summary = { text: "Known for clear communication with partner teams." };
    const report = runMatchEngine({
      resume,
      job: job({
        softSkills: ["Communication", "Leadership"],
        hardSkills: [skill("Python")],
      }),
    });
    expect(report.matched.filter((m) => m.kind === "soft").map((m) => m.term)).toEqual([
      "Communication",
    ]);
    expect(report.missing.some((m) => m.kind === "soft")).toBe(false);
  });
});

describe("experience fit", () => {
  const resumeWithYears = (years: number) => {
    const resume = cleanResume();
    resume.stats.totalExperienceMonths = years * 12;
    return resume;
  };
  const fit = (years: number, min: number | null, max: number | null = null) =>
    experienceFit(resumeWithYears(years), job({ yearsExperience: { min, max } }));

  it.each([
    [6, 5, null, 100, "meets"],
    [4.5, 5, null, 70, "close"],
    [3.5, 5, null, 40, "gap"],
    [1, 5, null, 10, "gap"],
    [14, 3, 5, 80, "exceeds"],
    [9, 3, 5, 100, "meets"],
  ] as const)("%s years for %s–%s → %s (%s)", (years, min, max, score, status) => {
    const result = fit(years, min, max);
    expect(result.score).toBe(score);
    expect(result.row.status).toBe(status);
  });

  it("states gaps plainly and is na when the posting gives no years", () => {
    expect(fit(3, 5).flag).toBe(
      "The posting asks for at least 5 years of experience; your resume shows about 3 years.",
    );
    expect(fit(3, null)).toMatchObject({ score: null, row: { status: "not_specified" } });
  });
});

describe("education fit", () => {
  const none = { total: 0, matched: 0 };
  const level = (l: JobRequirements["education"]["level"], required = true) =>
    job({ education: { level: l, field: null, required } });

  it("scores level differences (the clean resume has a bachelor's)", () => {
    expect(educationFit(cleanResume(), level("bachelor"), none).score).toBe(100);
    expect(educationFit(cleanResume(), level("associate"), none).score).toBe(100);
    expect(educationFit(cleanResume(), level("master"), none).score).toBe(50);
    expect(educationFit(cleanResume(), level("doctorate"), none).score).toBe(0);
  });

  it("flags only required gaps, and is na when nothing is asked", () => {
    expect(educationFit(cleanResume(), level("master"), none).flag).toContain(
      "a master's degree",
    );
    expect(
      educationFit(cleanResume(), level("master", false), none).flag,
    ).toBeUndefined();
    expect(educationFit(cleanResume(), level("unspecified"), none).score).toBeNull();
  });

  it("blends 50/50 with required certification coverage", () => {
    expect(
      educationFit(cleanResume(), level("bachelor"), { total: 2, matched: 1 }).score,
    ).toBe(75);
    expect(
      educationFit(cleanResume(), level("unspecified"), { total: 2, matched: 1 }).score,
    ).toBe(50);
  });
});

describe("title fit", () => {
  it("compares title words without seniority markers, with synonyms", () => {
    expect([...titleTokens("Sr. Backend Developer (Remote)")]).toEqual([
      "backend",
      "engineer",
    ]);
    expect(
      jaccard(titleTokens("Backend Engineer"), titleTokens("Senior Backend Developer")),
    ).toBe(1);
  });

  it("blends title overlap with seniority distance", () => {
    // Most recent title: "Senior Backend Engineer".
    const same = titleFit(
      cleanResume(),
      job({ jobTitle: "Senior Backend Engineer", seniority: "senior" }),
    );
    expect(same.score).toBe(100);
    const junior = titleFit(
      cleanResume(),
      job({ jobTitle: "Junior Backend Engineer", seniority: "junior" }),
    );
    expect(junior.score).toBe(70); // (100 + 40) / 2
    const other = titleFit(
      cleanResume(),
      job({ jobTitle: "Marketing Manager", seniority: "unspecified" }),
    );
    expect(other.score).toBe(0);
    expect(titleFit(cleanResume(), job()).score).toBeNull();
  });
});

describe("aggregation and redistribution", () => {
  const scores = (values: Partial<Record<MatchComponentKey, number | null>>) =>
    Object.fromEntries(
      (Object.keys(MATCH_WEIGHTS) as MatchComponentKey[]).map((key) => [
        key,
        { score: values[key] ?? null },
      ]),
    ) as Record<MatchComponentKey, { score: number | null }>;

  it("publishes weights that sum to 100", () => {
    expect(Object.values(MATCH_WEIGHTS).reduce((a, b) => a + b, 0)).toBe(100);
  });

  it("uses published weights when every component is assessed", () => {
    const result = aggregate(
      scores({
        required_skills: 80,
        preferred_skills: 50,
        responsibilities: 70,
        experience: 100,
        education: 100,
        title: 60,
      }),
    );
    // (80×40 + 50×10 + 70×20 + 100×10 + 100×10 + 60×10) / 100 = 77
    expect(result.score).toBe(77);
    expect(result.components.map((c) => c.effectiveWeight)).toEqual([
      40, 10, 20, 10, 10, 10,
    ]);
  });

  it("redistributes the weight of components that can't be assessed", () => {
    const result = aggregate(scores({ required_skills: 80, experience: 100, title: 50 }));
    // Available weights 40 + 10 + 10 = 60: (80×40 + 100×10 + 50×10) / 60 = 78.33
    expect(result.score).toBe(78);
    const effective = Object.fromEntries(
      result.components.map((c) => [c.key, c.effectiveWeight]),
    );
    expect(effective).toEqual({
      required_skills: 66.67,
      preferred_skills: 0,
      responsibilities: 0,
      experience: 16.67,
      education: 0,
      title: 16.67,
    });
  });

  it("scores 0 when nothing can be assessed", () => {
    expect(aggregate(scores({})).score).toBe(0);
  });

  it.each([
    [100, "strong"],
    [80, "strong"],
    [79, "moderate"],
    [60, "moderate"],
    [59, "partial"],
    [40, "partial"],
    [39, "low"],
  ] as const)("score %i is %s", (score, band) => {
    expect(matchBandFor(score)).toBe(band);
  });
});

describe("runMatchEngine", () => {
  it("produces a full report without AI: responsibilities are na and redistributed", () => {
    const report = runMatchEngine({
      resume: cleanResume(),
      job: job({
        jobTitle: "Senior Backend Engineer",
        seniority: "senior",
        yearsExperience: { min: 5, max: null },
        education: { level: "bachelor", field: "Computer Science", required: true },
        hardSkills: [
          skill("Python"),
          skill("Kubernetes"),
          skill("Rust"),
          skill("Terraform", "preferred"),
        ],
      }),
    });
    const byKey = Object.fromEntries(report.components.map((c) => [c.key, c]));
    expect(byKey.responsibilities).toMatchObject({ score: null, effectiveWeight: 0 });
    expect(byKey.responsibilities!.note).toContain("AI analysis");
    expect(byKey.required_skills!.score).toBe(67);
    expect(byKey.preferred_skills!.score).toBe(100);
    expect(report.components.reduce((sum, c) => sum + c.effectiveWeight, 0)).toBeCloseTo(
      100,
      1,
    );
    expect(report.band).toBe(matchBandFor(report.score));
    expect(report.strongMatches).toEqual([]);
    expect(report.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("says when a posting has nothing to match against", () => {
    const report = runMatchEngine({ resume: cleanResume(), job: job() });
    expect(report.score).toBe(0);
    expect(report.honestyFlags[0]).toContain("couldn't find specific requirements");
  });

  it("phrases the headline sentence and suggestions as the plan specifies", () => {
    expect(matchHeadline("moderate")).toBe("Keyword coverage for this role is moderate.");
    expect(missingSuggestion("Kafka", "technology")).toBe(
      "If you have experience with Kafka, add it to Skills and reference it in a relevant bullet.",
    );
  });
});
