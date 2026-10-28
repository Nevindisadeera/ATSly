import { z } from "zod";

/**
 * Structured output schemas — docs/PLANNING.md §21. The provider asks the model for exactly
 * this shape (strict JSON schema) and every response is validated with these again.
 * Bump PROMPT_VERSION (prompts.ts) whenever a schema changes.
 */

const Importance = z.enum(["required", "preferred"]);

export const JobRequirementsSchema = z.object({
  jobTitle: z.string().max(120).nullable(),
  seniority: z.enum([
    "intern",
    "junior",
    "mid",
    "senior",
    "lead",
    "principal",
    "manager",
    "director",
    "executive",
    "unspecified",
  ]),
  yearsExperience: z.object({
    min: z.number().int().min(0).max(40).nullable(),
    max: z.number().int().min(0).max(40).nullable(),
  }),
  education: z.object({
    level: z.enum([
      "highschool",
      "associate",
      "bachelor",
      "master",
      "doctorate",
      "unspecified",
    ]),
    field: z.string().max(120).nullable(),
    required: z.boolean(),
  }),
  hardSkills: z
    .array(
      z.object({
        name: z.string().max(60),
        kind: z.enum(["skill", "tool", "technology"]),
        importance: Importance,
      }),
    )
    .max(40),
  softSkills: z.array(z.string().max(40)).max(12),
  certifications: z
    .array(z.object({ name: z.string().max(80), importance: Importance }))
    .max(10),
  responsibilities: z.array(z.string().max(160)).max(12),
  domain: z.string().max(60).nullable(),
});

const Target = z
  .object({
    section: z.enum([
      "summary",
      "experience",
      "projects",
      "skills",
      "education",
      "other",
    ]),
    entryIndex: z.number().int().nullable(),
    bulletIndex: z.number().int().nullable(),
  })
  .nullable();

export const RecommendationSchema = z.object({
  priority: z.enum(["high", "medium", "low"]),
  category: z.enum([
    "content",
    "structure",
    "keywords",
    "formatting",
    "completeness",
    "readability",
    "job_match",
  ]),
  title: z.string().max(90),
  detail: z.string().max(500),
  before: z.string().max(400).nullable(),
  after: z.string().max(400).nullable(),
  target: Target,
});

export const ContentAnalysisSchema = z.object({
  overallQuality: z.number().int().min(0).max(100),
  sectionQuality: z.object({
    summary: z.number().int().min(0).max(100).nullable(),
    experience: z.number().int().min(0).max(100).nullable(),
    skills: z.number().int().min(0).max(100).nullable(),
    projects: z.number().int().min(0).max(100).nullable(),
  }),
  bulletFindings: z
    .array(
      z.object({
        original: z.string().max(400),
        target: Target,
        issues: z
          .array(
            z.enum([
              "no_impact",
              "vague",
              "no_metrics",
              "no_technology",
              "too_long",
              "passive",
              "duplicate",
              "grammar",
            ]),
          )
          .min(1),
        rewrite: z.string().max(400).nullable(),
        rationale: z.string().max(240),
      }),
    )
    .max(12),
  possibleTypos: z
    .array(z.object({ text: z.string().max(60), suggestion: z.string().max(60) }))
    .max(10),
  recommendations: z.array(RecommendationSchema).max(8),
});

export const MatchAssessmentSchema = z.object({
  coverage: z
    .array(
      z.object({
        requirement: z.string().max(80),
        covered: z.enum(["yes", "partial", "no"]),
        evidence: z.string().max(400).nullable(),
        confidence: z.enum(["high", "medium", "low"]),
      }),
    )
    .max(40),
  responsibilityAlignment: z.object({
    score: z.number().int().min(0).max(100),
    strong: z
      .array(
        z.object({ responsibility: z.string().max(160), evidence: z.string().max(400) }),
      )
      .max(6),
    weak: z
      .array(
        z.object({ responsibility: z.string().max(160), reason: z.string().max(200) }),
      )
      .max(6),
  }),
  tailoringRecommendations: z.array(RecommendationSchema).max(6),
  honestyFlags: z.array(z.string().max(200)).max(5),
});

export type AiJobRequirements = z.infer<typeof JobRequirementsSchema>;
export type Recommendation = z.infer<typeof RecommendationSchema>;
export type ContentAnalysis = z.infer<typeof ContentAnalysisSchema>;
export type MatchAssessment = z.infer<typeof MatchAssessmentSchema>;
