import { createHash } from "node:crypto";
import { crc32, deflateRawSync } from "node:zlib";

/**
 * Builds small, structurally valid documents in memory for tests, so no binary fixtures
 * need to be committed. Realistic resume fixtures live in tests/fixtures/resumes.
 */

const DEFAULT_LINES = [
  "Jane Doe",
  "jane.doe@example.com | +1 555 010 2000 | Austin, TX",
  "Experience",
  "Software Engineer, Acme Corp, Jan 2021 - Present",
  "Built a React dashboard used by forty account managers every day.",
];

export type MinimalPdfOptions = {
  lines?: string[];
  pages?: number;
  /** Encrypt with an owner password only: opens without a password but restricts copying. */
  encrypted?: boolean;
  /** Encrypt so that opening the file requires this password. */
  userPassword?: string;
  truncated?: boolean;
};

/** RC4, used by the PDF standard security handler (revision 2). */
function rc4(key: Buffer, data: Buffer): Buffer {
  const s = Array.from({ length: 256 }, (_, i) => i);
  let j = 0;
  for (let i = 0; i < 256; i += 1) {
    j = (j + s[i]! + key[i % key.length]!) & 0xff;
    [s[i], s[j]] = [s[j]!, s[i]!];
  }
  const out = Buffer.alloc(data.length);
  let i = 0;
  j = 0;
  for (let k = 0; k < data.length; k += 1) {
    i = (i + 1) & 0xff;
    j = (j + s[i]!) & 0xff;
    [s[i], s[j]] = [s[j]!, s[i]!];
    out[k] = data[k]! ^ s[(s[i]! + s[j]!) & 0xff]!;
  }
  return out;
}

const md5 = (...parts: Buffer[]) =>
  createHash("md5").update(Buffer.concat(parts)).digest();
const PAD = Buffer.from(
  "28BF4E5E4E758A4164004E56FFFA01082E2E00B6D0683E802F0CA9FE6453697A",
  "hex",
);
const padPassword = (password: string) =>
  Buffer.concat([Buffer.from(password, "latin1"), PAD]).subarray(0, 32);

/**
 * A small text PDF with a real font, correct cross-reference table, and optional 40-bit
 * RC4 encryption (standard security handler, revision 2) for password tests.
 */
