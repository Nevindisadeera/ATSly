import type { ApiErrorBody, ApiErrorCode, ApiSuccessBody } from "@/types/api";

/** Failure codes a client can see: API codes plus transport-level outcomes. */
export type ClientFailureCode = ApiErrorCode | "NETWORK_ERROR" | "ABORTED";

/** A failed API call as the browser sees it. Every client function returns this, never throws. */
export type ClientFailure = {
  ok: false;
  code: ClientFailureCode;
  status: number;
  message?: string;
  /** From the Retry-After header of a 429. */
  retryAfterSeconds?: number;
  /** From X-Request-Id, shown as a reference on unexpected errors. */
  requestId?: string;
};

const KNOWN_CODES = new Set<ApiErrorCode>([
  "INVALID_INPUT",
  "FILE_TOO_LARGE",
  "UNSUPPORTED_TYPE",
  "EMPTY_DOCUMENT",
  "ENCRYPTED_DOCUMENT",
  "PARSE_FAILED",
  "TOO_MANY_PAGES",
  "RATE_LIMITED",
  "UNAUTHENTICATED",
  "NOT_FOUND",
  "SERVICE_UNAVAILABLE",
  "INTERNAL",
]);

/** Maps an HTTP status to a code when the body doesn't carry a recognizable one. */
export function codeForStatus(status: number): ApiErrorCode {
  if (status === 404) return "NOT_FOUND";
  if (status === 413) return "FILE_TOO_LARGE";
  if (status === 415) return "UNSUPPORTED_TYPE";
  if (status === 429) return "RATE_LIMITED";
  if (status === 503) return "SERVICE_UNAVAILABLE";
  if (status === 401) return "UNAUTHENTICATED";
  if (status === 400) return "INVALID_INPUT";
  return "INTERNAL";
}

export function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function isSuccessBody<T>(body: unknown): body is ApiSuccessBody<T> {
  return (
    typeof body === "object" &&
    body !== null &&
    "data" in body &&
    typeof (body as { data: unknown }).data === "object" &&
    (body as { data: unknown }).data !== null
  );
}

export function errorFromBody(body: unknown): ApiErrorBody["error"] | null {
  if (typeof body !== "object" || body === null || !("error" in body)) return null;
  const error = (body as { error: unknown }).error;
  if (typeof error !== "object" || error === null) return null;
  const { code, message } = error as { code?: unknown; message?: unknown };
  if (typeof code !== "string" || !KNOWN_CODES.has(code as ApiErrorCode)) return null;
  return {
    code: code as ApiErrorCode,
    message: typeof message === "string" ? message : "",
  };
}

/** Turns a non-2xx (or malformed) response into a ClientFailure. */
export function failureFrom(
  status: number,
  body: unknown,
  headers?: { get(name: string): string | null },
): ClientFailure {
  const apiError = errorFromBody(body);
  const retryAfter = Number(headers?.get("retry-after"));
  return {
    ok: false,
    status,
    code: apiError?.code ?? codeForStatus(status),
    message: apiError?.message,
    retryAfterSeconds:
      Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined,
    requestId: headers?.get("x-request-id") ?? undefined,
  };
}
