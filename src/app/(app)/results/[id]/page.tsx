import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Container } from "@/components/layout/container";
import { AnalysisFailed } from "@/components/report/analysis-failed";
import { AnalysisProgress } from "@/components/report/analysis-progress";
import { ReportView } from "@/components/report/report-view";
import { currentOwner } from "@/lib/auth/current-owner";
import type { Owner } from "@/lib/auth/owner";
import { isAppError } from "@/lib/http/errors";
import type { ParsedResume } from "@/lib/parsing/types";
import { buildReportView } from "@/lib/report/build-report-view";
import { progressSteps } from "@/lib/report/progress";
import { configuredAiProvider } from "@/lib/services/ai-service";
import { getResumeForOwner } from "@/lib/services/resume-service";
import { getScanForOwner } from "@/lib/services/scan-service";

export const metadata: Metadata = {
  title: "ATS report",
};

const isNotFound = (error: unknown) => isAppError(error) && error.code === "NOT_FOUND";

/** The parsed resume behind a report, or null once it has been deleted or has expired. */
async function parsedResume(
  owner: Owner,
  resumeId: string,
): Promise<ParsedResume | null> {
  try {
    return (await getResumeForOwner(owner, resumeId)).parsed;
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

/**
 * /results/[id] — docs/PLANNING.md §7.3. Reads the scan through the service (§22): the
 * progress panel while it runs, the failure panel if it failed, the report once complete.
 * Someone else's scan, or no owner cookie, is the same 404 as an unknown id.
 */
export default async function ResultsPage({ params }: PageProps<"/results/[id]">) {
  const { id } = await params;
  const owner = await currentOwner();
  if (!owner) notFound();

  const scan = await getScanForOwner(owner, id).catch((error: unknown) => {
    if (isNotFound(error)) return null;
    throw error;
  });
  if (!scan) notFound();

  if (scan.status === "failed") {
    return (
      <Container width="app" className="py-12 md:py-20">
        <AnalysisFailed
          code={scan.error?.code ?? "INTERNAL"}
          resumeId={scan.resume.id}
          jobDescriptionId={scan.job?.id}
          fileName={scan.resume.fileName}
        />
      </Container>
    );
  }

  if (scan.status !== "complete") {
    return (
      <Container width="app" className="py-12 md:py-20">
        <AnalysisProgress
          scanId={scan.id}
          resumeId={scan.resume.id}
          jobDescriptionId={scan.job?.id}
          fileName={scan.resume.fileName}
          initial={{
            status: scan.status,
            stage: scan.stage,
            updatedAt: scan.updatedAt,
            error: scan.error,
          }}
          // AI review shows its step when a provider is configured; a scan over the daily
          // budget skips it and goes straight to finalizing, which completes every step.
          steps={progressSteps({
            hasJobDescription: scan.job !== null,
            aiEnabled: !("skipped" in configuredAiProvider()),
          })}
        />
      </Container>
    );
  }

  const resume = await parsedResume(owner, scan.resume.id);
  return <ReportView view={buildReportView(scan, resume)} />;
}
