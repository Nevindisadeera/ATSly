import "server-only";

import { runAtsEngine, type AtsReport } from "@/lib/ats";
import { resumeRepository } from "@/lib/db/repositories/resume-repository";
import { scanRepository } from "@/lib/db/repositories/scan-repository";
import { logger } from "@/lib/logging/logger";
import type { ScanError, ScanErrorCode, ScanSummary } from "@/types/api";

/** User-facing failure details — docs/PLANNING.md §24. Both can be retried with a new scan. */
export const SCAN_FAILURES: Record<ScanErrorCode, ScanError> = {
  INTERNAL: {
    code: "INTERNAL",
    message: "We couldn't complete this analysis.",
    retryable: true,
  },
  TIMEOUT: {
    code: "TIMEOUT",
    message: "This took longer than expected.",
    retryable: true,
  },
};

/** The denormalized summary of a finished ATS report, for lists and the results hero. */
export function summarizeAts(ats: AtsReport): ScanSummary {
  const issueCounts = { critical: 0, major: 0, minor: 0 };
  for (const issue of ats.issues) {
    if (issue.severity === "critical") issueCounts.critical += 1;
    else if (issue.severity === "major") issueCounts.major += 1;
    else issueCounts.minor += 1;
  }
  // Issues are sorted by deduction, so the first fixes are the most valuable ones.
  const topActions = [...new Set(ats.issues.map((issue) => issue.fix).filter(Boolean))]
    .slice(0, 3)
    .map(String);
  return {
    headline: ats.headline,
    atsScore: ats.score,
    atsBand: ats.band,
    topActions,
    issueCounts,
  };
}

/**
 * Runs a scan to completion — docs/PLANNING.md §14. Called after the 202 response is sent.
 * Phase 7b runs the ATS stage only; job matching (9a) and AI analysis (10a) slot in later.
 *
 * It never throws: every failure is recorded on the scan, which the status route reports.
 * A scan is claimed once, so a repeated call does nothing, and a scan that timed out in the
 * meantime is not overwritten by a late result.
 */
export async function runScanPipeline(
  scanId: string,
  context: { requestId?: string } = {},
): Promise<void> {
  const log = { requestId: context.requestId, scanId };
  let createdAt: Date | undefined;
  try {
    const scan = await scanRepository.markRunning(scanId);
    if (!scan) {
      logger.warn("scan.not_claimed", log);
      return;
    }
    createdAt = scan.createdAt;

    const resume = await resumeRepository.findForOwner(scan.owner, scan.resumeId);
    if (!resume) throw new Error("resume_missing");

    const ats = runAtsEngine({
      parsed: resume.parsed,
      layout: resume.extraction.layout,
      format: resume.file.extension,
      text: resume.extraction.text,
    });

    await scanRepository.setStage(scanId, "finalizing");
    const durationMs = Date.now() - createdAt.getTime();
    const completed = await scanRepository.complete(scanId, {
      ats,
      summary: summarizeAts(ats),
      ai: { status: "skipped" },
      durationMs,
    });

    if (completed) {
      logger.info("scan.complete", { ...log, score: ats.score, durationMs });
    } else {
      logger.warn("scan.finished_after_ending", { ...log, durationMs });
    }
  } catch (error) {
    logger.error("scan.failed", {
      ...log,
      errorName: error instanceof Error ? error.name : typeof error,
      errorMessage: error instanceof Error ? error.message : undefined,
    });
    try {
      const durationMs = createdAt ? Date.now() - createdAt.getTime() : undefined;
      await scanRepository.fail(scanId, SCAN_FAILURES.INTERNAL, durationMs);
    } catch (recordError) {
      // The stale sweep will mark it failed when its status is next read.
      logger.error("scan.failure_not_recorded", {
        ...log,
        errorName: recordError instanceof Error ? recordError.name : typeof recordError,
      });
    }
  }
}
