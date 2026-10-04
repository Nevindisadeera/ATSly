import { describe, expect, it } from "vitest";

import { UPLOAD_LIMITS } from "@/lib/config/limits";
import { checkResumeFile, fileExtension } from "@/lib/validation/upload";

const PDF = UPLOAD_LIMITS.mimeTypes.pdf;
const DOCX = UPLOAD_LIMITS.mimeTypes.docx;

describe("fileExtension", () => {
  it("returns the lowercased last extension", () => {
    expect(fileExtension("Resume.PDF")).toBe("pdf");
    expect(fileExtension("my.resume.v2.docx")).toBe("docx");
    expect(fileExtension("README")).toBe("");
  });
});

describe("checkResumeFile", () => {
  it("accepts PDF and DOCX with their MIME types", () => {
    expect(checkResumeFile({ name: "a.pdf", size: 1000, type: PDF })).toEqual({
      ok: true,
      extension: "pdf",
    });
    expect(checkResumeFile({ name: "a.docx", size: 1000, type: DOCX })).toEqual({
      ok: true,
      extension: "docx",
    });
  });

  it("accepts an empty or generic MIME type, which some browsers report for DOCX", () => {
    expect(checkResumeFile({ name: "a.docx", size: 1000, type: "" }).ok).toBe(true);
    expect(
      checkResumeFile({ name: "a.pdf", size: 1000, type: "application/octet-stream" }).ok,
    ).toBe(true);
  });

  it("rejects other extensions, including legacy .doc and macro-enabled .docm", () => {
    for (const name of ["a.txt", "a.doc", "a.docm", "a.png", "pdf"]) {
      expect(checkResumeFile({ name, size: 1000, type: "" })).toMatchObject({
        ok: false,
        code: "UNSUPPORTED_TYPE",
      });
    }
  });

  it("rejects a MIME type that contradicts the extension", () => {
    expect(
      checkResumeFile({ name: "a.pdf", size: 1000, type: "image/png" }),
    ).toMatchObject({ ok: false, code: "UNSUPPORTED_TYPE" });
    expect(checkResumeFile({ name: "a.pdf", size: 1000, type: DOCX })).toMatchObject({
      ok: false,
      code: "UNSUPPORTED_TYPE",
    });
  });

  it("rejects empty files", () => {
    expect(checkResumeFile({ name: "a.pdf", size: 0, type: PDF })).toMatchObject({
      ok: false,
      code: "EMPTY_DOCUMENT",
    });
  });

  it("enforces the size limit inclusively", () => {
    expect(
      checkResumeFile({ name: "a.pdf", size: UPLOAD_LIMITS.maxBytes, type: PDF }).ok,
    ).toBe(true);
    expect(
      checkResumeFile({ name: "a.pdf", size: UPLOAD_LIMITS.maxBytes + 1, type: PDF }),
    ).toEqual({
      ok: false,
      code: "FILE_TOO_LARGE",
      sizeBytes: UPLOAD_LIMITS.maxBytes + 1,
    });
  });
});
