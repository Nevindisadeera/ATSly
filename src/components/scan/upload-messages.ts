import type { UploadErrorCode } from "@/hooks/use-upload";
import { UPLOAD_LIMITS } from "@/lib/config/limits";
import { formatBytes } from "@/lib/utils/format";

export type UploadErrorMessage = {
  /** What happened, in plain words. */
  title: string;
  /** Optional next step for the user. */
  hint?: string;
};

const LIMIT = formatBytes(UPLOAD_LIMITS.maxBytes);

/** User-facing copy for every upload failure — docs/PLANNING.md §24. */
export function uploadErrorMessage(
  code: UploadErrorCode,
  sizeBytes?: number,
): UploadErrorMessage {
  switch (code) {
    case "UNSUPPORTED_TYPE":
      return { title: "That file type isn't supported. Upload a PDF or DOCX." };
    case "FILE_TOO_LARGE":
      return {
        // Quote the size only when it really exceeds the limit; a server-side 413 can be
        // triggered by request overhead on a file that is just under it.
        title:
          sizeBytes !== undefined && sizeBytes > UPLOAD_LIMITS.maxBytes
            ? `This file is ${formatBytes(sizeBytes)}. The limit is ${LIMIT}.`
            : `This file is larger than ${LIMIT}.`,
        hint: "Export a smaller PDF or remove images, then try again.",
      };
    case "TOO_MANY_PAGES":
      return {
        title: `Resumes over ${UPLOAD_LIMITS.maxPages} pages aren't supported.`,
        hint: "Most resumes are one or two pages.",
      };
    case "PARSE_FAILED":
    case "ENCRYPTED_DOCUMENT":
      return {
        title: "We couldn't read this file. It may be corrupted or password-protected.",
        hint: "Try exporting it again from your editor.",
      };
    case "EMPTY_DOCUMENT":
      return {
        title: "This file contains no readable text.",
        hint: "If your resume is a scanned image, export it as a text PDF.",
      };
    case "MULTIPLE_FILES":
      return { title: "Upload one file at a time." };
    case "RATE_LIMITED":
      return {
        title: "You've reached the upload limit for now.",
        hint: "Please wait a little while, then try again.",
      };
    case "NETWORK_ERROR":
      return {
        title: "Connection lost.",
        hint: "Check your connection and try again.",
      };
    case "SERVICE_UNAVAILABLE":
      return {
        title: "We're having trouble right now.",
        hint: "Please try again in a moment.",
      };
    case "INVALID_INPUT":
    case "UNAUTHENTICATED":
    case "NOT_FOUND":
    case "INTERNAL":
    case "ABORTED":
      return {
        title: "Something went wrong on our side.",
        hint: "Please try again.",
      };
  }
}
