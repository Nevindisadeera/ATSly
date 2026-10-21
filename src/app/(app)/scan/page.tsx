import type { Metadata } from "next";

import { Container } from "@/components/layout/container";
import { ScanFlow } from "@/components/scan/scan-flow";
import { currentOwner } from "@/lib/auth/current-owner";
import { isAppError } from "@/lib/http/errors";
import { getResumeForOwner } from "@/lib/services/resume-service";
import type { ResumeUploadResult } from "@/types/api";

export const metadata: Metadata = {
  title: "Scan your resume",
};

/**
 * The resume behind /scan?resume=<id>, for re-scanning against another job (§7.2). Only the
 * upload summary goes to the browser, not the parsed resume.
 */
async function resumeToReuse(id: string | undefined): Promise<ResumeUploadResult | null> {
  if (!id) return null;
  const owner = await currentOwner();
  if (!owner) return null;
  try {
    const resume = await getResumeForOwner(owner, id);
    return {
      id: resume.id,
      fileName: resume.fileName,
      extension: resume.extension,
      sizeBytes: resume.sizeBytes,
      pageCount: resume.pageCount,
      wordCount: resume.wordCount,
      sections: resume.sections,
      warnings: resume.warnings,
    };
  } catch (error) {
    if (isAppError(error) && error.code === "NOT_FOUND") return null;
    throw error;
  }
}

export default async function ScanPage({ searchParams }: PageProps<"/scan">) {
  const { resume } = await searchParams;
  const requested = typeof resume === "string" ? resume : undefined;
  const initialResume = await resumeToReuse(requested);

  return (
    <Container width="reading" className="py-12 md:py-20">
      <ScanFlow
        // A different ?resume= starts the flow afresh.
        key={initialResume?.id ?? "new"}
        initialResume={initialResume}
        resumeUnavailable={Boolean(requested) && !initialResume}
      />
    </Container>
  );
}
