import type { UploadExtension } from "@/lib/config/limits";
import { isZip, readZipDirectory } from "@/lib/parsing/extract/zip";
import type { ApiErrorCode } from "@/types/api";

/**
 * Checks what a file actually is from its bytes, independent of its name and declared type.
 * No parsing of content happens here — that is Phase 5a. These checks are cheap, bounded,
 * and safe to run on untrusted input.
 */

export type SignatureCheck =
  | { ok: true }
  | {
      ok: false;
      code: Extract<
        ApiErrorCode,
        "UNSUPPORTED_TYPE" | "ENCRYPTED_DOCUMENT" | "PARSE_FAILED" | "EMPTY_DOCUMENT"
      >;
      reason: string;
    };

/** Limits for DOCX archives, which are ZIP files and can be crafted to expand enormously. */
export const DOCX_LIMITS = {
  maxEntries: 500,
  maxUncompressedBytes: 25 * 1024 * 1024,
} as const;

const PDF_MAGIC = Buffer.from("%PDF-");
const PDF_EOF = Buffer.from("%%EOF");
/** OLE compound file: how Office stores password-protected (encrypted) documents. */
const OLE_MAGIC = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);

const fail = (code: Extract<SignatureCheck, { ok: false }>["code"], reason: string) =>
  ({ ok: false, code, reason }) as const;

export function checkFileSignature(
  bytes: Buffer,
  extension: UploadExtension,
): SignatureCheck {
  if (bytes.length === 0) return fail("EMPTY_DOCUMENT", "empty");
  return extension === "pdf" ? checkPdf(bytes) : checkDocx(bytes);
}

function checkPdf(bytes: Buffer): SignatureCheck {
  // The spec allows a little junk before the header; readers accept it within the first 1 KB.
  const header = bytes.subarray(0, 1024).indexOf(PDF_MAGIC);
  if (header === -1) return fail("UNSUPPORTED_TYPE", "pdf_magic_missing");
  if (bytes.indexOf(PDF_EOF) === -1) return fail("PARSE_FAILED", "pdf_truncated");
  // Encrypted PDFs are NOT rejected here. "/Encrypt" also marks PDFs that open without a
  // password but restrict printing or copying (owner password only), which are readable.
  // Only a real parser can tell the two apart, so that decision belongs to Phase 5a.
  return { ok: true };
}

function checkDocx(bytes: Buffer): SignatureCheck {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(OLE_MAGIC)) {
    return fail("ENCRYPTED_DOCUMENT", "docx_encrypted_container");
  }
  if (!isZip(bytes)) {
    return fail("UNSUPPORTED_TYPE", "docx_not_zip");
  }

  const entries = readZipDirectory(bytes);
  if (!entries) return fail("PARSE_FAILED", "docx_zip_unreadable");

  if (entries.length > DOCX_LIMITS.maxEntries) {
    return fail("PARSE_FAILED", "docx_too_many_entries");
  }
  const total = entries.reduce((sum, e) => sum + e.uncompressedSize, 0);
  if (total > DOCX_LIMITS.maxUncompressedBytes) {
    return fail("PARSE_FAILED", "docx_too_large_uncompressed");
  }

  const names = new Set(entries.map((e) => e.name));
  if (!names.has("[Content_Types].xml") || !names.has("word/document.xml")) {
    return fail("UNSUPPORTED_TYPE", "docx_not_word_document");
  }
  // Macro-enabled documents (.docm renamed to .docx) carry a VBA project.
  if (names.has("word/vbaProject.bin")) {
    return fail("UNSUPPORTED_TYPE", "docx_macro_enabled");
  }
  return { ok: true };
}
