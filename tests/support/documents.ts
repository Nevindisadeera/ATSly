/**
 * Builds small, structurally valid documents in memory for tests, so no binary fixtures
 * need to be committed. These are not full resumes — parsing fixtures arrive in Phase 5a.
 */

/** A minimal one-page PDF with a text object. */
export function minimalPdf(
  options: { encrypted?: boolean; truncated?: boolean } = {},
): Buffer {
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >> endobj",
    "4 0 obj << /Length 44 >> stream\nBT /F1 12 Tf 72 720 Td (Jane Doe) Tj ET\nendstream endobj",
  ];
  const trailer = options.encrypted
    ? "trailer << /Root 1 0 R /Size 5 /Encrypt 6 0 R >>"
    : "trailer << /Root 1 0 R /Size 5 >>";
  const body = ["%PDF-1.7", ...objects, "xref", trailer, "startxref", "0"].join("\n");
  return Buffer.from(options.truncated ? body : `${body}\n%%EOF\n`, "latin1");
}

type ZipFile = { name: string; content?: string; declaredSize?: number };

/**
 * Writes a ZIP archive with stored (uncompressed) entries. `declaredSize` overrides the
 * uncompressed size in the central directory to simulate archives that expand hugely.
 */
export function zip(files: ZipFile[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const name = Buffer.from(file.name, "utf8");
    const data = Buffer.from(file.content ?? "", "utf8");
    const size = file.declaredSize ?? data.length;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt32LE(data.length, 18); // compressed size
    local.writeUInt32LE(data.length, 22); // uncompressed size
    local.writeUInt16LE(name.length, 26);
    locals.push(local, name, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
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
const DOCUMENT = `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Jane Doe</w:t></w:r></w:p></w:body></w:document>`;

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
