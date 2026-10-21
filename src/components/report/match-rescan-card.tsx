"use client";

import { useState } from "react";
import Link from "next/link";
import { Briefcase } from "lucide-react";

import {
  EMPTY_JOB_DESCRIPTION,
  jobDescriptionPayload,
} from "@/components/scan/job-description";
import { JobDescriptionInput } from "@/components/scan/job-description-input";
import { StartScanButton } from "@/components/scan/start-scan-button";

/**
 * Job match for a report without a job description — docs/PLANNING.md §7.3, section 7:
 * paste a posting here to start a new scan of the same resume.
 */
export function MatchRescanCard({
  resumeId,
  canRescan,
}: {
  resumeId: string;
  canRescan: boolean;
}) {
  const [job, setJob] = useState(EMPTY_JOB_DESCRIPTION);
  const payload = jobDescriptionPayload(job);

  return (
    <div className="mt-6 rounded-lg border border-border bg-background p-6">
      <div className="flex gap-3">
        <Briefcase
          aria-hidden="true"
          className="mt-0.5 size-5 shrink-0 text-muted-foreground"
        />
        <div>
          <h3 className="type-h4">Match this resume against a job</h3>
          <p className="mt-1 text-sm leading-6 text-subtle">
            {canRescan
              ? "Paste a job posting to see how well this resume matches it. This starts a new scan of the same resume."
              : "The resume behind this report is no longer stored. Upload it again to match it against a job."}
          </p>
        </div>
      </div>
      {canRescan ? (
        <>
          <JobDescriptionInput
            value={job}
            onChange={setJob}
            label="Job posting"
            className="mt-6"
          />
          <StartScanButton
            resumeId={resumeId}
            jobDescription={payload}
            disabled={!payload}
            label="Match against this job"
            className="mt-6"
          />
        </>
      ) : (
        <Link
          href="/scan"
          className="mt-4 inline-flex rounded-sm text-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Upload a resume
        </Link>
      )}
    </div>
  );
}
