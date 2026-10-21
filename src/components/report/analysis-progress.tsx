"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Check, WifiOff } from "lucide-react";
import { cn } from "cn";

import { useScanStatus } from "@/hooks/use-scan-status";
import {
  activeStepIndex,
  PROGRESS_ETA,
  PROGRESS_STEP_LABELS,
  progressMessage,
  type ProgressStepKey,
} from "@/lib/report/progress";
import type { ScanStatusResult } from "@/types/api";

import { AnalysisFailed } from "./analysis-failed";

type AnalysisProgressProps = {
  scanId: string;
  resumeId: string;
  fileName: string;
  initial: ScanStatusResult;
  steps: ProgressStepKey[];
};

/**
 * The in-progress results page — docs/PLANNING.md §7.3. Polls the scan's status, shows the
 * current step and a live message, and refreshes into the report once it is complete.
 */
export function AnalysisProgress({
  scanId,
  resumeId,
  fileName,
  initial,
  steps,
}: AnalysisProgressProps) {
  const router = useRouter();
  const state = useScanStatus(scanId, initial);

  // The server renders the report (or the not-found page) once the scan has settled.
  useEffect(() => {
    if (state.status === "complete" || state.missing) router.refresh();
  }, [state.status, state.missing, router]);

  if (state.status === "failed") {
    return (
      <AnalysisFailed
        code={state.error?.code ?? "INTERNAL"}
        resumeId={resumeId}
        fileName={fileName}
      />
    );
  }

  const active = activeStepIndex(steps, state.status, state.stage);

  return (
    <section
      aria-labelledby="analysis-progress-title"
      aria-busy="true"
      className="mx-auto w-full max-w-[560px] rounded-lg border border-border bg-background p-6 sm:p-8"
    >
      <p className="truncate text-sm text-subtle" title={fileName}>
        {fileName}
      </p>
      <h1 id="analysis-progress-title" className="mt-2 type-h3">
        Analyzing your resume
      </h1>

      <ol className="mt-8 grid gap-5" aria-label="Analysis steps">
        {steps.map((key, i) => {
          const step = i < active ? "done" : i === active ? "current" : "upcoming";
          return (
            <li
              key={key}
              aria-current={step === "current" ? "step" : undefined}
              className="flex items-center gap-3"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border",
                  step === "done" && "border-navy bg-navy text-white",
                  step === "current" && "border-navy",
                  step === "upcoming" && "border-border-strong",
                )}
              >
                {step === "done" ? (
                  <Check className="size-3.5" strokeWidth={2.5} />
                ) : step === "current" ? (
                  <span className="size-2 rounded-full bg-navy motion-safe:animate-pulse" />
                ) : null}
              </span>
              <span
                className={cn(
                  "text-sm",
                  step === "upcoming"
                    ? "text-muted-foreground"
                    : "font-medium text-foreground",
                )}
              >
                {PROGRESS_STEP_LABELS[key]}
                {step === "done" ? <span className="sr-only">, done</span> : null}
              </span>
            </li>
          );
        })}
      </ol>

      <p role="status" className="mt-8 text-sm font-medium text-foreground">
        {progressMessage(state.status, state.stage)}
      </p>
      <p className="mt-1 text-sm text-subtle">{PROGRESS_ETA}</p>

      {state.connection === "lost" ? (
        <p className="mt-5 flex gap-2 text-sm text-warning-strong">
          <WifiOff aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          Connection lost. Your progress is saved; we&apos;ll keep checking.
        </p>
      ) : null}
    </section>
  );
}
