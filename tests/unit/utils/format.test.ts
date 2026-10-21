import { describe, expect, it } from "vitest";

import {
  formatBytes,
  formatDate,
  formatDateRange,
  formatYearMonth,
  pluralize,
} from "@/lib/utils/format";

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

describe("formatDate", () => {
  it("formats in UTC, so server and browser agree", () => {
    expect(formatDate("2026-10-04T23:30:00.000Z")).toBe("4 Oct 2026");
    expect(formatDate(new Date(Date.UTC(2026, 0, 31)))).toBe("31 Jan 2026");
  });
});

describe("formatDateRange", () => {
  it("formats months, years, open ends and single dates", () => {
    expect(formatDateRange({ year: 2021, month: 3 }, "present")).toBe(
      "Mar 2021 – Present",
    );
    expect(formatDateRange({ year: 2017 }, { year: 2021, month: 2 })).toBe(
      "2017 – Feb 2021",
    );
    expect(formatDateRange({ year: 2020, month: 6 }, { year: 2020, month: 6 })).toBe(
      "Jun 2020",
    );
    expect(formatDateRange(undefined, { year: 2019 })).toBe("2019");
    expect(formatDateRange()).toBe("");
  });

  it("formats a single year-month", () => {
    expect(formatYearMonth({ year: 2024, month: 12 })).toBe("Dec 2024");
    expect(formatYearMonth({ year: 2024 })).toBe("2024");
  });
});
