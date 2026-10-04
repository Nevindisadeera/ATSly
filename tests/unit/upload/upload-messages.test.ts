import { describe, expect, it } from "vitest";

import { uploadErrorMessage } from "@/components/scan/upload-messages";
import type { UploadErrorCode } from "@/hooks/use-upload";

const CODES: UploadErrorCode[] = [
  "INVALID_INPUT",
  "FILE_TOO_LARGE",
  "UNSUPPORTED_TYPE",
  "EMPTY_DOCUMENT",
  "ENCRYPTED_DOCUMENT",
  "PARSE_FAILED",
  "TOO_MANY_PAGES",
  "RATE_LIMITED",
  "UNAUTHENTICATED",
  "NOT_FOUND",
  "SERVICE_UNAVAILABLE",
  "INTERNAL",
  "NETWORK_ERROR",
  "ABORTED",
  "MULTIPLE_FILES",
];

describe("uploadErrorMessage", () => {
  it.each(CODES)("has calm, human copy for %s", (code) => {
    const { title, hint } = uploadErrorMessage(code);
    expect(title.length).toBeGreaterThan(0);
    expect(`${title} ${hint ?? ""}`).not.toMatch(/!|error code|exception|undefined/i);
  });

  it("states the actual size and the limit for oversized files", () => {
    expect(uploadErrorMessage("FILE_TOO_LARGE", 6.2 * 1024 * 1024).title).toBe(
      "This file is 6.2 MB. The limit is 4 MB.",
    );
  });

  it("uses the plan's wording for unreadable files", () => {
    expect(uploadErrorMessage("PARSE_FAILED").title).toBe(
      "We couldn't read this file. It may be corrupted or password-protected.",
    );
  });
});
