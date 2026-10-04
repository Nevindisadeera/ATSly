"use client";

import { useId, useRef, useState, useSyncExternalStore } from "react";
import { Upload } from "lucide-react";
import { cn } from "cn";

import { UPLOAD_ACCEPT, UPLOAD_LIMITS } from "@/lib/config/limits";
import { formatBytes } from "@/lib/utils/format";

type UploadDropzoneProps = {
  onFile: (file: File) => void;
  /** Called when more than one file is dropped. */
  onMultipleFiles: () => void;
  /** Id of an element describing a current error, linked for screen readers. */
  errorId?: string;
  disabled?: boolean;
  className?: string;
};

const subscribeNoop = () => () => {};

const HELP = `PDF or DOCX · up to ${formatBytes(UPLOAD_LIMITS.maxBytes)} · up to ${UPLOAD_LIMITS.maxPages} pages`;

/**
 * The whole zone is one button, so it works by click, keyboard and screen reader.
 * Drag and drop is an enhancement on top. On small screens the copy becomes "Choose a file".
 */
export function UploadDropzone({
  onFile,
  onMultipleFiles,
  errorId,
  disabled = false,
  className,
}: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const helpId = useId();
  const [dragging, setDragging] = useState(false);
  // dragenter/dragleave fire for child elements too; count depth to know when we truly left.
  const depth = useRef(0);
  // True only after hydration, when React's handlers are attached (used by tests).
  const interactive = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (files.length > 1) {
      onMultipleFiles();
      return;
    }
    onFile(files[0]!);
  };

  return (
    <div
      className={className}
      data-interactive={interactive || undefined}
      onDragEnter={(e) => {
        if (disabled || !e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        depth.current += 1;
        setDragging(true);
      }}
      onDragOver={(e) => {
        if (disabled || !e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }}
      onDragLeave={() => {
        depth.current = Math.max(0, depth.current - 1);
        if (depth.current === 0) setDragging(false);
      }}
      onDrop={(e) => {
        if (disabled) return;
        e.preventDefault();
        depth.current = 0;
        setDragging(false);
        handleFiles(e.dataTransfer.files);
      }}
    >
      <button
        type="button"
        disabled={disabled}
        data-dragging={dragging || undefined}
        aria-describedby={[helpId, errorId].filter(Boolean).join(" ")}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "group flex min-h-40 w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-border-strong bg-background px-6 py-10 text-center transition-colors duration-150 sm:min-h-60",
          "outline-none hover:border-subtle/50 hover:bg-soft focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "data-dragging:border-primary data-dragging:bg-primary-soft",
          "disabled:pointer-events-none disabled:opacity-60",
        )}
      >
        <span
          aria-hidden="true"
          className="flex size-11 items-center justify-center rounded-full border border-border bg-soft text-subtle group-data-dragging:border-primary/30 group-data-dragging:text-primary"
        >
          <Upload className="size-5" strokeWidth={1.75} />
        </span>
        <span className="mt-5 text-base font-medium text-foreground">
          {dragging ? (
            "Release to upload"
          ) : (
            <>
              <span className="sm:hidden">Choose a file</span>
              <span className="hidden sm:inline">
                Drop your resume here, or{" "}
                <span className="text-primary underline-offset-4 group-hover:underline">
                  browse
                </span>
              </span>
            </>
          )}
        </span>
        <span id={helpId} className="mt-2 text-sm text-subtle">
          {HELP}
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={UPLOAD_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        disabled={disabled}
        onChange={(e) => {
          handleFiles(e.currentTarget.files);
          // Allow choosing the same file again after an error.
          e.currentTarget.value = "";
        }}
      />
    </div>
  );
}
