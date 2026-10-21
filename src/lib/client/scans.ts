import type { CreateScanResult, ScanStatusResult } from "@/types/api";

import { failureFrom, isSuccessBody, type ClientFailure } from "./api-response";

export type ClientOutcome<T> = { ok: true; data: T } | ClientFailure;

async function requestJson<T>(url: string, init: RequestInit): Promise<ClientOutcome<T>> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: { Accept: "application/json", ...init.headers },
      cache: "no-store",
    });
  } catch (error) {
    const aborted = error instanceof DOMException && error.name === "AbortError";
    return { ok: false, code: aborted ? "ABORTED" : "NETWORK_ERROR", status: 0 };
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // Not JSON (e.g. a proxy error page); handled as a failure below.
  }
  if (response.ok && isSuccessBody<T>(body)) return { ok: true, data: body.data };
  return failureFrom(response.status, body, response.headers);
}

/** POST /api/scans: starts a scan of an uploaded resume. Never throws. */
export type JobDescriptionPayload = { text: string; title?: string; company?: string };

export function startScan(
  resumeId: string,
  options: { jobDescription?: JobDescriptionPayload; signal?: AbortSignal } = {},
): Promise<ClientOutcome<CreateScanResult>> {
  const body = options.jobDescription
    ? { resumeId, jobDescription: options.jobDescription }
    : { resumeId };
  return requestJson<CreateScanResult>("/api/scans", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: options.signal,
  });
}

/** GET /api/scans/:id/status: polled while a scan runs. Never throws. */
export function fetchScanStatus(
  scanId: string,
  options: { signal?: AbortSignal } = {},
): Promise<ClientOutcome<ScanStatusResult>> {
  return requestJson<ScanStatusResult>(
    `/api/scans/${encodeURIComponent(scanId)}/status`,
    { method: "GET", signal: options.signal },
  );
}
