"use client";

import { CircleAlert, CircleCheck, FileText, Info } from "lucide-react";
import { cn } from "cn";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { UploadState } from "@/hooks/use-upload";
import { formatBytes, pluralize } from "@/lib/utils/format";
import type { ResumeSectionKind } from "@/types/api";

import { uploadErrorMessage } from "./upload-messages";

type ActiveState = Exclude<UploadState, { phase: "idle" }>;

type FileSummaryCardProps = {
  state: ActiveState;
  onCancel: () => void;
  onReplace: () => void;
  /** Id for the error text so the dropzone or card can reference it. */
  errorId?: string;
  /** Receives focus when the card replaces the dropzone. */
  ref?: React.Ref<HTMLElement>;
  className?: string;
};

const SECTION_LABELS: Partial<Record<ResumeSectionKind, string>> = {
  summary: "Summary",
  experience: "Experience",
  education: "Education",
  skills: "Skills",
  projects: "Projects",
  certifications: "Certifications",
  languages: "Languages",
};

function statusLine(state: ActiveState): string {
  switch (state.phase) {
    case "uploading":
      return `Uploading ${state.progress}%`;
    case "processing":
      return "Reading your resume…";
    case "ready":
      return "Ready";
    case "error":
      return "Upload failed";
  }
}

/** Upload and parse feedback for the selected file. Replaces the dropzone once a file is chosen. */
export function FileSummaryCard({
  state,
  onCancel,
  onReplace,
  errorId,
  ref,
  className,
}: FileSummaryCardProps) {
  const file = state.file;
  const busy = state.phase === "uploading" || state.phase === "processing";
  const error =
    state.phase === "error" ? uploadErrorMessage(state.code, file?.size) : null;
  const result = state.phase === "ready" ? state.result : null;

  const details = result
    ? [
        result.pageCount !== null ? pluralize(result.pageCount, "page") : null,
        result.wordCount !== null ? pluralize(result.wordCount, "word") : null,
      ].filter(Boolean)
    : [];

  return (
    <section
      ref={ref}
      tabIndex={-1}
      aria-label="Selected file"
      aria-busy={busy || undefined}
      className={cn(
        "rounded-lg border border-border bg-background p-5 outline-none sm:p-6",
        className,
      )}
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-4 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
        <span
          aria-hidden="true"
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-md border",
            state.phase === "error"
              ? "border-danger/30 bg-danger-soft text-danger-strong"
              : "border-border bg-soft text-subtle",
          )}
        >
          <FileText className="size-5" strokeWidth={1.75} />
        </span>

        <div className="min-w-0">
          <p className="truncate font-medium text-foreground" title={file?.name}>
            {file?.name ?? "No file selected"}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-subtle">
            {file ? <span>{formatBytes(file.size)}</span> : null}
            {file ? <span aria-hidden="true">·</span> : null}
            <span
              role="status"
              aria-live="polite"
              className={cn(
                "inline-flex items-center gap-1",
                state.phase === "ready" && "text-success-strong",
                state.phase === "error" && "text-danger-strong",
              )}
            >
              {state.phase === "ready" ? (
                <CircleCheck aria-hidden="true" className="size-3.5" />
              ) : null}
              {statusLine(state)}
            </span>
            {details.length > 0 ? (
              <>
                <span aria-hidden="true">·</span>
                <span>{details.join(" · ")}</span>
              </>
            ) : null}
          </p>
        </div>

        {/* Below the file name on phones so the name keeps the full width. */}
        <div className="col-start-2 mt-2 -ml-3 sm:col-start-3 sm:row-start-1 sm:mt-0 sm:ml-0">
          {busy ? (
            <Button variant="ghost" size="sm" onClick={onCancel}>
              Cancel
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={onReplace}>
              {state.phase === "error" ? "Choose another file" : "Replace"}
            </Button>
          )}
        </div>
      </div>

      {state.phase === "uploading" ? (
        <Progress value={state.progress} aria-label="Upload progress" className="mt-5" />
      ) : null}

      {state.phase === "processing" ? (
        <div
          aria-hidden="true"
          className="relative mt-5 h-1 w-full overflow-hidden rounded-full bg-track"
        >
          <span className="absolute inset-y-0 left-0 w-1/3 animate-indeterminate rounded-full bg-primary motion-reduce:w-full motion-reduce:animate-none motion-reduce:opacity-40" />
        </div>
      ) : null}

      {result && result.sections.length > 0 ? (
        <ul aria-label="Sections found" className="mt-5 flex flex-wrap gap-2">
          {result.sections
            .filter((s) => SECTION_LABELS[s.kind])
            .map((s) => (
              <li
                key={s.kind}
                className="inline-flex h-7 items-center gap-1.5 rounded-sm border border-border bg-soft px-2.5 text-sm text-foreground"
              >
                <CircleCheck
                  aria-hidden="true"
                  className="size-3.5 text-success-strong"
                />
                {SECTION_LABELS[s.kind]}
              </li>
            ))}
        </ul>
      ) : null}

      {result && result.warnings.length > 0 ? (
        <ul className="mt-5 grid gap-2">
          {result.warnings.map((warning) => (
            <li
              key={warning}
              className="flex gap-2 rounded-md bg-soft px-3 py-2.5 text-sm text-subtle"
            >
              <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              {warning}
            </li>
          ))}
        </ul>
      ) : null}

      {error ? (
        <div id={errorId} className="mt-5 flex gap-2.5 text-sm">
          <CircleAlert
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0 text-danger"
          />
          <p>
            <span className="font-medium text-danger-strong">{error.title}</span>
            {error.hint ? <span className="text-subtle"> {error.hint}</span> : null}
          </p>
        </div>
      ) : null}
    </section>
  );
}
