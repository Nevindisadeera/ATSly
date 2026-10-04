import type { AtsBand, MatchBand, Severity } from "@/types/report";

/**
 * Illustrative report shown on the landing page. Numbers match the worked example in
 * docs/PLANNING.md §18.5 so the marketing site and the methodology tell the same story.
 */
export const SAMPLE_REPORT = {
  fileName: "sample-resume.pdf",
  ats: { score: 74, band: "good" as AtsBand },
  match: { score: 68, band: "moderate" as MatchBand },
  headline: "Strong formatting. Content quality needs the most attention.",
  categories: [
    { label: "Formatting", weight: 25, score: 87 },
    { label: "Structure", weight: 20, score: 69 },
    { label: "Completeness", weight: 15, score: 87 },
    { label: "Keywords & skills", weight: 15, score: 74 },
    { label: "Content quality", weight: 15, score: 61 },
    { label: "Readability", weight: 10, score: 55 },
  ],
  issues: [
    {
      title: "Few bullets show measurable results",
      severity: "major" as Severity,
      points: 25,
    },
    {
      title: "Experience entries missing dates",
      severity: "major" as Severity,
      points: 15,
    },
  ],
  matched: ["TypeScript", "React", "REST APIs", "Testing"],
  missing: [
    { term: "GraphQL", importance: "required" as const },
    { term: "Accessibility", importance: "required" as const },
    { term: "Next.js", importance: "preferred" as const },
  ],
  evidence: {
    requirement: "Build accessible, responsive interfaces",
    text: "Rebuilt the checkout flow in React with keyboard support and screen-reader labels, lifting mobile conversion by 9%.",
    location: "Experience › Northwind › bullet 1",
  },
} as const;
