import type { CategoryKey, CheckStatus, Evidence } from "@/lib/ats/types";
import type { ResumeSectionKind } from "@/types/api";
import type { AtsBand, Severity } from "@/types/report";

/**
 * View models for the results page — docs/PLANNING.md §7.3. Built on the server from a scan
 * and its parsed resume; components only render them. Safe to import from client code.
 */

export type CheckView = {
  id: string;
  /** Element id of the check's row, used by "Top 3 actions" links. */
  anchor: string;
  title: string;
  status: CheckStatus;
  severity: Severity;
  /** "Detected" for high-confidence checks, "Likely" for heuristic ones. */
  certainty: "Detected" | "Likely";
  /** Points this check removed from its category. */
  points: number;
  /** What was found, or why the check didn't apply. */
  explanation: string;
  fix?: string;
  evidence: Evidence[];
};

export type IssueGroupView = {
  key: CategoryKey;
  label: string;
  score: number;
  /** Failed and warned checks, largest deduction first. */
  issues: CheckView[];
  passed: CheckView[];
  notApplicable: CheckView[];
};

export type CategoryView = {
  key: CategoryKey;
  label: string;
  weight: number;
  score: number;
  /** score × weight / 100, e.g. 21.75. */
  weightedPoints: number;
};

export type TopActionView = { anchor: string; title: string; fix: string };

export type SkillGroupView = {
  category: string;
  skills: { term: string; backed: boolean }[];
};

export type KeywordsView = {
  groups: SkillGroupView[];
  backedCount: number;
  recognizedCount: number;
  /** Skills listed in the resume that the taxonomy doesn't know. */
  unrecognized: string[];
  /** Keyword hygiene checks (K04–K07) in brief. */
  hygiene: CheckView[];
};

export type ParsedField = { label: string; value: string };

export type ParsedEntryView = {
  heading: string;
  subheading?: string;
  meta?: string;
  details: string[];
  /** Plain-language notes where the parser was unsure. */
  flags: string[];
};

export type ParsedSectionView = {
  kind: ResumeSectionKind;
  label: string;
  /** Free text (summary) or a list of entries. */
  text?: string;
  entries: ParsedEntryView[];
  /** A comma-separated list (skills, languages). */
  list?: string[];
};

export type ParsedResumeView = {
  contact: ParsedField[];
  contactFlags: string[];
  sections: ParsedSectionView[];
  /** Section kinds that were found but whose contents aren't broken down. */
  otherSections: string[];
};

export type ReportView = {
  scanId: string;
  resumeId: string;
  fileName: string;
  /** e.g. "4 Oct 2026". */
  scannedOn: string;
  /** Deletion date for guest reports, e.g. "11 Oct 2026"; null for account reports. */
  deletesOn: string | null;
  pageCount: number;
  wordCount: number;
  score: number;
  band: AtsBand;
  /** e.g. "Minor improvements". */
  bandDescription: string;
  headline: string;
  topActions: TopActionView[];
  categories: CategoryView[];
  /** Σ weighted points, before rounding to the score. */
  weightedTotal: number;
  strengths: string[];
  issueCounts: { critical: number; major: number; minor: number };
  issueTotal: number;
  issueGroups: IssueGroupView[];
  /** Null when the resume behind the report is no longer stored. */
  keywords: KeywordsView | null;
  parsed: ParsedResumeView | null;
  engineVersion: string;
};
