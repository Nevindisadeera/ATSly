"use client";

import { useEffect, useState } from "react";

import { fetchScanStatus } from "@/lib/client/scans";
import { isSettled, pollDelay } from "@/lib/report/progress";
import type { ScanStatusResult } from "@/types/api";

export type ScanStatusState = ScanStatusResult & {
  /** "lost" while status requests are failing; polling keeps trying and recovers. */
  connection: "online" | "lost";
  /** The scan no longer exists for this browser (deleted or expired). */
  missing: boolean;
};

/**
 * Polls GET /api/scans/:id/status until the scan completes or fails — docs/PLANNING.md §22:
 * every 1.5 s, then every 3 s after 20 s. Network failures don't stop it.
 */
export function useScanStatus(
  scanId: string,
  initial: ScanStatusResult,
): ScanStatusState {
  const [state, setState] = useState<ScanStatusState>({
    ...initial,
    connection: "online",
    missing: false,
  });

  useEffect(() => {
    if (isSettled(initial.status)) return;
    const controller = new AbortController();
    const started = Date.now();
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      const outcome = await fetchScanStatus(scanId, { signal: controller.signal });
      if (controller.signal.aborted) return;

      if (outcome.ok) {
        setState({ ...outcome.data, connection: "online", missing: false });
        if (isSettled(outcome.data.status)) return;
      } else if (outcome.code === "NOT_FOUND") {
        setState((current) => ({ ...current, connection: "online", missing: true }));
        return;
      } else {
        setState((current) => ({ ...current, connection: "lost" }));
      }
      timer = setTimeout(poll, pollDelay(Date.now() - started));
    };

    timer = setTimeout(poll, pollDelay(0));
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [scanId, initial.status]);

  return state;
}
