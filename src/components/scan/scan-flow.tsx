"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useUpload, type UploadState } from "@/hooks/use-upload";
import type { ResumeUploadResult } from "@/types/api";

import {
  EMPTY_JOB_DESCRIPTION,
  jobDescriptionPayload,
  jobDescriptionStatus,
} from "./job-description";
import { JobDescriptionInput } from "./job-description-input";
import { ScanStepper } from "./scan-stepper";
import { StartScanButton } from "./start-scan-button";
import { UploadStep } from "./upload-step";

const JOB_STEP = 1;

type ScanFlowProps = {
  /** An already-uploaded resume to scan again (/scan?resume=…). */
  initialResume?: ResumeUploadResult | null;
  /** The ?resume= id was given but that resume no longer exists for this browser. */
  resumeUnavailable?: boolean;
};

function readyState(resume: ResumeUploadResult): UploadState {
  return {
    phase: "ready",
    file: { name: resume.fileName, size: resume.sizeBytes },
    result: resume,
  };
}

/**
 * The /scan flow — docs/PLANNING.md §7.2: 1 resume, 2 job description (optional), 3 analyze.
 * Owns the upload and job description state so the stepper and Analyze button follow them.
 */
export function ScanFlow({ initialResume, resumeUnavailable = false }: ScanFlowProps) {
  const router = useRouter();
  const upload = useUpload(initialResume ? readyState(initialResume) : undefined);
  const [reusing, setReusing] = useState(Boolean(initialResume));
  const [job, setJob] = useState(EMPTY_JOB_DESCRIPTION);
  const [skipped, setSkipped] = useState(false);

  const resumeId = upload.state.phase === "ready" ? upload.state.result.id : null;
  const payload = skipped ? undefined : jobDescriptionPayload(job);
  const tooLong = !skipped && jobDescriptionStatus(job.text) === "too_long";
  const current = !resumeId ? 0 : payload || skipped ? 2 : JOB_STEP;

  const useDifferentResume = () => {
    setReusing(false);
    upload.reset();
    router.replace("/scan", { scroll: false });
  };

  return (
    <>
      <ScanStepper current={current} skipped={resumeId && skipped ? [JOB_STEP] : []} />
      <h1 className="mt-10 type-h1">
        {reusing ? "Scan against another job" : "Scan your resume"}
      </h1>
      <p className="mt-4 type-lead text-pretty text-subtle">
        {reusing
          ? "Paste a job description to see how well this resume matches it."
          : "Upload your resume to see how applicant tracking systems may read it, and what to fix first."}
      </p>

      {resumeUnavailable ? (
        <p
          role="note"
          className="mt-6 flex gap-2 rounded-md bg-background px-4 py-3 text-sm text-body"
        >
          <Info
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
          />
          That resume is no longer available, so please upload it again.
        </p>
      ) : null}

      <section aria-label="Upload your resume" className="mt-10">
        <UploadStep
          upload={upload}
          replace={
            reusing
              ? { label: "Use a different resume", onReplace: useDifferentResume }
              : undefined
          }
        />
      </section>
      <p className="mt-6 text-sm text-subtle">
        Your original file is read once and not stored.
      </p>

      {resumeId ? (
        <section
          aria-labelledby="job-heading"
          className="mt-10 border-t border-border pt-8"
        >
          <h2 id="job-heading" className="type-h4">
            Job description
          </h2>
          {skipped ? (
            <p className="mt-2 text-sm leading-6 text-subtle">
              Skipped. The report will cover ATS compatibility only.{" "}
              <Button
                variant="link"
                className="h-auto px-0 text-sm"
                onClick={() => setSkipped(false)}
              >
                Add a job description
              </Button>
            </p>
          ) : (
            <>
              <p className="mt-1 text-sm text-subtle">
                Compare your resume with a specific role. You can skip this step.
              </p>
              <JobDescriptionInput
                value={job}
                onChange={setJob}
                label="Job posting"
                className="mt-5"
              />
              <Button
                variant="link"
                className="mt-4 h-auto px-0 text-sm text-subtle hover:text-foreground"
                onClick={() => setSkipped(true)}
              >
                Skip for now
              </Button>
            </>
          )}
        </section>
      ) : null}

      <section
        aria-labelledby="analyze-heading"
        className="mt-10 border-t border-border pt-8"
      >
        <h2 id="analyze-heading" className="type-h4">
          Analyze
        </h2>
        <p className="mt-1 text-sm text-subtle">
          {!resumeId
            ? "Upload your resume first, then start the analysis here."
            : payload
              ? "We'll check ATS compatibility and match your resume against this job. It takes a few seconds."
              : "The report will cover ATS compatibility. It takes a few seconds."}
        </p>
        <StartScanButton
          resumeId={resumeId}
          jobDescription={payload}
          disabled={tooLong}
          label="Analyze resume"
          size="lg"
          className="mt-5"
        />
      </section>
    </>
  );
}
