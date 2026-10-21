"use client";

import { useUpload } from "@/hooks/use-upload";

import { ScanStepper } from "./scan-stepper";
import { StartScanButton } from "./start-scan-button";
import { UploadStep } from "./upload-step";

/** Index of the job description step, which is skipped until job matching exists (Phase 9b). */
const JOB_STEP = 1;

/**
 * The /scan flow — docs/PLANNING.md §7.2: upload a resume, then analyze it. Owns the upload
 * state so the stepper and the Analyze button follow it.
 */
export function ScanFlow() {
  const upload = useUpload();
  const resumeId = upload.state.phase === "ready" ? upload.state.result.id : null;

  return (
    <>
      <ScanStepper current={resumeId ? 2 : 0} skipped={resumeId ? [JOB_STEP] : []} />
      <h1 className="mt-10 type-h1">Scan your resume</h1>
      <p className="mt-4 type-lead text-pretty text-subtle">
        Upload your resume to see how applicant tracking systems may read it, and what to
        fix first.
      </p>

      <section aria-label="Upload your resume" className="mt-10">
        <UploadStep upload={upload} />
      </section>
      <p className="mt-6 text-sm text-subtle">
        Your original file is read once and not stored.
      </p>

      <section
        aria-labelledby="analyze-heading"
        className="mt-10 border-t border-border pt-8"
      >
        <h2 id="analyze-heading" className="type-h4">
          Analyze
        </h2>
        <p className="mt-1 text-sm text-subtle">
          {resumeId
            ? "Your resume is ready. The analysis takes a few seconds."
            : "Upload your resume first, then start the analysis here."}
        </p>
        <StartScanButton
          resumeId={resumeId}
          label="Analyze resume"
          size="lg"
          className="mt-5"
        />
        <p className="mt-4 text-xs leading-5 text-subtle">
          Matching against a job description isn&apos;t available yet, so the report
          covers ATS compatibility, which applies to any role.
        </p>
      </section>
    </>
  );
}
