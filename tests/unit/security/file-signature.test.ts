import { describe, expect, it } from "vitest";

import { checkFileSignature, DOCX_LIMITS } from "@/lib/security/file-signature";

import {
  encryptedOfficeContainer,
  minimalDocx,
  minimalPdf,
  zip,
} from "../../support/documents";

describe("checkFileSignature — PDF", () => {
  it("accepts a well-formed PDF", () => {
    expect(checkFileSignature(minimalPdf(), "pdf")).toEqual({ ok: true });
  });

  it("accepts a header preceded by a few junk bytes", () => {
    const pdf = Buffer.concat([Buffer.from("\n\n"), minimalPdf()]);
    expect(checkFileSignature(pdf, "pdf").ok).toBe(true);
  });

  it("rejects bytes that are not a PDF", () => {
    expect(checkFileSignature(Buffer.from("hello world"), "pdf")).toMatchObject({
      ok: false,
      code: "UNSUPPORTED_TYPE",
    });
    expect(checkFileSignature(minimalDocx(), "pdf")).toMatchObject({
      code: "UNSUPPORTED_TYPE",
    });
  });

  it("leaves encrypted PDFs to the parser, since many open without a password", () => {
    expect(checkFileSignature(minimalPdf({ encrypted: true }), "pdf")).toEqual({
      ok: true,
    });
  });

  it("detects truncated PDFs", () => {
    expect(checkFileSignature(minimalPdf({ truncated: true }), "pdf")).toMatchObject({
      code: "PARSE_FAILED",
    });
  });

  it("treats zero bytes as empty", () => {
    expect(checkFileSignature(Buffer.alloc(0), "pdf")).toMatchObject({
      code: "EMPTY_DOCUMENT",
    });
  });
});

describe("checkFileSignature — DOCX", () => {
  it("accepts a minimal Word document", () => {
    expect(checkFileSignature(minimalDocx(), "docx")).toEqual({ ok: true });
  });

  it("rejects non-ZIP bytes and other ZIP archives", () => {
    expect(checkFileSignature(minimalPdf(), "docx")).toMatchObject({
      code: "UNSUPPORTED_TYPE",
    });
    expect(
      checkFileSignature(zip([{ name: "photo.jpg", content: "x" }]), "docx"),
    ).toMatchObject({
      code: "UNSUPPORTED_TYPE",
    });
    expect(
      checkFileSignature(minimalDocx({ withoutDocument: true }), "docx"),
    ).toMatchObject({
      code: "UNSUPPORTED_TYPE",
    });
  });

  it("rejects macro-enabled documents", () => {
    expect(checkFileSignature(minimalDocx({ macros: true }), "docx")).toMatchObject({
      code: "UNSUPPORTED_TYPE",
      reason: "docx_macro_enabled",
    });
  });

  it("detects password-protected Office files", () => {
    expect(checkFileSignature(encryptedOfficeContainer(), "docx")).toMatchObject({
      code: "ENCRYPTED_DOCUMENT",
    });
  });

  it("rejects archives that would expand beyond the limit", () => {
    const bomb = zip([
      { name: "[Content_Types].xml", content: "<Types/>" },
      {
        name: "word/document.xml",
        content: "x",
        declaredSize: DOCX_LIMITS.maxUncompressedBytes + 1,
      },
    ]);
    expect(checkFileSignature(bomb, "docx")).toMatchObject({
      code: "PARSE_FAILED",
      reason: "docx_too_large_uncompressed",
    });
  });

  it("rejects archives with too many entries", () => {
    const files = Array.from({ length: DOCX_LIMITS.maxEntries + 1 }, (_, i) => ({
      name: `f${i}`,
    }));
    expect(checkFileSignature(zip(files), "docx")).toMatchObject({
      code: "PARSE_FAILED",
    });
  });

  it("rejects a corrupted archive", () => {
    const corrupted = minimalDocx().subarray(0, 60);
    expect(checkFileSignature(corrupted, "docx")).toMatchObject({ code: "PARSE_FAILED" });
  });
});
