import type { CategoryKey, CheckStatus, Evidence } from "@/lib/ats/types";
import type { ResumeSectionKind } from "@/types/api";
import type {
  FitStatus,
  Importance,
  MatchComponentKey,
  TermKind,
} from "@/lib/matching/types";
import type { AtsBand, MatchBand, Severity } from "@/types/report";

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
  /** The job this scan was matched against. */
  job: { title: string | null; company: string | null } | null;
  /** Null when the scan had no job description. */
  match: MatchView | null;
  /** The resume is still stored, so it can be scanned again against another job. */
  canRescan: boolean;
  recommendations: RecommendationsView;
};

export type RecommendationPriority = "high" | "medium" | "low";

export type RecommendationView = {
  id: string;
  /** Element id of the card, used by "Top 3 actions" links. */
  anchor: string;
  priority: RecommendationPriority;
  /** e.g. "Content", "Job match". */
  categoryLabel: string;
  title: string;
  detail: string;
  /** The user's own text, quoted (verified to be in the resume). */
  before: string | null;
  /** A suggested rewrite of `before`, or new text to add. */
  after: string | null;
  /** Placeholders in the rewrite the user must fill in, e.g. "[X %]". */
  placeholders: string[];
  /** Where in the resume, e.g. "Experience › Northwind Payments › bullet 2". */
  location: string | null;
  source: "rules" | "ai";
  /** "AI suggestion", "From the checks" or "From the job match". */
  sourceLabel: string;
  /** The check a rules recommendation comes from. */
  checkAnchor: string | null;
  /** Where the reasoning behind it is shown: its check, or the job match section. */
  related: { href: string; label: string } | null;
};

/** How to run the analysis again: a new scan of the same resume, or the scan page. */
export type RetryView =
  { kind: "scan"; resumeId: string } | { kind: "link"; href: string; hint: string };

export type RecommendationsNotice = {
  /** warning: something failed. info: AI didn't run, by design or because of a limit. */
  tone: "warning" | "info";
  title: string;
  body: string;
  retry: RetryView | null;
};

export type RecommendationsView = {
  items: RecommendationView[];
  counts: Record<RecommendationPriority, number>;
  /** Explains AI that failed or didn't run; null when everything ran. */
  notice: RecommendationsNotice | null;
  /** Shown instead of the list when there is nothing to recommend. */
  empty: { title: string; description: string; retry: RetryView | null } | null;
};

export type MatchComponentView = {
  key: MatchComponentKey;
  label: string;
  weight: number;
  /** Effective weight after redistribution, to one decimal (12.5); 0 when not assessed. */
  effectiveWeight: number;
  score: number | null;
  note?: string;
};

export type MatchedTermView = {
  term: string;
  kind: TermKind;
  importance: Importance;
  /** "Exact match", "Matched as a related term", "Matched by AI" or "Partly matched by AI". */
  how: string;
  /** Counted as half: the resume shows related experience rather than a clear match. */
  partial: boolean;
  /** The match came from AI review; its evidence was checked against the resume. */
  byAi: boolean;
  evidence?: string;
  location?: string;
};

export type MissingTermView = { term: string; kind: TermKind; suggestion: string };

export type FitRowView = {
  key: "experience" | "education" | "title";
  label: string;
  status: FitStatus;
  /** "Meets", "Close", "Gap", "Exceeds" or "Not specified". */
  statusLabel: string;
  detail: string;
};

export type MatchView = {
  score: number;
  band: MatchBand;
  components: MatchComponentView[];
  /** Some components couldn't be assessed and their weight was shared out. */
  redistributed: boolean;
  matchedRequired: MatchedTermView[];
  matchedPreferred: MatchedTermView[];
  missingRequired: MissingTermView[];
  missingPreferred: MissingTermView[];
  fit: FitRowView[];
  honestyFlags: string[];
  /** Responsibilities the resume clearly shows, with the quote that shows it. */
  strongMatches: { requirement: string; evidence: string; location?: string }[];
  weakMatches: { requirement: string; reason: string }[];
  /** Why matching may have missed skills worded differently; null when AI review ran. */
  precisionNote: string | null;
};
