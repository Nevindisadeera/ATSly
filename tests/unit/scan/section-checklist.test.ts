import { describe, expect, it } from "vitest";

import { sectionChecklist } from "@/components/scan/section-checklist-items";

describe("sectionChecklist", () => {
  it("always lists the core sections, marking the missing ones", () => {
    expect(sectionChecklist([{ kind: "experience" }, { kind: "skills" }])).toEqual([
      { kind: "experience", label: "Experience", found: true },
      { kind: "education", label: "Education", found: false },
      { kind: "skills", label: "Skills", found: true },
      { kind: "summary", label: "Summary", found: false },
    ]);
  });

  it("adds other sections that were found, in a fixed order, without duplicates", () => {
    const items = sectionChecklist([
      { kind: "languages" },
      { kind: "projects" },
      { kind: "projects" },
      { kind: "experience" },
    ]);
    expect(items.slice(4).map((i) => i.label)).toEqual(["Projects", "Languages"]);
  });

  it("leaves out contact and unclassified sections", () => {
    const kinds = sectionChecklist([{ kind: "contact" }, { kind: "other" }]).map(
      (i) => i.kind,
    );
    expect(kinds).toEqual(["experience", "education", "skills", "summary"]);
  });
});
