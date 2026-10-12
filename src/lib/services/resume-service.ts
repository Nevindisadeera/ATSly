import { createHash, randomBytes } from "node:crypto";

import { AppError } from "@/lib/http/errors";
import { logger } from "@/lib/logging/logger";
import { checkFileSignature } from "@/lib/security/file-signature";
import { checkResumeFile } from "@/lib/validation/upload";
import type { ResumeUploadResult } from "@/types/api";

export type IncomingResumeFile = {
  name: string;
  /** Declared MIME type from the multipart part; untrusted. */
  type: string;
  bytes: Buffer;
};

/** Strips path segments and control characters from a client-supplied file name. */
export function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const cleaned = base.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return (cleaned || "resume").slice(0, 200);
}

/**
 * Validates an uploaded resume and returns its metadata.
 *
 * Phase 4b: validation only. Text extraction, page counting and sections arrive in Phase 5a;
 * persistence and real ids in Phase 6. Until then `id` is a random 24-character hex value
 * in the same format as a MongoDB ObjectId.
 */
export async function acceptResumeUpload(
  file: IncomingResumeFile,
  context: { requestId: string },
): Promise<ResumeUploadResult> {
  const fileName = sanitizeFileName(file.name);

  // Same rules the browser applied — never trust the client to have run them.
  const check = checkResumeFile({
    name: fileName,
    size: file.bytes.length,
    type: file.type,
  });
  if (!check.ok) {
    throw new AppError(check.code);
  }

  const signature = checkFileSignature(file.bytes, check.extension);
  if (!signature.ok) {
    logger.info("resume.rejected", {
      requestId: context.requestId,
      code: signature.code,
      reason: signature.reason,
      extension: check.extension,
      sizeBytes: file.bytes.length,
    });
    throw new AppError(signature.code);
  }

  const sha256 = createHash("sha256").update(file.bytes).digest("hex");
  logger.info("resume.accepted", {
    requestId: context.requestId,
    extension: check.extension,
    sizeBytes: file.bytes.length,
    sha256Prefix: sha256.slice(0, 12),
  });

  return {
    id: randomBytes(12).toString("hex"),
    fileName,
    extension: check.extension,
    sizeBytes: file.bytes.length,
    pageCount: null,
    wordCount: null,
    sections: [],
    warnings: [],
  };
}
