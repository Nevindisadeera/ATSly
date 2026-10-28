import "server-only";

import { ENGINE_VERSION } from "@/lib/ats";
import type { Owner } from "@/lib/auth/owner";
import { jobDescriptionRepository } from "@/lib/db/repositories/job-description-repository";
import { resumeRepository } from "@/lib/db/repositories/resume-repository";
import { scanRepository, type StoredScan } from "@/lib/db/repositories/scan-repository";
import { AppError } from "@/lib/http/errors";
import { logger } from "@/lib/logging/logger";
import type { CreateScanInput } from "@/lib/validation/scan";
import type { CreateScanResult, ScanDetail, ScanStatusResult } from "@/types/api";

import { acceptJobDescription } from "./job-service";
import { guestExpiry } from "./retention";
import { SCAN_FAILURES } from "./scan-pipeline";

/** A queued or running scan with no progress for this long has stalled — §22. */
export const STALE_AFTER_MS = 90_000;

type Context = { requestId: string; owner: Owner };

/**
 * Creates a queued scan of one of the owner's resumes, optionally against a job
 * description. The caller starts the pipeline (after the response is sent) with the id.
 */
export async function createScan(
  input: CreateScanInput,
  context: Context,
): Promise<CreateScanResult> {
  const { owner } = context;
  const resume = await resumeRepository.findForOwner(owner, input.resumeId);
  if (!resume) throw new AppError("NOT_FOUND");

  const expiresAt = guestExpiry(owner);
  // A guest's resume stays as long as its newest scan.
  if (expiresAt) await resumeRepository.extendExpiry(owner, resume.id, expiresAt);

  const job = input.jobDescription
    ? await acceptJobDescription(input.jobDescription, context)
    : input.jobDescriptionId
      ? await savedJobDescription(owner, input.jobDescriptionId, expiresAt)
      : null;

  const scan = await scanRepository.create({
    owner,
    expiresAt,
    resumeId: resume.id,
    jobDescriptionId: job?.id ?? null,
    jobSnapshot: job ? { title: job.title, company: job.company } : null,
    engineVersion: ENGINE_VERSION,
    resumeSnapshot: {
      fileName: resume.file.originalName,
      pageCount: resume.file.pageCount,
      wordCount: resume.extraction.wordCount,
    },
  });

  logger.info("scan.created", {
    requestId: context.requestId,
    scanId: scan.id,
    resumeId: resume.id,
    jobDescriptionId: job?.id,
    ownerType: owner.type,
  });
  return { scanId: scan.id };
}

/** A job description the owner pasted before; a guest's is kept as long as the new scan. */
async function savedJobDescription(owner: Owner, id: string, expiresAt: Date | null) {
  const job = await jobDescriptionRepository.findForOwner(owner, id);
  if (!job) throw new AppError("NOT_FOUND");
  if (expiresAt) await jobDescriptionRepository.extendExpiry(owner, id, expiresAt);
  return job;
}

export async function getScanStatusForOwner(
  owner: Owner,
  id: string,
): Promise<ScanStatusResult> {
  return toStatus(await readScan(owner, id));
}

export async function getScanForOwner(owner: Owner, id: string): Promise<ScanDetail> {
  const scan = await readScan(owner, id);
  return {
    ...toStatus(scan),
    id: scan.id,
    createdAt: scan.createdAt.toISOString(),
    expiresAt: scan.expiresAt?.toISOString() ?? null,
    engineVersion: scan.engineVersion,
    resume: { id: scan.resumeId, ...scan.resumeSnapshot },
    summary: scan.summary,
    ats: scan.ats,
    job: scan.jobDescriptionId
      ? {
          id: scan.jobDescriptionId,
          title: scan.jobSnapshot?.title ?? null,
          company: scan.jobSnapshot?.company ?? null,
        }
      : null,
    match: scan.match,
    ai: scan.ai
      ? {
          status: scan.ai.status,
          skippedReason: scan.ai.skippedReason ?? null,
          contentQuality: scan.ai.contentQuality ?? null,
          recommendations: scan.ai.recommendations ?? [],
        }
      : null,
    durationMs: scan.durationMs,
  };
}

/** Reads a scan for its owner (404 otherwise), applying the stale sweep on the way. */
async function readScan(owner: Owner, id: string): Promise<StoredScan> {
  const scan = await scanRepository.findForOwner(owner, id);
  if (!scan) throw new AppError("NOT_FOUND");
  return sweepIfStale(owner, scan);
}

/**
 * The stale sweep — docs/PLANNING.md §22. There is no queue to notice a pipeline that died
 * (for example when the function instance was stopped), so reading a stalled scan fails it.
 */
async function sweepIfStale(owner: Owner, scan: StoredScan): Promise<StoredScan> {
  if (scan.status !== "queued" && scan.status !== "running") return scan;
  const cutoff = new Date(Date.now() - STALE_AFTER_MS);
  if (scan.updatedAt >= cutoff) return scan;

  const failed = await scanRepository.failIfStale(
    owner,
    scan.id,
    cutoff,
    SCAN_FAILURES.TIMEOUT,
  );
  if (failed) {
    logger.warn("scan.timed_out", {
      scanId: scan.id,
      stage: scan.stage,
      idleMs: Date.now() - scan.updatedAt.getTime(),
    });
    return failed;
  }
  // It progressed or ended between the two reads; return its current state.
  return (await scanRepository.findForOwner(owner, scan.id)) ?? scan;
}

function toStatus(scan: StoredScan): ScanStatusResult {
  return {
    status: scan.status,
    stage: scan.stage,
    updatedAt: scan.updatedAt.toISOString(),
    error: scan.error,
  };
}
