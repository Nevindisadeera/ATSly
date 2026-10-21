import "server-only";

import { compactResume, jobDescriptionInput } from "@/lib/ai/inputs";
import { PROMPT_VERSION } from "@/lib/ai/prompts";
import { mergeRecommendations } from "@/lib/ai/recommendations";
import type { ContentAnalysis, MatchAssessment } from "@/lib/ai/schemas";
import {
  indexResume,
  verifyContentAnalysis,
  verifyMatchAssessment,
  type VerificationCount,
} from "@/lib/ai/verify";
import { runAtsEngine, type AtsReport } from "@/lib/ats";
import { jobDescriptionRepository } from "@/lib/db/repositories/job-description-repository";
import { resumeRepository } from "@/lib/db/repositories/resume-repository";
import { scanRepository } from "@/lib/db/repositories/scan-repository";
import { logger } from "@/lib/logging/logger";
import {
  matchHeadline,
  runMatchEngine,
  type JobRequirements,
  type MatchReport,
} from "@/lib/matching";
import { mergeRequirements } from "@/lib/matching/merge";
import type { ScanAiRecord, ScanError, ScanErrorCode, ScanSummary } from "@/types/api";

import { availableAiProvider, createAiRun } from "./ai-service";

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

/**
 * The denormalized summary of a finished scan, for lists and the results hero. With a job
 * match, the headline gains the match sentence — §18.6.
 */
export function summarizeAts(ats: AtsReport, match?: MatchReport | null): ScanSummary {
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
    headline: match ? `${ats.headline} ${matchHeadline(match.band)}` : ats.headline,
    atsScore: ats.score,
    atsBand: ats.band,
    topActions,
    issueCounts,
    ...(match ? { matchScore: match.score, matchBand: match.band } : {}),
  };
}

/** Skills automatic matching missed, for the AI to judge. Certifications aren't judged. */
function unmatchedSkills(match: MatchReport) {
  return match.missing
    .filter((m) => m.kind !== "certification")
    .map((m) => ({ name: m.term, importance: m.importance }));
}

const addCounts = (total: VerificationCount, count: VerificationCount) => {
  total.checked += count.checked;
  total.dropped += count.dropped;
};

/**
 * Runs a scan to completion — docs/PLANNING.md §14 and §20. Called after the 202 response.
 * Stages: ATS rules → job matching (with a job description) → AI analysis (when available)
 * → finalizing. AI only ever adds: if it's off, over budget or failing, the scan still
 * completes with the deterministic report and `ai.status` says what happened.
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
    const parsed = resume.parsed;

    const available = await availableAiProvider();
    const ai = "skipped" in available ? null : createAiRun(available, log);
    const compact = ai ? compactResume(parsed) : null;
    const verification: VerificationCount = { checked: 0, dropped: 0 };

    // Job matching: AI extraction (cached per posting) refines the rules extraction.
    let requirements: JobRequirements | null = null;
    let deterministic: MatchReport | null = null;
    if (scan.jobDescriptionId) {
      await scanRepository.setStage(scanId, "job_matching");
      const job = await jobDescriptionRepository.findForOwner(
        scan.owner,
        scan.jobDescriptionId,
      );
      if (!job) throw new Error("job_description_missing");
      requirements = job.extracted;
      if (ai) {
        const extracted = await ai.run(
          "extractJobRequirements",
          { jobDescription: jobDescriptionInput(job.rawText) },
          job.normalizedHash,
        );
        if (extracted) {
          requirements = mergeRequirements(job.extracted, extracted);
          await jobDescriptionRepository.saveExtraction(scan.owner, job.id, {
            extracted: requirements,
            extractionSource: "ai",
            promptVersion: PROMPT_VERSION,
          });
        }
      }
      deterministic = runMatchEngine({ resume: parsed, job: requirements });
    }

    // AI analysis: content quality, and what automatic matching missed. Verified before use.
    let content: ContentAnalysis | null = null;
    let assessment: MatchAssessment | null = null;
    if (ai && compact) {
      await scanRepository.setStage(scanId, "ai_analysis");
      const index = indexResume(parsed, resume.extraction.text);
      const needsAssessment =
        deterministic &&
        requirements &&
        (unmatchedSkills(deterministic).length > 0 ||
          requirements.responsibilities.length > 0);
      const [rawContent, rawAssessment] = await Promise.all([
        ai.run("analyzeContent", { resume: compact }, JSON.stringify(compact)),
        needsAssessment
          ? ai.run("assessMatch", {
              resume: compact,
              requirements: unmatchedSkills(deterministic!),
              responsibilities: requirements!.responsibilities,
            })
          : Promise.resolve(null),
      ]);
      if (rawContent) {
        const verified = verifyContentAnalysis(rawContent, index);
        content = verified.analysis;
        addCounts(verification, verified.count);
      }
      if (rawAssessment) {
        const verified = verifyMatchAssessment(rawAssessment, index);
        assessment = verified.assessment;
        addCounts(verification, verified.count);
      }
    }

    await scanRepository.setStage(scanId, "finalizing");
    // Q07 is the only way AI touches the ATS score: at most 3 points (§18).
    const ats = runAtsEngine(
      {
        parsed,
        layout: resume.extraction.layout,
        format: resume.file.extension,
        text: resume.extraction.text,
      },
      content ? { ai: { contentQuality: content.overallQuality } } : {},
    );
    const match = requirements
      ? runMatchEngine({ resume: parsed, job: requirements, assessment })
      : undefined;
    const recommendations = mergeRecommendations({ ats, match, content, assessment });

    const aiRecord: ScanAiRecord = ai
      ? {
          status: ai.status(),
          ...(content ? { contentQuality: content.overallQuality } : {}),
          recommendations,
          usage: {
            ...ai.usage,
            costUsd: Number(ai.usage.costUsd.toFixed(6)),
          },
          latencyMs: ai.latencyMs(),
          verification,
        }
      : {
          status: "skipped",
          skippedReason: "skipped" in available ? available.skipped : undefined,
          recommendations,
        };

    const durationMs = Date.now() - createdAt.getTime();
    const completed = await scanRepository.complete(scanId, {
      ats,
      ...(match ? { match } : {}),
      summary: summarizeAts(ats, match),
      ai: aiRecord,
      model: ai?.provider.model ?? null,
      promptVersion: ai ? PROMPT_VERSION : null,
      durationMs,
    });

    if (completed) {
      logger.info("scan.complete", {
        ...log,
        score: ats.score,
        matchScore: match?.score,
        aiStatus: aiRecord.status,
        verificationDropped: verification.dropped,
        durationMs,
      });
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
