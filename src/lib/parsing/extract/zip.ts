import { inflateRawSync } from "node:zlib";

/**
 * Minimal, bounded ZIP reader for DOCX files (which are ZIP archives).
 * Reads the central directory, then extracts individual entries with a hard cap on
 * decompressed size, so a crafted archive cannot exhaust memory.
 */

export type ZipEntry = {
  name: string;
  /** 0 = stored, 8 = deflate. Anything else is unsupported. */
  method: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
};

const LOCAL_HEADER = 0x04034b50;
const CENTRAL_HEADER = 0x02014b50;
const END_OF_CENTRAL_DIR = 0x06054b50;

/** Absolute upper bound on entries we are willing to list. */
const MAX_LISTED_ENTRIES = 1000;

export function isZip(bytes: Buffer): boolean {
  return bytes.length >= 22 && bytes.readUInt32LE(0) === LOCAL_HEADER;
}

/** Reads the central directory. Returns null if the archive is malformed or ZIP64. */
export function readZipDirectory(bytes: Buffer): ZipEntry[] | null {
  if (bytes.length < 22) return null;
  // The end-of-central-directory record is within the last 22 + 65535 (max comment) bytes.
  const searchStart = Math.max(0, bytes.length - (22 + 0xffff));
  let eocd = -1;
  for (let i = bytes.length - 22; i >= searchStart; i -= 1) {
    if (bytes.readUInt32LE(i) === END_OF_CENTRAL_DIR) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1) return null;

  const entryCount = bytes.readUInt16LE(eocd + 10);
  const dirSize = bytes.readUInt32LE(eocd + 12);
  const dirOffset = bytes.readUInt32LE(eocd + 16);
  // 0xFFFF / 0xFFFFFFFF signal ZIP64, which a resume never needs.
  if (entryCount === 0xffff || dirOffset === 0xffffffff) return null;
  if (dirOffset + dirSize > eocd || entryCount > MAX_LISTED_ENTRIES) return null;

  const entries: ZipEntry[] = [];
  let p = dirOffset;
  for (let i = 0; i < entryCount; i += 1) {
    if (p + 46 > eocd || bytes.readUInt32LE(p) !== CENTRAL_HEADER) return null;
    const method = bytes.readUInt16LE(p + 10);
    const compressedSize = bytes.readUInt32LE(p + 20);
    const uncompressedSize = bytes.readUInt32LE(p + 24);
    const nameLength = bytes.readUInt16LE(p + 28);
    const extraLength = bytes.readUInt16LE(p + 30);
    const commentLength = bytes.readUInt16LE(p + 32);
    const localHeaderOffset = bytes.readUInt32LE(p + 42);
    const nameEnd = p + 46 + nameLength;
    if (nameEnd > eocd) return null;
    entries.push({
      name: bytes.toString("utf8", p + 46, nameEnd),
      method,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
    });
    p = nameEnd + extraLength + commentLength;
  }
  return entries;
}

export class ZipReadError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "ZipReadError";
  }
}

/**
 * Extracts one entry as a UTF-8 string. Throws ZipReadError if the entry is malformed,
 * uses an unsupported method, or would decompress beyond `maxBytes`.
 */
export function readZipText(bytes: Buffer, entry: ZipEntry, maxBytes: number): string {
  const p = entry.localHeaderOffset;
  if (p + 30 > bytes.length || bytes.readUInt32LE(p) !== LOCAL_HEADER) {
    throw new ZipReadError("bad_local_header");
  }
  const nameLength = bytes.readUInt16LE(p + 26);
  const extraLength = bytes.readUInt16LE(p + 28);
  const start = p + 30 + nameLength + extraLength;
  const end = start + entry.compressedSize;
  if (end > bytes.length) throw new ZipReadError("entry_out_of_bounds");
  const data = bytes.subarray(start, end);

  if (entry.method === 0) {
    if (data.length > maxBytes) throw new ZipReadError("entry_too_large");
    return data.toString("utf8");
  }
  if (entry.method === 8) {
    try {
      // maxOutputLength stops decompression early instead of trusting the declared size.
      return inflateRawSync(data, { maxOutputLength: maxBytes }).toString("utf8");
    } catch (error) {
      const code = (error as { code?: string }).code;
      throw new ZipReadError(
        code === "ERR_BUFFER_TOO_LARGE" ? "entry_too_large" : "inflate_failed",
      );
    }
  }
  throw new ZipReadError("unsupported_method");
}
