import { describe, expect, it } from "vitest";

import { MAX_RECOMMENDATIONS, mergeRecommendations } from "@/lib/ai/recommendations";
import type { ContentAnalysis, MatchAssessment, Recommendation } from "@/lib/ai/schemas";
import { runAtsEngine } from "@/lib/ats";
import {
  runMatchEngine,
  semanticCredit,
  type JobRequirements,
  type SemanticAssessment,
} from "@/lib/matching";
import { mergeRequirements } from "@/lib/matching/merge";

import { cleanResume, draft, setBullets } from "../../support/ats";

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

const flawedAts = () => {
  const d = draft();
  setBullets(d, [
    "Responsible for the checkout service",
    "Worked on billing",
    "Helped with testing",
  ]);
  d.layout.tables.count = 1;
  return runAtsEngine({
    parsed: d.parsed,
    layout: d.layout,
    format: d.format,
    text: d.text,
  });
};

const rec = (overrides: Partial<Recommendation>): Recommendation => ({
  priority: "medium",
  category: "content",
  title: "Strengthen a bullet",
  detail: "detail",
  before: null,
  after: null,
  target: null,
  ...overrides,
});

describe("mergeRecommendations", () => {
  it("always has rules recommendations from the ATS issues, highest priority first", () => {
    const ats = flawedAts();
    const merged = mergeRecommendations({ ats });
    expect(merged.length).toBeGreaterThan(0);
    expect(merged.every((r) => r.source === "rules")).toBe(true);
    expect(merged[0]).toMatchObject({
      priority: "high",
      checkId: "F01",
      category: "formatting",
    });
    const ranks = merged.map((r) => ({ high: 0, medium: 1, low: 2 })[r.priority]);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(merged.map((r) => r.id)).toEqual(merged.map((_, i) => `rules-${i + 1}`));
  });

  it("adds a job match recommendation for missing required skills, worded conditionally", () => {
    const match = runMatchEngine({
      resume: cleanResume(),
      job: job({
        hardSkills: [
          { name: "Rust", kind: "technology", importance: "required" },
          { name: "Scala", kind: "technology", importance: "required" },
        ],
      }),
    });
    const merged = mergeRecommendations({ ats: flawedAts(), match });
    const skills = merged.find((r) => r.category === "job_match")!;
    expect(skills).toMatchObject({
      priority: "high",
      title: "Show the required skills you have",
    });
    expect(skills.detail).toContain("If you have experience with these");
  });

  it("adds verified AI recommendations and rewrites, without duplicates, capped", () => {
    const before = "Responsible for the checkout service";
    const content: ContentAnalysis = {
      overallQuality: 50,
      sectionQuality: { summary: null, experience: 50, skills: null, projects: null },
      bulletFindings: [
        {
          original: before,
          target: null,
          issues: ["vague"],
          rewrite: "Owned the checkout service.",
          rationale: "r",
        },
        {
          original: "Worked on billing",
          target: null,
          issues: ["vague"],
          rewrite: "Delivered billing.",
          rationale: "r",
        },
      ],
      possibleTypos: [],
      recommendations: [
        rec({ before, after: "Owned the checkout service.", priority: "high" }),
        ...Array.from({ length: 6 }, (_, i) =>
          rec({ title: `AI idea ${i}`, priority: "low" }),
        ),
      ],
    };
    const assessment: MatchAssessment = {
      coverage: [],
      responsibilityAlignment: { score: 50, strong: [], weak: [] },
      tailoringRecommendations: [rec({ title: "Name Kafka", category: "job_match" })],
      honestyFlags: [],
    };
    const merged = mergeRecommendations({ ats: flawedAts(), content, assessment });
    expect(merged.length).toBeLessThanOrEqual(MAX_RECOMMENDATIONS);
    // The finding with the same quote as a recommendation isn't repeated.
    expect(merged.filter((r) => r.before === before)).toHaveLength(1);
    expect(
      merged.some(
        (r) => r.before === "Worked on billing" && r.after === "Delivered billing.",
      ),
    ).toBe(true);
    // Within a priority, rules come before AI.
    const high = merged.filter((r) => r.priority === "high");
    expect(high.findIndex((r) => r.source === "ai")).toBeGreaterThan(
      high.findIndex((r) => r.source === "rules"),
    );
  });
});

