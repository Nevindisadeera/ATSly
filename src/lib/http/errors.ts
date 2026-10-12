import type { ApiErrorCode } from "@/types/api";

const STATUS: Record<ApiErrorCode, number> = {
  INVALID_INPUT: 400,
  UNAUTHENTICATED: 401,
  NOT_FOUND: 404,
  FILE_TOO_LARGE: 413,
  UNSUPPORTED_TYPE: 415,
  EMPTY_DOCUMENT: 422,
  ENCRYPTED_DOCUMENT: 422,
  PARSE_FAILED: 422,
  TOO_MANY_PAGES: 422,
  RATE_LIMITED: 429,
  INTERNAL: 500,
  SERVICE_UNAVAILABLE: 503,
};

/** Default user-safe messages. Clients show their own copy; these help API consumers and logs. */
const MESSAGES: Record<ApiErrorCode, string> = {
  INVALID_INPUT: "The request is not valid.",
  UNAUTHENTICATED: "Sign in to continue.",
  NOT_FOUND: "Not found.",
  FILE_TOO_LARGE: "The file is larger than the upload limit.",
  UNSUPPORTED_TYPE: "Only PDF and DOCX files are supported.",
  EMPTY_DOCUMENT: "The file contains no readable content.",
  ENCRYPTED_DOCUMENT: "The file is password-protected.",
  PARSE_FAILED: "The file could not be read.",
  TOO_MANY_PAGES: "The document has too many pages.",
  RATE_LIMITED: "Too many requests. Try again later.",
  INTERNAL: "Something went wrong.",
  SERVICE_UNAVAILABLE: "The service is temporarily unavailable.",
};

/**
 * An expected, typed failure. Services throw it; route handlers turn it into an
 * `{ error: { code, message } }` response with the matching HTTP status.
 */
export class AppError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  /** Extra response headers, e.g. Retry-After for rate limits. */
  readonly headers: Record<string, string>;

  constructor(
    code: ApiErrorCode,
    options: { message?: string; headers?: Record<string, string>; cause?: unknown } = {},
  ) {
    super(options.message ?? MESSAGES[code], { cause: options.cause });
    this.name = "AppError";
    this.code = code;
    this.status = STATUS[code];
    this.headers = options.headers ?? {};
  }
}

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}
