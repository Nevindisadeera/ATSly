import { describe, expect, it } from "vitest";

import { formatBytes, pluralize } from "@/lib/utils/format";

describe("formatBytes", () => {
  it.each([
    [0, "0 B"],
    [512, "512 B"],
    [1024, "1 KB"],
    [540 * 1024, "540 KB"],
    [4 * 1024 * 1024, "4 MB"],
    [6.2 * 1024 * 1024, "6.2 MB"],
    [24 * 1024 * 1024, "24 MB"],
    [-1, "0 KB"],
  ])("formats %d as %s", (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected);
  });
});

describe("pluralize", () => {
  it("handles one, many and thousands", () => {
    expect(pluralize(1, "page")).toBe("1 page");
    expect(pluralize(2, "page")).toBe("2 pages");
    expect(pluralize(1240, "word")).toBe("1,240 words");
  });
});
