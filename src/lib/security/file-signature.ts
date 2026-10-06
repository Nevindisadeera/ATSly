import type { UploadExtension } from "@/lib/config/limits";
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
const ZIP_LOCAL_HEADER = 0x04034b50;
const ZIP_CENTRAL_HEADER = 0x02014b50;
const ZIP_END_OF_CENTRAL_DIR = 0x06054b50;
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

type ZipEntry = { name: string; uncompressedSize: number };

function checkDocx(bytes: Buffer): SignatureCheck {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(OLE_MAGIC)) {
    return fail("ENCRYPTED_DOCUMENT", "docx_encrypted_container");
  }
  if (bytes.length < 22 || bytes.readUInt32LE(0) !== ZIP_LOCAL_HEADER) {
    return fail("UNSUPPORTED_TYPE", "docx_not_zip");
  }

  const entries = readCentralDirectory(bytes);
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

/** Reads entry names and sizes from a ZIP's central directory. Returns null if malformed. */
function readCentralDirectory(bytes: Buffer): ZipEntry[] | null {
  // The end-of-central-directory record is in the last 22 + 65535 (max comment) bytes.
  const searchStart = Math.max(0, bytes.length - (22 + 0xffff));
  let eocd = -1;
  for (let i = bytes.length - 22; i >= searchStart; i -= 1) {
    if (bytes.readUInt32LE(i) === ZIP_END_OF_CENTRAL_DIR) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1) return null;

  const entryCount = bytes.readUInt16LE(eocd + 10);
  const dirSize = bytes.readUInt32LE(eocd + 12);
  const dirOffset = bytes.readUInt32LE(eocd + 16);
  // 0xFFFF / 0xFFFFFFFF mean ZIP64, which a resume never needs.
  if (entryCount === 0xffff || dirOffset === 0xffffffff) return null;
  if (dirOffset + dirSize > eocd || entryCount > DOCX_LIMITS.maxEntries * 2) return null;

  const entries: ZipEntry[] = [];
  let p = dirOffset;
  for (let i = 0; i < entryCount; i += 1) {
    if (p + 46 > eocd || bytes.readUInt32LE(p) !== ZIP_CENTRAL_HEADER) return null;
    const uncompressedSize = bytes.readUInt32LE(p + 24);
    const nameLength = bytes.readUInt16LE(p + 28);
    const extraLength = bytes.readUInt16LE(p + 30);
    const commentLength = bytes.readUInt16LE(p + 32);
    const nameEnd = p + 46 + nameLength;
    if (nameEnd > eocd) return null;
    entries.push({ name: bytes.toString("utf8", p + 46, nameEnd), uncompressedSize });
    p = nameEnd + extraLength + commentLength;
  }
  return entries;
}
