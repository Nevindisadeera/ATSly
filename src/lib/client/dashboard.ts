import type { DeletedData, ScanListPage } from "@/types/api";

import { requestEmpty, requestJson, type ClientOutcome } from "./request";

/** Client calls for the dashboard and settings — docs/PLANNING.md §22. None throw. */

export function fetchScanPage(cursor: string): Promise<ClientOutcome<ScanListPage>> {
  return requestJson<ScanListPage>(`/api/scans?cursor=${encodeURIComponent(cursor)}`, {
    method: "GET",
  });
}

export function deleteScan(id: string) {
  return requestEmpty(`/api/scans/${encodeURIComponent(id)}`, { method: "DELETE" });
}

const CONFIRM = {
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ confirm: "DELETE" }),
};

export function deleteAllData(): Promise<ClientOutcome<DeletedData>> {
  return requestJson<DeletedData>("/api/scans", { method: "DELETE", ...CONFIRM });
}

export function deleteAccount() {
  return requestEmpty("/api/account", { method: "DELETE", ...CONFIRM });
}
