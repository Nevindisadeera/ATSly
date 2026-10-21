import type { ScanErrorCode, ScanStage, ScanStatus } from "@/types/api";

/**
 * In-progress view of a scan — docs/PLANNING.md §7.3 and Appendix B. Pure and client-safe.
 */

export type ProgressStepKey = "reading" | "structure" | "matching" | "content";

export const PROGRESS_STEP_LABELS: Record<ProgressStepKey, string> = {
  reading: "Reading your resume",
  structure: "Checking structure",
  matching: "Comparing against the job",
  content: "Evaluating content",
};

/** Steps shown for a scan. Job matching and AI content review only appear when they run. */
export function progressSteps(options: {
  hasJobDescription: boolean;
  aiEnabled: boolean;
}): ProgressStepKey[] {
  return [
    "reading",
    "structure",
    ...(options.hasJobDescription ? (["matching"] as const) : []),
    ...(options.aiEnabled ? (["content"] as const) : []),
  ];
}

const STAGE_STEP: Record<ScanStage, ProgressStepKey | "done"> = {
  ats_rules: "structure",
  job_matching: "matching",
  ai_analysis: "content",
  finalizing: "done",
};

/**
 * Index of the step in progress. Equal to steps.length when every step is done (the
 * report is being prepared), so all steps render as complete.
 */
export function activeStepIndex(
  steps: ProgressStepKey[],
  status: ScanStatus,
  stage: ScanStage | null,
): number {
  if (status === "complete") return steps.length;
  if (status === "queued" || stage === null) return 0;
  const step = STAGE_STEP[stage];
  if (step === "done") return steps.length;
  const index = steps.indexOf(step);
  return index === -1 ? 0 : index;
}

/** The live message under the stepper. */
export function progressMessage(status: ScanStatus, stage: ScanStage | null): string {
  if (status === "complete" || stage === "finalizing") return "Preparing your report…";
  switch (stage) {
    case "ats_rules":
      return "Checking your resume structure…";
    case "job_matching":
      return "Comparing against the job description…";
    case "ai_analysis":
      return "Evaluating content quality…";
    default:
      return "Reading your resume…";
  }
}

export const PROGRESS_ETA = "Usually under 30 seconds.";

/** Poll every 1.5 s, then every 3 s once a scan has run for 20 s — §22. */
export function pollDelay(elapsedMs: number): number {
  return elapsedMs < 20_000 ? 1_500 : 3_000;
}

export function isSettled(status: ScanStatus): boolean {
  return status === "complete" || status === "failed";
}

export const FAILURE_COPY: Record<ScanErrorCode, { title: string; body: string }> = {
  INTERNAL: {
    title: "We couldn't complete this analysis.",
    body: "Your resume is still saved. Try the analysis again; it usually takes a few seconds.",
  },
  TIMEOUT: {
    title: "This took longer than expected.",
    body: "The analysis stopped before it finished. Your resume is still saved, so you can try again.",
  },
};