describe("mergeRequirements", () => {
  it("lets rules win on numbers and fills gaps from AI", () => {
    const rules = job({
      jobTitle: "Data Analyst",
      yearsExperience: { min: 3, max: null },
      hardSkills: [{ name: "SQL", kind: "technology", importance: "required" }],
    });
    const ai = job({
      jobTitle: "Senior Data Analyst",
      seniority: "senior",
      yearsExperience: { min: 5, max: 8 },
      education: { level: "bachelor", field: "Statistics", required: true },
      hardSkills: [
        { name: "SQL", kind: "technology", importance: "preferred" },
        { name: "postgres", kind: "technology", importance: "required" },
        { name: "Customer churn modeling", kind: "skill", importance: "preferred" },
      ],
      responsibilities: ["Build dashboards"],
      domain: "Retail",
    });
    expect(mergeRequirements(rules, ai)).toMatchObject({
      jobTitle: "Data Analyst",
      seniority: "senior",
      yearsExperience: { min: 3, max: null },
      education: { level: "bachelor" },
      hardSkills: [
        { name: "SQL", importance: "required" },
        { name: "PostgreSQL", importance: "required" },
        { name: "Customer churn modeling", importance: "preferred" },
      ],
      responsibilities: ["Build dashboards"],
      domain: "Retail",
    });
  });
});

describe("semantic tier", () => {
  const coverage = (
    covered: "yes" | "partial" | "no",
    confidence: "high" | "medium" | "low",
  ) => ({
    requirement: "Rust",
    covered,
    evidence:
      "Built a Python data pipeline on AWS that processes 2 million events per day",
    confidence,
  });

  it.each([
    ["yes", "high", 1],
    ["yes", "medium", 0.5],
    ["partial", "high", 0.5],
    ["partial", "medium", 0.5],
    ["yes", "low", 0],
    ["no", "high", 0],
  ] as const)("%s with %s confidence counts %s", (covered, confidence, credit) => {
    expect(semanticCredit(coverage(covered, confidence))).toBe(credit);
  });

  it("never credits a certification semantically: it's held or not", () => {
    const report = runMatchEngine({
      resume: cleanResume(),
      job: job({ certifications: [{ name: "PMP", importance: "required" }] }),
      assessment: {
        coverage: [{ ...coverage("yes", "high"), requirement: "PMP" }],
        responsibilityAlignment: null,
        honestyFlags: [],
      },
    });
    expect(report.matched).toEqual([]);
    expect(report.missing.map((m) => m.term)).toEqual(["PMP"]);
  });

  it("credits AI matches in coverage and adds responsibility alignment", () => {
    const requirements = job({
      hardSkills: [
        { name: "Rust", kind: "technology", importance: "required" },
        { name: "Scala", kind: "technology", importance: "required" },
      ],
      responsibilities: ["Run data pipelines"],
    });
    const assessment: SemanticAssessment = {
      coverage: [
        coverage("partial", "medium"),
        { ...coverage("yes", "high"), requirement: "Scala" },
      ],
      responsibilityAlignment: {
        score: 80,
        strong: [{ responsibility: "Run data pipelines", evidence: "x" }],
        weak: [],
      },
      honestyFlags: ["The posting asks for on-call experience."],
    };
    const report = runMatchEngine({
      resume: cleanResume(),
      job: requirements,
      assessment,
    });
    expect(report.matched.map((m) => [m.term, m.matchType, m.partial ?? false])).toEqual([
      ["Rust", "semantic", true],
      ["Scala", "semantic", false],
    ]);
    const byKey = Object.fromEntries(report.components.map((c) => [c.key, c.score]));
    expect(byKey.required_skills).toBe(75); // (0.5 + 1) / 2
    expect(byKey.responsibilities).toBe(80);
    expect(report.strongMatches).toEqual([
      { requirement: "Run data pipelines", evidence: "x" },
    ]);
    expect(report.honestyFlags).toContain("The posting asks for on-call experience.");
  });
});
