/**
 * API contract shared by route handlers and clients — docs/PLANNING.md §22 and §24.
 * Success: `{ data }`. Failure: `{ error: { code, message, details? } }`.
 */

export type ApiErrorCode =
  | "INVALID_INPUT"
  | "FILE_TOO_LARGE"
  | "UNSUPPORTED_TYPE"
  | "EMPTY_DOCUMENT"
  | "ENCRYPTED_DOCUMENT"
  | "PARSE_FAILED"
  | "TOO_MANY_PAGES"
  | "RATE_LIMITED"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "EMAIL_TAKEN"
  | "SERVICE_UNAVAILABLE"
  | "INTERNAL";

export type ApiError = {
  code: ApiErrorCode;
  message: string;
  details?: unknown;
};

export type ApiSuccessBody<T> = { data: T };
export type ApiErrorBody = { error: ApiError };

export type ResumeSectionKind =
  | "contact"
  | "summary"
  | "experience"
  | "education"
  | "skills"
  | "projects"
  | "certifications"
  | "languages"
  | "awards"
  | "publications"
  | "volunteering"
  | "interests"
  | "other";

/**
 * Response of POST /api/resumes. Parsing fields are null or empty until the parser
 * exists (Phase 5); the UI renders whatever is present.
 */
export type ResumeUploadResult = {
  id: string;
  fileName: string;
  extension: "pdf" | "docx";
  sizeBytes: number;
  pageCount: number | null;
  wordCount: number | null;
  sections: { kind: ResumeSectionKind; confidence: number }[];
  warnings: string[];
};

/**
 * Response of GET /api/resumes/:id — the upload summary plus the parsed resume.
 * The raw extracted text is never returned.
 */
export type ResumeDetail = ResumeUploadResult & {
  createdAt: string;
  /** When a guest-owned resume will be deleted; null for account-owned resumes. */
  expiresAt: string | null;
  parsed: import("@/lib/parsing/types").ParsedResume;
};

/** Scan lifecycle — docs/PLANNING.md §16.4. */
export type ScanStatus = "queued" | "running" | "complete" | "failed";

/** Pipeline stage of a queued or running scan; drives the progress UI. */
export type ScanStage = "ats_rules" | "job_matching" | "ai_analysis" | "finalizing";

/** Why a scan failed: an unexpected pipeline error, or no progress for too long. */
export type ScanErrorCode = "INTERNAL" | "TIMEOUT";

export type ScanError = { code: ScanErrorCode; message: string; retryable: boolean };

/** AI analysis outcome. Until AI analysis exists (Phase 10a) every scan is "skipped". */
export type ScanAiStatus = "complete" | "partial" | "skipped" | "failed";

/** Why AI didn't run: switched off, no API key, or today's spend cap reached. */
export type ScanAiSkipReason = "disabled" | "not_configured" | "budget";

/** Everything AI analysis stored on a scan (Phase 10a). Usage and cost stay server-side. */
export type ScanAiRecord = {
  status: ScanAiStatus;
  skippedReason?: ScanAiSkipReason;
  /** AI content rating 0–100, used by check Q07. */
  contentQuality?: number;
  recommendations?: import("@/lib/ai/recommendations").StoredRecommendation[];
  usage?: { promptTokens: number; completionTokens: number; costUsd: number };
  latencyMs?: number;
  /** Quotes the model made from the resume, and how many failed verification. */
  verification?: { checked: number; dropped: number };
};

/** The AI part of a scan as the client sees it. */
export type ScanAiDetail = {
  status: ScanAiStatus;
  skippedReason: ScanAiSkipReason | null;
  contentQuality: number | null;
  recommendations: import("@/lib/ai/recommendations").StoredRecommendation[];
};

/** Denormalized highlights of a complete scan, for lists and the results hero. */
export type ScanSummary = {
  headline: string;
  atsScore: number;
  atsBand: import("@/types/report").AtsBand;
  /** Up to three fixes for the largest deductions, most important first. */
  topActions: string[];
  /** Failed and warned checks by severity; informational ones count as minor. */
  issueCounts: { critical: number; major: number; minor: number };
  /** Present when the scan included a job description. */
  matchScore?: number;
  matchBand?: import("@/types/report").MatchBand;
};

/** Response of POST /api/scans (202). */
export type CreateScanResult = { scanId: string };

/** Response of GET /api/scans/:id/status, polled while a scan runs. */
export type ScanStatusResult = {
  status: ScanStatus;
  stage: ScanStage | null;
  updatedAt: string;
  error: ScanError | null;
};

/** Response of GET /api/scans/:id. The report fields are null until the scan is complete. */
export type ScanDetail = ScanStatusResult & {
  id: string;
  createdAt: string;
  /** When a guest-owned scan will be deleted; null for account-owned scans. */
  expiresAt: string | null;
  engineVersion: string;
  resume: { id: string; fileName: string; pageCount: number; wordCount: number };
  summary: ScanSummary | null;
  ats: import("@/lib/ats/types").AtsReport | null;
  /** The job description this scan was matched against, if any. */
  job: { id: string; title: string | null; company: string | null } | null;
  /** Job match report; null without a job description or until the scan is complete. */
  match: import("@/lib/matching/types").MatchReport | null;
  ai: ScanAiDetail | null;
  durationMs: number | null;
};

/** A scan in a list (dashboard, GET /api/scans): the summary, never the report. */
export type ScanListItem = {
  id: string;
  status: ScanStatus;
  createdAt: string;
  resume: { id: string; fileName: string };
  job: { id: string; title: string | null; company: string | null } | null;
  /** Null until the scan is complete. */
  atsScore: number | null;
  atsBand: import("@/types/report").AtsBand | null;
  matchScore: number | null;
  matchBand: import("@/types/report").MatchBand | null;
  /** The most valuable fix, from the summary. */
  topAction: string | null;
  error: ScanErrorCode | null;
};

/** Response of GET /api/scans. Pass nextCursor back as `cursor` for the next page. */
export type ScanListPage = { items: ScanListItem[]; nextCursor: string | null };

/** Everything the dashboard shows, read in one go (§7.4). */
export type DashboardOverview = {
  /** The newest complete scan. */
  latest: ScanListItem | null;
  stats: {
    /** Complete scans. */
    scans: number;
    bestAtsScore: number | null;
    /** Average job match over scans that had a job description. */
    averageMatch: number | null;
    /** ATS scores of the latest complete scans, oldest first. */
    trend: { date: string; atsScore: number }[];
  };
  recent: ScanListPage;
};

/** The account as settings shows it (§7.6). */
export type AccountDetails = {
  name: string;
  email: string;
  signInMethods: ("password" | "google")[];
  createdAt: string;
};

/** Response of DELETE /api/scans: what was removed. */
export type DeletedData = { scans: number; resumes: number; jobDescriptions: number };
