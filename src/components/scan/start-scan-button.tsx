"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert } from "lucide-react";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import type { ClientFailure } from "@/lib/client/api-response";
import { startScan, type JobDescriptionPayload } from "@/lib/client/scans";

import { startScanErrorMessage } from "./start-scan-messages";

type StartScanButtonProps = {
  /** The uploaded resume to scan; the button is disabled without one. */
  resumeId: string | null;
  /** Sent with the scan when present (job matching). */
  jobDescription?: JobDescriptionPayload;
  /** Disables the button for reasons the caller explains, e.g. a too-long job description. */
  disabled?: boolean;
  label: string;
  /** Shown with a spinner while the scan starts and the results page loads. */
  pendingLabel?: string;
  variant?: "primary" | "secondary";
  size?: "md" | "lg";
  className?: string;
};

/**
 * Starts a scan (POST /api/scans) and opens its results page. Failures are shown in place,
 * under the button, so the user can retry without losing anything.
 */
export function StartScanButton({
  resumeId,
  jobDescription,
  disabled = false,
  label,
  pendingLabel = "Starting analysis…",
  variant = "primary",
  size = "md",
  className,
}: StartScanButtonProps) {
  const router = useRouter();
  const errorId = useId();
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<ClientFailure | null>(null);

  async function start() {
    if (!resumeId || disabled || pending) return;
    setPending(true);
    setFailure(null);
    const outcome = await startScan(resumeId, { jobDescription });
    if (outcome.ok) {
      // Stay in the pending state until the results page replaces this one.
      router.push(`/results/${outcome.data.scanId}`);
      return;
    }
    setPending(false);
    setFailure(outcome);
  }

  const message = failure ? startScanErrorMessage(failure) : null;

  return (
    <div className={cn("grid gap-3", className)}>
      <Button
        type="button"
        variant={variant}
        size={size}
        loading={pending}
        disabled={!resumeId || disabled}
        aria-describedby={message ? errorId : undefined}
        onClick={start}
        className="w-full sm:w-fit"
      >
        {pending ? pendingLabel : label}
      </Button>
      {message ? (
        <p id={errorId} role="alert" className="flex gap-2 text-sm">
          <CircleAlert
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0 text-danger"
          />
          <span>
            <span className="font-medium text-danger-strong">{message.title}</span>{" "}
            <span className="text-subtle">{message.hint}</span>
          </span>
        </p>
      ) : null}
    </div>
  );
}
