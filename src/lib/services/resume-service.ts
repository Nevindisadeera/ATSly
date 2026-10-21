import "server-only";

import { createHash } from "node:crypto";

import type { Owner } from "@/lib/auth/owner";
import { UPLOAD_LIMITS } from "@/lib/config/limits";
import { MAX_STORED_TEXT } from "@/lib/db/models/resume";
import {
  resumeRepository,
  type StoredResume,
} from "@/lib/db/repositories/resume-repository";
import { scanRepository } from "@/lib/db/repositories/scan-repository";
import { AppError } from "@/lib/http/errors";
import { logger } from "@/lib/logging/logger";
import {
  analyzeDocument,
  ParseError,
  PARSER_VERSION,
  type DocumentAnalysis,
  type ParsedResume,
} from "@/lib/parsing";
import { checkFileSignature } from "@/lib/security/file-signature";
import { checkResumeFile } from "@/lib/validation/upload";
import type { ResumeDetail, ResumeUploadResult } from "@/types/api";

import { guestExpiry } from "./retention";

/** Parsing budget; the route's maxDuration leaves headroom above this. */
const PARSE_TIMEOUT_MS = 15_000;

export type IncomingResumeFile = {
  name: string;
  /** Declared MIME type from the multipart part; untrusted. */
  type: string;
  bytes: Buffer;
};

type Context = { requestId: string; owner: Owner };

/** Strips path segments and control characters from a client-supplied file name. */
export function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const cleaned = base.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return (cleaned || "resume").slice(0, 200);
}

/**
 * Validates, parses and stores an uploaded resume for its owner. The same file uploaded
 * again by the same owner returns the stored resume without parsing it again.
 */
export async function acceptResumeUpload(
  file: IncomingResumeFile,
  context: Context,
): Promise<ResumeUploadResult> {
  const fileName = sanitizeFileName(file.name);

  // Same rules the browser applied — never trust the client to have run them.
  const check = checkResumeFile({
    name: fileName,
    size: file.bytes.length,
    type: file.type,
  });
  if (!check.ok) throw new AppError(check.code);

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
  const duplicate = await resumeRepository.findDuplicate(
    context.owner,
    sha256,
    PARSER_VERSION,
  );
  if (duplicate) {
    const expiresAt = guestExpiry(context.owner);
    if (expiresAt)
      await resumeRepository.extendExpiry(context.owner, duplicate.id, expiresAt);
    logger.info("resume.reused", {
      requestId: context.requestId,
      resumeId: duplicate.id,
    });
    return toUploadResult({
      ...duplicate,
      file: { ...duplicate.file, originalName: fileName },
    });
  }

  const started = Date.now();
  const analysis = await parse(file.bytes, check.extension, context.requestId);
  const { parsed, extraction, warnings, text } = analysis;

  const stored = await resumeRepository.create({
    owner: context.owner,
    expiresAt: guestExpiry(context.owner),
    file: {
      originalName: fileName,
      extension: check.extension,
      mimeType: file.type,
      sizeBytes: file.bytes.length,
      sha256,
      pageCount: extraction.pageCount,
    },
    extraction: {
      engine: extraction.format === "pdf" ? "pdfjs" : "ooxml",
      text: text.slice(0, MAX_STORED_TEXT),
      wordCount: parsed.stats.wordCount,
      charCount: text.length,
      warnings,
      layout: extraction.layout,
    },
    parsed,
    parserVersion: PARSER_VERSION,
    language: parsed.meta.language,
  });

  logger.info("resume.accepted", {
    requestId: context.requestId,
    resumeId: stored.id,
    ownerType: context.owner.type,
    extension: check.extension,
    sizeBytes: file.bytes.length,
    pages: extraction.pageCount,
    words: parsed.stats.wordCount,
    sections: parsed.sections.length,
    parseMs: Date.now() - started,
  });
  return toUploadResult(stored);
}

export async function getResumeForOwner(owner: Owner, id: string): Promise<ResumeDetail> {
  const resume = await resumeRepository.findForOwner(owner, id);
  if (!resume) throw new AppError("NOT_FOUND");
  return {
    ...toUploadResult(resume),
    createdAt: resume.createdAt.toISOString(),
    expiresAt: resume.expiresAt?.toISOString() ?? null,
    parsed: resume.parsed,
  };
}

/** Deletes a resume and every scan of it — docs/PLANNING.md §22. Scans go first. */
export async function deleteResumeForOwner(owner: Owner, id: string): Promise<void> {
  // Scoped by owner, so this deletes nothing when the resume isn't the caller's.
  const scans = await scanRepository.deleteForResume(owner, id);
  const deleted = await resumeRepository.deleteForOwner(owner, id);
  if (!deleted) throw new AppError("NOT_FOUND");
  logger.info("resume.deleted", { resumeId: id, scans });
}

async function parse(
  bytes: Buffer,
  extension: "pdf" | "docx",
  requestId: string,
): Promise<DocumentAnalysis> {
  try {
    return await analyzeDocument(bytes, extension, {
      maxPages: UPLOAD_LIMITS.maxPages,
      asOf: new Date(),
      timeoutMs: PARSE_TIMEOUT_MS,
    });
  } catch (error) {
    if (error instanceof ParseError) {
      logger.info("resume.rejected", {
        requestId,
        code: error.code,
        reason: error.reason,
        extension,
        sizeBytes: bytes.length,
      });
      throw new AppError(error.code);
    }
    // An unexpected parser failure on unusual input is still "we couldn't read this file".
    logger.error("resume.parse_crashed", {
      requestId,
      extension,
      errorName: error instanceof Error ? error.name : typeof error,
    });
    throw new AppError("PARSE_FAILED", { cause: error });
  }
}

function toUploadResult(resume: StoredResume): ResumeUploadResult {
  return {
    id: resume.id,
    fileName: resume.file.originalName,
    extension: resume.file.extension,
    sizeBytes: resume.file.sizeBytes,
    pageCount: resume.file.pageCount,
    wordCount: resume.extraction.wordCount,
    sections: summarizeSections(resume.parsed.sections),
    warnings: resume.extraction.warnings,
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
