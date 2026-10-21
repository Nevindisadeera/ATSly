import type { MatchBand } from "@/types/report";

/**
 * Job matching domain types — docs/PLANNING.md §19 and §21. The engine is pure: the same
 * resume and requirements always produce the same report.
 */

export type Importance = "required" | "preferred";

export type Seniority =
  | "intern"
  | "junior"
  | "mid"
  | "senior"
  | "lead"
  | "principal"
  | "manager"
  | "director"
  | "executive"
  | "unspecified";

export type JobEducationLevel =
  "highschool" | "associate" | "bachelor" | "master" | "doctorate" | "unspecified";

/** What a job asks for. Same shape as the AI extraction schema (§21), so either can fill it. */
export type JobRequirements = {
  jobTitle: string | null;
  seniority: Seniority;
  yearsExperience: { min: number | null; max: number | null };
  education: { level: JobEducationLevel; field: string | null; required: boolean };
  hardSkills: {
    name: string;
    kind: "skill" | "tool" | "technology";
    importance: Importance;
  }[];
  softSkills: string[];
  certifications: { name: string; importance: Importance }[];
  responsibilities: string[];
  domain: string | null;
};

export type MatchComponentKey =
  | "required_skills"
  | "preferred_skills"
  | "responsibilities"
  | "experience"
  | "education"
  | "title";

export type MatchComponent = {
  key: MatchComponentKey;
  label: string;
  /** Published weight (§19.2). */
  weight: number;
  /** Weight after redistributing components that couldn't be assessed; 0 when na. */
  effectiveWeight: number;
  /** 0–100, or null when the component couldn't be assessed. */
  score: number | null;
  note?: string;
};

export type TermKind = "skill" | "tool" | "technology" | "certification" | "soft";

export type MatchedTerm = {
  term: string;
  kind: TermKind;
  importance: Importance;
  matchType: "exact" | "normalized" | "semantic";
  /** The resume text that matched, quoted. */
  evidence?: string;
  /** Where in the resume, e.g. "Experience › Acme › bullet 2". */
  location?: string;
};

export type MissingTerm = {
  term: string;
  kind: TermKind;
  importance: Importance;
  /** Templated and conditional — never "Add {term}" (§19.3 honesty rules). */
  suggestion: string;
};

export type FitStatus = "meets" | "exceeds" | "close" | "gap" | "not_specified";

export type FitRow = { status: FitStatus; detail: string };

export type MatchReport = {
  score: number;
  band: MatchBand;
  components: MatchComponent[];
  matched: MatchedTerm[];
  missing: MissingTerm[];
  /** Filled by AI responsibility alignment (Phase 10a); empty for rules-only reports. */
  strongMatches: { requirement: string; evidence: string }[];
  weakMatches: { requirement: string; reason: string }[];
  fit: { experience: FitRow; education: FitRow; title: FitRow };
  honestyFlags: string[];
  version: string;
};
