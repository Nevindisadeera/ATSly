import { zip, type ZipFile } from "./documents";

/**
 * Builds realistic Word documents for parser tests: real styles, list numbering, tables,
 * text boxes (in Word's AlternateContent form, with the duplicate fallback copy), headers,
 * hyperlinks and page metadata. Parts are deflate-compressed like files saved by Word.
 */

export type Run = { text: string; bold?: boolean; size?: number; tab?: boolean };

export type Paragraph = {
  text?: string;
  runs?: Run[];
  /** Word style id: "Title", "Heading1", "Heading2", "ListParagraph". */
  style?: string;
  bold?: boolean;
  /** Font size in points. */
  size?: number;
  /** Bulleted list item. */
  bullet?: boolean;
  /** Hyperlink applied to the whole paragraph. */
  link?: string;
};

export type Block = Paragraph | { table: string[][] } | { textBox: Paragraph[] };

export type DocxSpec = {
  blocks: Block[];
  header?: string[];
  footer?: string[];
  /** Page count to record in docProps/app.xml; omitted means the file has no page metadata. */
  pages?: number;
  /** Bullet glyph used by list numbering. */
  bulletGlyph?: string;
  bulletFont?: string;
  columns?: number;
};

const esc = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const NS =
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"';

function run(r: Run, inherited: { bold?: boolean; size?: number }): string {
  const bold = r.bold ?? inherited.bold;
  const size = r.size ?? inherited.size;
  const props = `${bold ? "<w:b/>" : ""}${size ? `<w:sz w:val="${size * 2}"/>` : ""}`;
  const rPr = props ? `<w:rPr>${props}</w:rPr>` : "";
  if (r.tab) return `<w:r>${rPr}<w:tab/></w:r>`;
  // A newline inside text becomes a soft line break, like Shift+Enter in Word.
  const parts = r.text
    .split("\n")
    .map((t) => `<w:t xml:space="preserve">${esc(t)}</w:t>`);
  return `<w:r>${rPr}${parts.join("<w:br/>")}</w:r>`;
}

function paragraph(p: Paragraph, links: string[]): string {
  const pPr = [
    p.style ? `<w:pStyle w:val="${p.style}"/>` : "",
    p.bullet
      ? '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr><w:ind w:left="720" w:hanging="360"/>'
      : "",
  ].join("");
  const runs = (p.runs ?? [{ text: p.text ?? "" }]).map((r) => run(r, p)).join("");
  let content = runs;
  if (p.link) {
    links.push(p.link);
    content = `<w:hyperlink r:id="rIdLink${links.length}">${runs}</w:hyperlink>`;
  }
  return `<w:p>${pPr ? `<w:pPr>${pPr}</w:pPr>` : ""}${content}</w:p>`;
}

function block(b: Block, links: string[]): string {
  if ("table" in b) {
    const rows = b.table
      .map(
        (row) =>
          `<w:tr>${row.map((cell) => `<w:tc><w:p><w:r><w:t xml:space="preserve">${esc(cell)}</w:t></w:r></w:p></w:tc>`).join("")}</w:tr>`,
      )
      .join("");
    return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/></w:tblPr>${rows}</w:tbl>`;
  }
  if ("textBox" in b) {
    const inner = b.textBox.map((p) => paragraph(p, links)).join("");
    // Word writes text boxes twice: a modern drawing and a legacy VML fallback.
    return `<w:p><w:r><mc:AlternateContent><mc:Choice Requires="wps"><w:drawing><wp:anchor><a:graphic><a:graphicData><wps:wsp><wps:txbx><w:txbxContent>${inner}</w:txbxContent></wps:txbx></wps:wsp></a:graphicData></a:graphic></wp:anchor></w:drawing></mc:Choice><mc:Fallback><w:pict><v:shape><v:textbox><w:txbxContent>${inner}</w:txbxContent></v:textbox></v:shape></w:pict></mc:Fallback></mc:AlternateContent></w:r></w:p>`;
  }
  return paragraph(b, links);
}

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:sz w:val="40"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:pPr><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="24"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/></w:style>
</w:styles>`;

export function buildDocx(spec: DocxSpec): Buffer {
  const links: string[] = [];
  const body = spec.blocks.map((b) => block(b, links)).join("");
  const sectPr = `<w:sectPr>${spec.header ? '<w:headerReference w:type="default" r:id="rIdHeader1"/>' : ""}${spec.footer ? '<w:footerReference w:type="default" r:id="rIdFooter1"/>' : ""}<w:pgSz w:w="12240" w:h="15840"/>${spec.columns ? `<w:cols w:num="${spec.columns}" w:space="720"/>` : ""}</w:sectPr>`;
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document ${NS}><w:body>${body}${sectPr}</w:body></w:document>`;

  const glyph = spec.bulletGlyph ?? "•";
  const font = spec.bulletFont ?? "Symbol";
  const numbering = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/><w:lvlText w:val="${esc(glyph)}"/><w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}"/></w:rPr></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>`;

  const headerFooterXml = (tag: "hdr" | "ftr", lines: string[]) =>
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:${tag} ${NS}>${lines.map((l) => `<w:p><w:r><w:t xml:space="preserve">${esc(l)}</w:t></w:r></w:p>`).join("")}</w:${tag}>`;

  const rels = [
    '<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>',
    '<Relationship Id="rIdNumbering" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>',
    spec.header
      ? '<Relationship Id="rIdHeader1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>'
      : "",
    spec.footer
      ? '<Relationship Id="rIdFooter1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>'
      : "",
    ...links.map(
      (url, i) =>
        `<Relationship Id="rIdLink${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${esc(url)}" TargetMode="External"/>`,
    ),
  ].join("");

  const files: ZipFile[] = [
    {
      name: "[Content_Types].xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
    },
    {
      name: "_rels/.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
    },
    { name: "word/document.xml", content: document },
    { name: "word/styles.xml", content: STYLES },
    { name: "word/numbering.xml", content: numbering },
    {
      name: "word/_rels/document.xml.rels",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}</Relationships>`,
    },
  ];
  if (spec.header)
    files.push({
      name: "word/header1.xml",
      content: headerFooterXml("hdr", spec.header),
    });
  if (spec.footer)
    files.push({
      name: "word/footer1.xml",
      content: headerFooterXml("ftr", spec.footer),
    });
  if (spec.pages) {
    files.push({
      name: "docProps/app.xml",
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Pages>${spec.pages}</Pages></Properties>`,
    });
  }
  return zip(files, { deflate: true });
}
