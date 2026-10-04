import { UPLOAD_LIMITS, type UploadExtension } from "@/lib/config/limits";
import type { ApiErrorCode } from "@/types/api";

/** The parts of a File that validation needs, so the rules run in the browser and on the server. */
export type FileDescriptor = {
  name: string;
  size: number;
  /** MIME type as reported by the browser; may be empty (common for DOCX on Windows). */
  type: string;
};

export type FileCheck =
  | { ok: true; extension: UploadExtension }
  | {
      ok: false;
      code: Extract<
        ApiErrorCode,
        "UNSUPPORTED_TYPE" | "FILE_TOO_LARGE" | "EMPTY_DOCUMENT"
      >;
      sizeBytes: number;
    };

/** MIME types browsers report for files whose real type they don't know. */
const GENERIC_MIME_TYPES = new Set([
  "",
  "application/octet-stream",
  "binary/octet-stream",
]);

export function fileExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

function isUploadExtension(ext: string): ext is UploadExtension {
  return (UPLOAD_LIMITS.extensions as readonly string[]).includes(ext);
}

/**
 * Checks extension, declared MIME type, emptiness and size. This is a fast first pass for
 * the browser; the server repeats it and also checks the file's actual bytes (Phase 4b).
 */
export function checkResumeFile(file: FileDescriptor): FileCheck {
  const ext = fileExtension(file.name);
  if (!isUploadExtension(ext)) {
    return { ok: false, code: "UNSUPPORTED_TYPE", sizeBytes: file.size };
  }

  const mime = file.type.toLowerCase();
  if (!GENERIC_MIME_TYPES.has(mime) && mime !== UPLOAD_LIMITS.mimeTypes[ext]) {
    return { ok: false, code: "UNSUPPORTED_TYPE", sizeBytes: file.size };
  }

  if (file.size === 0) {
    return { ok: false, code: "EMPTY_DOCUMENT", sizeBytes: 0 };
  }

  if (file.size > UPLOAD_LIMITS.maxBytes) {
    return { ok: false, code: "FILE_TOO_LARGE", sizeBytes: file.size };
  }

  return { ok: true, extension: ext };
}