export function minimalPdf(options: MinimalPdfOptions = {}): Buffer {
  const lines = options.lines ?? DEFAULT_LINES;
  const pages = options.pages ?? 1;
  const encrypt = options.encrypted || options.userPassword !== undefined;

  const pageIds = Array.from({ length: pages }, (_, i) => 4 + i * 2);
  const contentIds = pageIds.map((id) => id + 1);
  const fontId = 3;
  const encryptId = 4 + pages * 2;

  // Encryption parameters.
  const fileId = Buffer.from("a1b2c3d4e5f60718293a4b5c6d7e8f90", "hex");
  const permissions = -44; // no copying or printing
  let key: Buffer = Buffer.alloc(0);
  let ownerEntry: Buffer = Buffer.alloc(0);
  let userEntry: Buffer = Buffer.alloc(0);
  if (encrypt) {
    const userPassword = options.userPassword ?? "";
    const ownerKey = md5(padPassword("owner-secret")).subarray(0, 5);
    ownerEntry = rc4(ownerKey, padPassword(userPassword));
    const p = Buffer.alloc(4);
    p.writeInt32LE(permissions);
    key = md5(padPassword(userPassword), ownerEntry, p, fileId).subarray(0, 5);
    userEntry = rc4(key, PAD);
  }
  const objectKey = (id: number) =>
    md5(
      key,
      Buffer.from([id & 0xff, (id >> 8) & 0xff, (id >> 16) & 0xff, 0, 0]),
    ).subarray(0, 10);

  const escape = (t: string) => t.replace(/[\\()]/g, (c) => `\\${c}`);
  const objects = new Map<number, Buffer>();
  const obj = (id: number, body: string | Buffer) =>
    objects.set(
      id,
      Buffer.concat([
        Buffer.from(`${id} 0 obj\n`, "latin1"),
        typeof body === "string" ? Buffer.from(body, "latin1") : body,
        Buffer.from("\nendobj\n", "latin1"),
      ]),
    );

  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  obj(
    2,
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages} >>`,
  );
  obj(fontId, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  pageIds.forEach((pageId, index) => {
    const contentId = contentIds[index]!;
    obj(
      pageId,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`,
    );
    const text = lines
      .map((line, i) => `BT /F1 11 Tf 72 ${720 - i * 16} Td (${escape(line)}) Tj ET`)
      .join("\n");
    let stream: Buffer = Buffer.from(text, "latin1");
    if (encrypt) stream = rc4(objectKey(contentId), stream);
    obj(
      contentId,
      Buffer.concat([
        Buffer.from(`<< /Length ${stream.length} >>\nstream\n`, "latin1"),
        stream,
        Buffer.from("\nendstream", "latin1"),
      ]),
    );
  });
  if (encrypt) {
    obj(
      encryptId,
      `<< /Filter /Standard /V 1 /R 2 /Length 40 /O <${ownerEntry.toString("hex")}> /U <${userEntry.toString("hex")}> /P ${permissions} >>`,
    );
  }

  const header = Buffer.from("%PDF-1.4\n", "latin1");
  const ids = [...objects.keys()].sort((a, b) => a - b);
  const size = ids.at(-1)! + 1;
  const chunks: Buffer[] = [header];
  const offsets = new Map<number, number>();
  let offset = header.length;
  for (const id of ids) {
    offsets.set(id, offset);
    chunks.push(objects.get(id)!);
    offset += objects.get(id)!.length;
  }
  const xref = [
    "xref",
    `0 ${size}`,
    "0000000000 65535 f ",
    ...Array.from({ length: size - 1 }, (_, i) => {
      const at = offsets.get(i + 1);
      return at === undefined
        ? "0000000000 65535 f "
        : `${String(at).padStart(10, "0")} 00000 n `;
    }),
  ].join("\n");
  const trailer = `trailer\n<< /Size ${size} /Root 1 0 R${encrypt ? ` /Encrypt ${encryptId} 0 R /ID [<${fileId.toString("hex")}> <${fileId.toString("hex")}>]` : ""} >>\nstartxref\n${offset}\n`;
  const body = Buffer.concat([...chunks, Buffer.from(`${xref}\n${trailer}`, "latin1")]);
  return options.truncated
    ? body
    : Buffer.concat([body, Buffer.from("%%EOF\n", "latin1")]);
}

export type ZipFile = { name: string; content?: string; declaredSize?: number };

/**
 * Writes a ZIP archive with stored (uncompressed) entries. `declaredSize` overrides the
 * uncompressed size in the central directory to simulate archives that expand hugely.
 */
export function zip(files: ZipFile[], options: { deflate?: boolean } = {}): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const name = Buffer.from(file.name, "utf8");
    const raw = Buffer.from(file.content ?? "", "utf8");
    const data = options.deflate ? deflateRawSync(raw) : raw;
    const method = options.deflate ? 8 : 0;
    const size = file.declaredSize ?? raw.length;
    const checksum = crc32(raw);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(data.length, 18); // compressed size
    local.writeUInt32LE(raw.length, 22); // uncompressed size
    local.writeUInt16LE(name.length, 26);
    locals.push(local, name, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(size, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);

    offset += local.length + name.length + data.length;
  }

  const centralDir = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralDir.length, 12);
  end.writeUInt32LE(offset, 16);

  return Buffer.concat([...locals, centralDir, end]);
}

const CONTENT_TYPES = `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>`;
const DOCUMENT_LINES = DEFAULT_LINES.map(
  (line) => `<w:p><w:r><w:t xml:space="preserve">${line}</w:t></w:r></w:p>`,
).join("");
const DOCUMENT = `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${DOCUMENT_LINES}</w:body></w:document>`;

/** A minimal Word document archive. */
export function minimalDocx(
  options: { macros?: boolean; withoutDocument?: boolean } = {},
): Buffer {
  const files: ZipFile[] = [{ name: "[Content_Types].xml", content: CONTENT_TYPES }];
  if (!options.withoutDocument)
    files.push({ name: "word/document.xml", content: DOCUMENT });
  if (options.macros) files.push({ name: "word/vbaProject.bin", content: "macro" });
  return zip(files);
}

/** The header of an OLE compound file, used by Office for password-protected documents. */
export function encryptedOfficeContainer(): Buffer {
  return Buffer.concat([
    Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
    Buffer.alloc(504),
  ]);
}
