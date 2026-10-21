import { describe, expect, it } from "vitest";

import {
  characterCount,
  jobDescriptionHint,
  jobDescriptionPayload,
  jobDescriptionStatus,
} from "@/components/scan/job-description";
import { detectJobTitle } from "@/lib/matching/title";

const text = (length: number) => "x".repeat(length);

describe("job description input", () => {
  it.each([
    ["", "empty"],
    ["   ", "empty"],
    [text(99), "short"],
    [text(100), "ready"],
    [text(599), "ready"],
    [text(600), "complete"],
    [text(15_000), "complete"],
    [text(15_001), "too_long"],
  ] as const)("%#: %s characters → %s", (value, status) => {
    expect(jobDescriptionStatus(value)).toBe(status);
  });

  it("uses the copy deck hints", () => {
    expect(jobDescriptionHint("empty")?.text).toBe(
      "Optional. Paste the full posting for the most accurate match.",
    );
    expect(jobDescriptionHint("short")?.text).toBe(
      "Add at least 100 characters, or skip this step.",
    );
    expect(jobDescriptionHint("complete")).toEqual({
      text: "Looks like a complete posting.",
      tone: "positive",
    });
    expect(jobDescriptionHint("too_long")?.tone).toBe("danger");
    expect(jobDescriptionHint("ready")).toBeNull();
  });

  it("counts trimmed characters", () => {
    expect(characterCount("  a  ")).toBe("1 character");
    expect(characterCount(text(1240))).toBe("1,240 characters");
  });

  it("sends the job description only when it's long enough, without empty fields", () => {
    expect(
      jobDescriptionPayload({ text: text(50), title: "", company: "" }),
    ).toBeUndefined();
    expect(
      jobDescriptionPayload({ text: text(16_000), title: "", company: "" }),
    ).toBeUndefined();
    expect(
      jobDescriptionPayload({
        text: `  ${text(120)}  `,
        title: " Analyst ",
        company: "  ",
      }),
    ).toEqual({ text: text(120), title: "Analyst" });
  });

  it("prefills the title from the posting without loading the taxonomy", () => {
    expect(detectJobTitle("Senior Data Engineer\nAbout us")).toBe("Senior Data Engineer");
  });
});
