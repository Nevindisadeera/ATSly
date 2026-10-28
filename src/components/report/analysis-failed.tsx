import { CircleAlert } from "lucide-react";

import { StartScanButton } from "@/components/scan/start-scan-button";
import { Button } from "@/components/ui/button";
import { site } from "@/lib/config/site";
import { FAILURE_COPY } from "@/lib/report/progress";
import type { ScanErrorCode } from "@/types/api";

type AnalysisFailedProps = {
  code: ScanErrorCode;
  resumeId: string;
  /** The job the scan was matched against, so retrying keeps it. */
  jobDescriptionId?: string;
  fileName: string;
};

/**
 * A scan that failed or timed out — docs/PLANNING.md §24. Retry starts a new scan of the
 * same resume, against the same job.
 */
export function AnalysisFailed({
  code,
  resumeId,
  jobDescriptionId,
  fileName,
}: AnalysisFailedProps) {
  const copy = FAILURE_COPY[code];
  return (
    <section
      aria-labelledby="analysis-failed-title"
      className="mx-auto w-full max-w-[560px] rounded-lg border border-border bg-background p-6 sm:p-8"
    >
      <span
        aria-hidden="true"
        className="flex size-10 items-center justify-center rounded-md border border-danger/30 bg-danger-soft text-danger-strong"
      >
        <CircleAlert className="size-5" strokeWidth={1.75} />
      </span>
      <p className="mt-5 truncate text-sm text-subtle" title={fileName}>
        {fileName}
      </p>
      <h1 id="analysis-failed-title" className="mt-2 type-h3 text-balance">
        {copy.title}
      </h1>
      <p className="mt-3 text-sm leading-6 text-body">{copy.body}</p>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-start">
        <StartScanButton
          resumeId={resumeId}
          jobDescriptionId={jobDescriptionId}
          label="Try again"
        />
        <Button asChild variant="outline" className="w-full sm:w-fit">
          <a href={`${site.repositoryUrl}/issues/new`} target="_blank" rel="noreferrer">
            Report a problem
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </Button>
      </div>
    </section>
  );
}
