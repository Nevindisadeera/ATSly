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
  | "NOT_FOUND"
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
