import { describe, expect, it } from "vitest";

import { initialUploadState, uploadReducer, type UploadState } from "@/hooks/use-upload";
import type { ResumeUploadResult } from "@/types/api";

const file = { name: "resume.pdf", size: 2048 };
const result: ResumeUploadResult = {
  id: "r1",
  fileName: "resume.pdf",
  extension: "pdf",
  sizeBytes: 2048,
  pageCount: null,
  wordCount: null,
  sections: [],
  warnings: [],
};

describe("uploadReducer", () => {
  it("walks the happy path: uploading → processing → ready", () => {
    let s: UploadState = uploadReducer(initialUploadState, { type: "start", file });
    expect(s).toEqual({ phase: "uploading", file, progress: 0 });
    s = uploadReducer(s, { type: "progress", percent: 40 });
    expect(s).toMatchObject({ progress: 40 });
    s = uploadReducer(s, { type: "uploaded" });
    expect(s).toEqual({ phase: "processing", file });
    s = uploadReducer(s, { type: "success", result });
    expect(s).toEqual({ phase: "ready", file, result });
  });

  it("never moves progress backwards or past 100", () => {
    let s = uploadReducer(initialUploadState, { type: "start", file });
    s = uploadReducer(s, { type: "progress", percent: 70 });
    s = uploadReducer(s, { type: "progress", percent: 30 });
    expect(s).toMatchObject({ progress: 70 });
    s = uploadReducer(s, { type: "progress", percent: 140 });
    expect(s).toMatchObject({ progress: 100 });
  });

  it("ignores late progress and success events after a reset", () => {
    let s = uploadReducer(initialUploadState, { type: "start", file });
    s = uploadReducer(s, { type: "reset" });
    expect(uploadReducer(s, { type: "progress", percent: 50 })).toBe(s);
    expect(uploadReducer(s, { type: "success", result })).toBe(s);
    expect(uploadReducer(s, { type: "uploaded" })).toBe(s);
  });

  it("records failures with their source", () => {
    const s = uploadReducer(initialUploadState, {
      type: "fail",
      file,
      code: "FILE_TOO_LARGE",
      source: "client",
    });
    expect(s).toEqual({ phase: "error", file, code: "FILE_TOO_LARGE", source: "client" });
  });

  it("starts a fresh upload from an error", () => {
    const failed = uploadReducer(initialUploadState, {
      type: "fail",
      file,
      code: "NETWORK_ERROR",
      source: "server",
    });
    expect(uploadReducer(failed, { type: "start", file })).toEqual({
      phase: "uploading",
      file,
      progress: 0,
    });
  });
});
