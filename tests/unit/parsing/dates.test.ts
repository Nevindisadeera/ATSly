import { describe, expect, it } from "vitest";

import {
  findDateRange,
  findDates,
  parseDateToken,
  totalMonths,
} from "@/lib/parsing/parse/dates";

describe("parseDateToken", () => {
  it.each([
    ["Jan 2021", { year: 2021, month: 1 }, "mon-yyyy"],
    ["Sept. 2019", { year: 2019, month: 9 }, "mon-yyyy"],
    ["January, 2021", { year: 2021, month: 1 }, "month-yyyy"],
    ["Mar '22", { year: 2022, month: 3 }, "mon-yyyy"],
    ["03/2020", { year: 2020, month: 3 }, "mm/yyyy"],
    ["2020-07", { year: 2020, month: 7 }, "yyyy-mm"],
    ["2018", { year: 2018 }, "yyyy"],
  ])("reads %s", (token, date, format) => {
    expect(parseDateToken(token)).toEqual({ date, format });
  });

  it("rejects non-dates", () => {
    expect(parseDateToken("13/2020")).toBeNull();
    expect(parseDateToken("Spring")).toBeNull();
  });
});

describe("findDateRange", () => {
  it("reads ranges with different separators and an open end", () => {
    expect(findDateRange("Senior Engineer, Acme — Jan 2021 – Present")).toMatchObject({
      start: { year: 2021, month: 1 },
      end: "present",
      raw: "Jan 2021 – Present",
      formats: ["mon-yyyy"],
    });
    expect(findDateRange("2016 to 2019")).toMatchObject({
      start: { year: 2016 },
      end: { year: 2019 },
      formats: ["yyyy", "yyyy"],
    });
    expect(findDateRange("06/2019 - 08/2021")?.formats).toEqual(["mm/yyyy", "mm/yyyy"]);
  });

  it("lets a month-only start borrow the end year", () => {
    expect(findDateRange("Intern\tJun – Aug 2022")).toMatchObject({
      start: { year: 2022, month: 6 },
      end: { year: 2022, month: 8 },
    });
  });

  it("ignores reversed ranges and phone numbers", () => {
    expect(findDateRange("2021 - 2019")).toBeNull();
    expect(findDateRange("+1 555 010 2000")).toBeNull();
  });
});

describe("findDates", () => {
  it("finds standalone dates", () => {
    expect(findDates("AWS Certified Developer, May 2023").map((d) => d.date)).toEqual([
      { year: 2023, month: 5 },
    ]);
    expect(findDates("BSc Computer Science, 2019").map((d) => d.date)).toEqual([
      { year: 2019 },
    ]);
  });
});

describe("totalMonths", () => {
  const asOf = new Date(Date.UTC(2026, 9, 1)); // October 2026

  it("adds ranges and counts overlaps once", () => {
    expect(
      totalMonths(
        [
          { start: { year: 2020, month: 1 }, end: { year: 2021, month: 1 } }, // 12
          { start: { year: 2020, month: 7 }, end: { year: 2021, month: 7 } }, // overlaps, +6
          { start: { year: 2023, month: 1 }, end: { year: 2023, month: 4 } }, // 3
        ],
        asOf,
      ),
    ).toBe(21);
  });

  it("treats present as the reference date", () => {
    expect(
      totalMonths([{ start: { year: 2025, month: 10 }, end: "present" }], asOf),
    ).toBe(12);
  });
});
