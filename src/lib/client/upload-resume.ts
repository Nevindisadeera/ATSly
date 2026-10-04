import type {
  ApiErrorBody,
  ApiErrorCode,
  ApiSuccessBody,
  ResumeUploadResult,
} from "@/types/api";

/** Failure codes a client can see: API codes plus transport-level outcomes. */
export type UploadFailureCode = ApiErrorCode | "NETWORK_ERROR" | "ABORTED";

export type UploadOutcome =
  | { ok: true; data: ResumeUploadResult }
  | { ok: false; code: UploadFailureCode; status: number; message?: string };

type UploadOptions = {
  /** Called with 0–100 while the request body is being sent. */
  onProgress?: (percent: number) => void;
  /** Called once all bytes are sent and the server is processing the file. */
  onUploaded?: () => void;
  signal?: AbortSignal;
  endpoint?: string;
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
function codeForStatus(status: number): ApiErrorCode {
  if (status === 413) return "FILE_TOO_LARGE";
  if (status === 415) return "UNSUPPORTED_TYPE";
  if (status === 429) return "RATE_LIMITED";
  if (status === 503) return "SERVICE_UNAVAILABLE";
  if (status === 401) return "UNAUTHENTICATED";
  if (status === 400) return "INVALID_INPUT";
  return "INTERNAL";
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function isSuccessBody(body: unknown): body is ApiSuccessBody<ResumeUploadResult> {
  return (
    typeof body === "object" &&
    body !== null &&
    "data" in body &&
    typeof (body as { data: unknown }).data === "object" &&
    (body as { data: unknown }).data !== null
  );
}

function errorFromBody(body: unknown): ApiErrorBody["error"] | null {
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

/**
 * Uploads a resume to POST /api/resumes as multipart form data.
 * Uses XMLHttpRequest because fetch cannot report upload progress.
 * Never throws: every outcome, including network failure and cancellation, is returned.
 */
export function uploadResume(
  file: File,
  options: UploadOptions = {},
): Promise<UploadOutcome> {
  const { onProgress, onUploaded, signal, endpoint = "/api/resumes" } = options;

  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve({ ok: false, code: "ABORTED", status: 0 });
      return;
    }

    const xhr = new XMLHttpRequest();
    const form = new FormData();
    form.append("file", file, file.name);

    const onAbortSignal = () => xhr.abort();
    signal?.addEventListener("abort", onAbortSignal, { once: true });
    const cleanup = () => signal?.removeEventListener("abort", onAbortSignal);

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress?.(Math.min(100, Math.round((event.loaded / event.total) * 100)));
      }
    });
    xhr.upload.addEventListener("load", () => {
      onProgress?.(100);
      onUploaded?.();
    });

    xhr.addEventListener("load", () => {
      cleanup();
      const body = parseJson(xhr.responseText);
      if (xhr.status >= 200 && xhr.status < 300 && isSuccessBody(body)) {
        resolve({ ok: true, data: body.data });
        return;
      }
      const apiError = errorFromBody(body);
      resolve({
        ok: false,
        status: xhr.status,
        code: apiError?.code ?? codeForStatus(xhr.status),
        message: apiError?.message,
      });
    });
    xhr.addEventListener("error", () => {
      cleanup();
      resolve({ ok: false, code: "NETWORK_ERROR", status: 0 });
    });
    xhr.addEventListener("abort", () => {
      cleanup();
      resolve({ ok: false, code: "ABORTED", status: 0 });
    });

    xhr.open("POST", endpoint);
    xhr.setRequestHeader("Accept", "application/json");
    xhr.send(form);
  });
}
