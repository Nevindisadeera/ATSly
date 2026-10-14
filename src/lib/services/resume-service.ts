import { createHash, randomBytes } from "node:crypto";

import { UPLOAD_LIMITS } from "@/lib/config/limits";
import { AppError } from "@/lib/http/errors";
import { logger } from "@/lib/logging/logger";
import {
  analyzeDocument,
  ParseError,
  type DocumentAnalysis,
  type ParsedResume,
} from "@/lib/parsing";
import { checkFileSignature } from "@/lib/security/file-signature";
import { checkResumeFile } from "@/lib/validation/upload";
import type { ResumeUploadResult } from "@/types/api";

/** Parsing budget; the route's maxDuration leaves headroom above this. */
const PARSE_TIMEOUT_MS = 15_000;

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
 * Validates and parses an uploaded resume, returning a summary for the upload step.
 * Persistence and real ids arrive in Phase 6; until then `id` is a random 24-character
 * hex value in the same format as a MongoDB ObjectId.
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

  const started = Date.now();
  let analysis: DocumentAnalysis;
  try {
    analysis = await analyzeDocument(file.bytes, check.extension, {
      maxPages: UPLOAD_LIMITS.maxPages,
      asOf: new Date(),
      timeoutMs: PARSE_TIMEOUT_MS,
    });
  } catch (error) {
    if (error instanceof ParseError) {
      logger.info("resume.rejected", {
        requestId: context.requestId,
        code: error.code,
        reason: error.reason,
        extension: check.extension,
        sizeBytes: file.bytes.length,
      });
      throw new AppError(error.code);
    }
    // An unexpected parser failure on unusual input is still "we couldn't read this file".
    logger.error("resume.parse_crashed", {
      requestId: context.requestId,
      extension: check.extension,
      errorName: error instanceof Error ? error.name : typeof error,
    });
    throw new AppError("PARSE_FAILED", { cause: error });
  }

  const { parsed, extraction, warnings } = analysis;
  const sha256 = createHash("sha256").update(file.bytes).digest("hex");
  logger.info("resume.accepted", {
    requestId: context.requestId,
    extension: check.extension,
    sizeBytes: file.bytes.length,
    sha256Prefix: sha256.slice(0, 12),
    pages: extraction.pageCount,
    words: parsed.stats.wordCount,
    sections: parsed.sections.length,
    parseMs: Date.now() - started,
  });

  return {
    id: randomBytes(12).toString("hex"),
    fileName,
    extension: check.extension,
    sizeBytes: file.bytes.length,
    pageCount: extraction.pageCount,
    wordCount: parsed.stats.wordCount,
    sections: summarizeSections(parsed.sections),
    warnings,
  };
}

/** One entry per section kind (excluding contact), keeping the highest confidence. */
function summarizeSections(
  sections: ParsedResume["sections"],
): ResumeUploadResult["sections"] {
  const best = new Map<ParsedResume["sections"][number]["kind"], number>();
  for (const s of sections) {
    if (s.kind === "contact") continue;
    best.set(s.kind, Math.max(best.get(s.kind) ?? 0, s.confidence));
  }
  return [...best.entries()].map(([kind, confidence]) => ({ kind, confidence }));
}
