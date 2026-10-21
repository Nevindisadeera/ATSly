import type { ResumeUploadResult } from "@/types/api";

import {
  codeForStatus,
  errorFromBody,
  isSuccessBody,
  parseJson,
  type ClientFailureCode,
} from "./api-response";

/** Failure codes a client can see: API codes plus transport-level outcomes. */
export type UploadFailureCode = ClientFailureCode;

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
      if (
        xhr.status >= 200 &&
        xhr.status < 300 &&
        isSuccessBody<ResumeUploadResult>(body)
      ) {
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
