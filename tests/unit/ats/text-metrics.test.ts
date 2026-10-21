import { describe, expect, it } from "vitest";

import {
  buzzwordCount,
  countTerm,
  hasFirstPerson,
  isPassive,
  isQuantified,
  openingVerb,
  readingGrade,
  startsWithActionVerb,
  syllables,
  weakPhrasesIn,
} from "@/lib/ats/text-metrics";

describe("text metrics", () => {
  it("finds the opening verb, skipping a leading adverb and punctuation", () => {
    expect(openingVerb("Led a team of five")).toBe("led");
    expect(openingVerb("Successfully launched 3 apps")).toBe("launched");
    expect(openingVerb("“Built” the pipeline")).toBe("built");
    expect(startsWithActionVerb("Responsible for testing")).toBe(false);
    expect(startsWithActionVerb("Spearheaded the migration")).toBe(true);
  });

  it("treats numbers, currency, percentages and number words as quantified", () => {
    expect(isQuantified("Cut costs by 20%")).toBe(true);
    expect(isQuantified("Saved $40k")).toBe(true);
    expect(isQuantified("Doubled sign-ups in a quarter")).toBe(true);
    expect(isQuantified("Managed a team of twelve")).toBe(true);
    expect(isQuantified("Improved the onboarding flow")).toBe(false);
  });

  it("detects passive voice", () => {
    expect(isPassive("Costs were reduced across regions")).toBe(true);
    expect(isPassive("The service was built in Go")).toBe(true);
    expect(isPassive("Reduced costs across regions")).toBe(false);
  });

  it("detects first-person pronouns as words, with 'I' only in capitals", () => {
    expect(hasFirstPerson("I led the team")).toBe(true);
    expect(hasFirstPerson("Grew our revenue")).toBe(true);
    expect(hasFirstPerson("Led an iOS migration")).toBe(false);
    expect(hasFirstPerson("Improved mean time to recovery")).toBe(false);
  });

  it("finds weak phrases and buzzwords case-insensitively", () => {
    expect(weakPhrasesIn("Responsible for billing and worked on reports")).toEqual([
      "responsible for",
      "worked on",
    ]);
    expect(buzzwordCount("A Results-Driven, passionate and passionate engineer")).toEqual(
      {
        count: 3,
        found: ["results-driven", "passionate"],
      },
    );
  });

  it("counts whole-word terms, matching short terms by exact case", () => {
    expect(countTerm("Python, python and pythonic code", "Python")).toBe(2);
    expect(countTerm("Go services; go to market", "Go")).toBe(1);
    expect(countTerm("C++ and C# and C", "C++")).toBe(1);
  });

  it("estimates syllables and reading grade", () => {
    expect(syllables("cat")).toBe(1);
    expect(syllables("engineer")).toBe(3);
    expect(syllables("organization")).toBe(5);
    expect(readingGrade(["Led a team", "Built apps"])).toBeNull();
    const grade = readingGrade([
      "Led a team of five",
      "Built a new app",
      "Cut costs by half",
    ]);
    expect(grade).not.toBeNull();
    expect(grade!).toBeLessThan(6);
  });
});
