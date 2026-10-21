import { DECORATIVE_FONTS } from "@/lib/taxonomy";
import { DECORATIVE_BULLETS, isPrivateUse } from "@/lib/parsing/text";

import { percent, plural, wordsOf } from "../text-metrics";
import type { Check } from "../types";
import { notApplicable, pass, problem } from "./helpers";

/** Formatting (weight 25): can the text be extracted reliably? — docs/PLANNING.md §18.4. */
export const formattingChecks: Check[] = [
  {
    id: "F01",
    category: "formatting",
    title: "Tables",
    rule: "Tables detected: −25 in a DOCX. In a PDF, −12 as a major issue at low confidence, because detection is a layout heuristic.",
    maxDeduction: 25,
    severity: "critical",
    confidence: "high",
    fix: "Replace tables with plain lines of text. For skills, use a simple comma-separated list.",
    strength: "No tables that could scramble your text",
    run({ layout, format }) {
      const count = layout.tables.count;
      if (count === 0) return pass("No tables were found.");
      // PDF table detection is a layout heuristic, so it deducts less and says "likely".
      return format === "docx"
        ? problem(
            25,
            `Your resume uses ${plural(count, "table")}. Many ATS parsers read table cells out of order or skip them.`,
            [{ count }],
          )
        : problem(
            12,
            `Your resume likely uses ${plural(count, "table")} or a table-like grid. ATS parsers can read such grids out of order.`,
            [{ count }],
            { confidence: "low", severity: "major" },
          );
    },
  },
  {
    id: "F02",
    category: "formatting",
    title: "Text boxes",
    rule: "Any Word text box or shape containing text: −20. Not applicable to PDFs.",
    maxDeduction: 20,
    severity: "critical",
    confidence: "high",
    fix: "Move text out of text boxes and shapes into normal paragraphs.",
    strength: "No text hidden in text boxes",
    run({ layout }) {
      if (!layout.textBoxes)
        return notApplicable("Text boxes are only detectable in Word documents.");
      const count = layout.textBoxes.count;
      return count === 0
        ? pass("No text boxes were found.")
        : problem(
            20,
            `${plural(count, "text box", "text boxes")} found. Text inside text boxes is often skipped by ATS parsers.`,
            [{ count }],
          );
    },
  },
  {
    id: "F03",
    category: "formatting",
    title: "Images or photo",
    rule: "Any image other than a scanned page: −8.",
    maxDeduction: 8,
    severity: "minor",
    confidence: "high",
    fix: "Remove photos, logos and icons. ATS systems ignore them, and many employers prefer resumes without a photo.",
    run({ layout }) {
      const nonScanned = layout.images.count - layout.images.imageOnlyPages.length;
      return nonScanned <= 0
        ? pass("No images were found.")
        : problem(
            8,
            `${plural(nonScanned, "image")} found. ATS systems can't read images, so any text in them is lost.`,
            [{ count: nonScanned }],
          );
    },
  },
  {
    id: "F04",
    category: "formatting",
    title: "Scanned or image-only pages",
    rule: "Some pages are image-only: −60. Every page is: −100, so Formatting scores 0.",
    maxDeduction: 100,
    severity: "critical",
    confidence: "high",
    fix: "Export your resume directly from your editor as a text PDF or DOCX instead of scanning or saving it as an image.",
    strength: "All pages contain real, selectable text",
    run({ layout, resume }) {
      const pages = layout.images.imageOnlyPages;
      if (pages.length === 0) return pass("Every page contains selectable text.");
      const all = pages.length >= resume.stats.pageCount;
      return problem(
        all ? 100 : 60,
        all
          ? "Your resume is an image. ATS systems can't read any of its text."
          : `${pages.length === 1 ? "Page" : "Pages"} ${pages.join(", ")} ${pages.length === 1 ? "is an image" : "are images"}. ATS systems can't read the text on ${pages.length === 1 ? "it" : "them"}.`,
        pages.map((page) => ({ location: `Page ${page}` })),
      );
    },
  },
  {
    id: "F05",
    category: "formatting",
    title: "Multi-column layout",
    rule: "Columns detected: −20 (high confidence in a DOCX; a PDF uses the detector's confidence).",
    maxDeduction: 20,
    severity: "major",
    confidence: "high",
    fix: "Use a single-column layout. Put contact details at the top and sections one after another.",
    strength: "Single-column layout that reads in order",
    run({ layout, format }) {
      if (!layout.columns.detected) return pass("Your resume uses a single column.");
      return problem(
        20,
        "Your resume uses columns. Some ATS parsers read across columns line by line, mixing sections together.",
        layout.columns.pages.map((page) => ({ location: `Page ${page}` })),
        { confidence: format === "docx" ? "high" : layout.columns.confidence },
      );
    },
  },
  {
    id: "F06",
    category: "formatting",
    title: "Contact details in header or footer",
    rule: "Email or phone found only in a page header or footer: −15. Not applicable to single-page PDFs.",
    maxDeduction: 15,
    severity: "major",
    confidence: "high",
    fix: "Move your email and phone number into the main body at the top of the page.",
    strength: "Contact details are in the main body",
    run({ layout, resume, format }) {
      if (!layout.headerFooter.applicable) {
        return notApplicable(
          "Headers and footers can only be told apart on resumes with more than one page.",
        );
      }
      if (!resume.contact.inHeaderOrFooter)
        return pass("Your contact details are in the main body.");
      return problem(
        15,
        "Your email or phone number appears only in the page header or footer. Many ATS parsers ignore headers and footers.",
        layout.headerFooter.text
          .slice(0, 1)
          .map((excerpt) => ({ excerpt, location: "Header or footer" })),
        { confidence: format === "docx" ? "high" : "medium" },
      );
    },
  },
  {
    id: "F07",
    category: "formatting",
    title: "Unreadable characters",
    rule: "More than 1% of characters unreadable: −15.",
    maxDeduction: 15,
    severity: "major",
    confidence: "high",
    fix: "Re-export the PDF with standard fonts embedded, or upload the DOCX instead.",
    strength: "Text extracts cleanly, with no garbled characters",
    run({ layout }) {
      const ratio = layout.encoding.replacementRatio;
      if (ratio <= 0.01) return pass("All characters were read correctly.");
      return problem(
        15,
        `About ${Math.round(ratio * 100)}% of characters couldn't be read correctly. ATS systems may see garbled text.`,
      );
    },
  },
  {
    id: "F08",
    category: "formatting",
    title: "Decorative bullet symbols",
    rule: "Decorative or symbol-font bullet glyphs (such as ➤ ★ ✔): −5.",
    maxDeduction: 5,
    severity: "minor",
    confidence: "high",
    fix: "Use plain round bullets (•) or hyphens.",
    run({ layout }) {
      const decorative = layout.bulletGlyphs.filter(
        (g) => DECORATIVE_BULLETS.has(g) || Array.from(g).some(isPrivateUse),
      );
      return decorative.length === 0
        ? pass("Bullets use standard symbols.")
        : problem(
            5,
            `Decorative bullet symbols (${decorative.join(" ")}) can turn into stray characters in ATS systems.`,
            decorative.map((excerpt) => ({ excerpt })),
          );
    },
  },
  {
    id: "F09",
    category: "formatting",
    title: "Links that hide their address",
    rule: "A link whose visible text isn't its address: −4. Not applicable without links.",
    maxDeduction: 4,
    severity: "info",
    confidence: "high",
    fix: "Write the address itself, such as linkedin.com/in/yourname, rather than linking words like “My profile”.",
    run({ layout, format }) {
      if (layout.links.length === 0) return notApplicable("No links were found.");
      const hidden = layout.links.filter((l) => l.hidden);
      return hidden.length === 0
        ? pass("Links show their full address.")
        : problem(
            4,
            `${plural(hidden.length, "link")} ${hidden.length === 1 ? "hides its" : "hide their"} address behind other text. ATS systems keep the text and drop the link.`,
            hidden.slice(0, 3).map((l) => ({ excerpt: l.text || l.url })),
            { confidence: format === "docx" ? "high" : "medium" },
          );
    },
  },
  {
    id: "F10",
    category: "formatting",
    title: "Too much text in capitals",
    rule: "More than 15% of body words (5+ letters, headings excluded) in capitals: −6. Needs 50 words.",
    maxDeduction: 6,
    severity: "minor",
    confidence: "high",
    fix: "Keep capitals for headings and acronyms; write body text in sentence case.",
    run({ text, resume }) {
      const headings = new Set(
        resume.sections.map((s) => s.heading?.trim()).filter(Boolean),
      );
      const bodyWords = text
        .split("\n")
        .filter((line) => !headings.has(line.trim()))
        .flatMap((line) => wordsOf(line));
      if (bodyWords.length < 50) return notApplicable("Not enough text to measure.");
      // Words of 5+ letters in capitals; shorter ones are usually acronyms (AWS, SQL).
      const shouting = bodyWords.filter((w) => w.length >= 5 && /^[\p{Lu}]+$/u.test(w));
      const share = shouting.length / bodyWords.length;
      return share <= 0.15
        ? pass("Body text uses normal capitalization.")
        : problem(
            6,
            `${percent(shouting.length, bodyWords.length)}% of words are in capitals, which is harder to read and can affect keyword matching.`,
          );
    },
  },
  {
    id: "F11",
    category: "formatting",
    title: "Little text per page",
    rule: "Fewer than 150 words per page on pages with text: −10.",
    maxDeduction: 10,
    severity: "major",
    confidence: "medium",
    fix: "Make sure your text is real text, not part of an image, and that pages aren't mostly empty.",
    run({ resume, layout }) {
      const textPages = resume.stats.pageCount - layout.images.imageOnlyPages.length;
      if (textPages <= 0) return notApplicable("No pages with text.");
      const perPage = resume.stats.wordCount / textPages;
      return perPage >= 150
        ? pass("Pages contain a healthy amount of text.")
        : problem(
            10,
            `Only about ${Math.round(perPage)} words per page could be read. Some text may be in images or graphics.`,
            [{ count: Math.round(perPage) }],
          );
    },
  },
  {
    id: "F12",
    category: "formatting",
    title: "Decorative fonts",
    rule: "A decorative or symbol font in use: −5. Not applicable without font information.",
    maxDeduction: 5,
    severity: "minor",
    confidence: "high",
    fix: "Use a standard font such as Arial, Calibri, Helvetica or Georgia.",
    run({ layout, format }) {
      if (layout.fonts.length === 0)
        return notApplicable("No font information was available.");
      const decorative = layout.fonts.filter((font) =>
        DECORATIVE_FONTS.some((d) =>
          font.toLowerCase().replace(/[-_]/g, " ").includes(d),
        ),
      );
      return decorative.length === 0
        ? pass("Fonts are standard and easy to read.")
        : problem(
            5,
            `Decorative fonts (${decorative.join(", ")}) can render as symbols in some ATS systems.`,
            [],
            {
              confidence: format === "docx" ? "high" : "medium",
            },
          );
    },
  },
];
