import type { CreateScanResult, ScanStatusResult } from "@/types/api";

import { requestJson, type ClientOutcome } from "./request";

export type { ClientOutcome };

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
