import { describe, expect, it } from "vitest";

import { createScanSchema } from "@/lib/validation/scan";

describe("createScanSchema", () => {
  it("accepts a resume id and nothing else", () => {
    expect(createScanSchema.safeParse({ resumeId: "a".repeat(24) }).success).toBe(true);
    expect(createScanSchema.safeParse({ resumeId: "A1".repeat(12) }).success).toBe(true);
    expect(createScanSchema.safeParse({ resumeId: "a".repeat(23) }).success).toBe(false);
    expect(createScanSchema.safeParse({ resumeId: { $ne: null } }).success).toBe(false);
    expect(
      createScanSchema.safeParse({
        resumeId: "a".repeat(24),
        jobDescription: { text: "x" },
      }).success,
    ).toBe(false);
  });
});
