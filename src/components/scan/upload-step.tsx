"use client";

import { useEffect, useId, useRef } from "react";
import { CircleAlert } from "lucide-react";

import { useUpload } from "@/hooks/use-upload";

import { FileSummaryCard } from "./file-summary-card";
import { UploadDropzone } from "./upload-dropzone";
import { uploadErrorMessage } from "./upload-messages";

/**
 * Step 1 of the scan flow. Client-side validation errors stay under the dropzone so the
 * user can try again in place; once a file is accepted, the summary card takes over.
 */
export function UploadStep() {
  const { state, select, reject, cancel, reset } = useUpload();
  const errorId = useId();
  const dropzoneWrapper = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLElement>(null);

  const showDropzone =
    state.phase === "idle" || (state.phase === "error" && state.source === "client");
  const inlineError =
    state.phase === "error" && state.source === "client"
      ? uploadErrorMessage(state.code, state.file?.size)
      : null;

  // Keep focus where the user is: on the card when it appears, back on the dropzone when it returns.
  const previouslyShowedDropzone = useRef(showDropzone);
  useEffect(() => {
    if (previouslyShowedDropzone.current === showDropzone) return;
    previouslyShowedDropzone.current = showDropzone;
    if (showDropzone) dropzoneWrapper.current?.querySelector("button")?.focus();
    else card.current?.focus();
  }, [showDropzone]);

  if (showDropzone) {
    return (
      <div ref={dropzoneWrapper}>
        <UploadDropzone
          onFile={select}
          onMultipleFiles={() => reject("MULTIPLE_FILES")}
          errorId={inlineError ? errorId : undefined}
        />
        {inlineError ? (
          <p id={errorId} role="alert" className="mt-3 flex gap-2 text-sm">
            <CircleAlert
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0 text-danger"
            />
            <span>
              <span className="font-medium text-danger-strong">{inlineError.title}</span>
              {inlineError.hint ? (
                <span className="text-subtle"> {inlineError.hint}</span>
              ) : null}
            </span>
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <FileSummaryCard
      ref={card}
      state={state as Exclude<typeof state, { phase: "idle" }>}
      onCancel={cancel}
      onReplace={reset}
      errorId={errorId}
    />
  );
}
