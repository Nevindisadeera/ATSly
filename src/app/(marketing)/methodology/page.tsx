import type { Metadata } from "next";
import Link from "next/link";

import { BandChip } from "@/components/data-display";
import { ProsePage } from "@/components/layout/prose";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AtsBand, MatchBand } from "@/types/report";

export const metadata: Metadata = {
  title: "How scoring works",
  description:
    "How ATSly estimates ATS compatibility and job match: six weighted categories, transparent deductions, and clear limits.",
  alternates: { canonical: "/methodology" },
};

const CATEGORIES = [
  {
    name: "Formatting",
    weight: 25,
    measures: "Whether text can be extracted reliably",
    examples: "Tables, text boxes, multi-column layouts, contact details in headers",
  },
  {
    name: "Structure",
    weight: 20,
    measures: "Whether sections and entries can be recognized",
    examples:
      "Standard headings, dates on every role, reverse-chronological order, length",
  },
  {
    name: "Keywords & skills",
    weight: 15,
    measures: "How clearly your skills are stated",
    examples:
      "A dedicated skills section, recognized hard skills, skills backed by experience",
  },
  {
    name: "Content quality",
    weight: 15,
    measures: "How well bullets communicate impact",
    examples: "Action verbs, measurable results, weak phrases such as “responsible for”",
  },
  {
    name: "Completeness",
    weight: 15,
    measures: "Whether essential information is present",
    examples: "Email, phone, location, experience, education, skills",
  },
  {
    name: "Readability",
    weight: 10,
    measures: "How quickly a person can scan it",
    examples: "Bullet length, paragraph blocks, density, consistency",
  },
];

const ATS_BANDS: { band: AtsBand; range: string; meaning: string }[] = [
  {
    band: "excellent",
    range: "85–100",
    meaning: "ATS-ready. Only small refinements remain.",
  },
  { band: "good", range: "70–84", meaning: "Minor improvements will help." },
  { band: "fair", range: "50–69", meaning: "Needs attention before you apply." },
  {
    band: "needs_work",
    range: "0–49",
    meaning: "At risk of being misread or filtered out.",
  },
];

const MATCH_BANDS: { band: MatchBand; range: string }[] = [
  { band: "strong", range: "80–100" },
  { band: "moderate", range: "60–79" },
  { band: "partial", range: "40–59" },
  { band: "low", range: "0–39" },
];

export default function MethodologyPage() {
  return (
    <ProsePage
      eyebrow="Methodology"
      title="How ATSly scores your resume"
      lead="ATSly gives you two separate scores: an estimated ATS compatibility score, and a job match score when you add a job description. Here is exactly how both are calculated."
    >
      <h2 id="what-the-score-is">What the score is, and what it isn&apos;t</h2>
      <p>
        Applicant tracking systems differ, and their exact algorithms are not public. The
        ATSly score is an <strong>estimate</strong> based on widely documented parsing
        behaviors and common recruiter practice. It tells you how likely your resume is to
        be read correctly and found in searches. It does not predict whether a specific
        employer will interview you.
      </p>

      <h2 id="categories">Six categories, published weights</h2>
      <p>
        Your ATS score combines six categories. Each category starts at 100 and loses
        points for every check your resume fails. The overall score is the weighted sum of
        the category scores, rounded to a whole number.
      </p>
      <div className="mt-6 overflow-x-auto rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Weight</TableHead>
              <TableHead className="hidden sm:table-cell">What it measures</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {CATEGORIES.map((c) => (
              <TableRow key={c.name}>
                <TableCell className="font-medium text-foreground">{c.name}</TableCell>
                <TableCell className="text-right tabular-nums">{c.weight}%</TableCell>
                <TableCell className="hidden whitespace-normal sm:table-cell">
                  {c.measures}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p>
        Formatting carries the most weight because a resume that cannot be parsed loses
        value regardless of its content. Keywords are measured here independently of any
        job; how well you match a specific role is scored separately.
      </p>

      <h3>What each category checks</h3>
      <ul>
        {CATEGORIES.map((c) => (
          <li key={c.name}>
            <strong>{c.name}:</strong> {c.examples}.
          </li>
        ))}
      </ul>

      <h2 id="deductions">How deductions work</h2>
      <p>
        Every check has a fixed maximum deduction. Your report lists each deduction with
        the check name, the points, the evidence we found, and how to fix it, so the
        numbers always add up to your score.
      </p>
      <p>
        Some layout features can be detected with certainty in a Word document but only
        estimated in a PDF. When a detection is uncertain, the report labels it{" "}
        <strong>Likely</strong> and the deduction is reduced: by a quarter for medium
        confidence and by half for low confidence. Checks that don&apos;t apply to your
        document are shown as not applicable and deduct nothing.
      </p>

      <h2 id="bands">What your score means</h2>
      <div className="mt-6 grid gap-3">
        {ATS_BANDS.map((b) => (
          <div
            key={b.band}
            className="flex flex-col gap-2 rounded-md border border-border p-4 sm:flex-row sm:items-center sm:gap-4"
          >
            <div className="flex w-44 shrink-0 items-center gap-3">
              <BandChip band={b.band} />
              <span className="text-sm text-subtle tabular-nums">{b.range}</span>
            </div>
            <p className="!mt-0 text-sm">{b.meaning}</p>
          </div>
        ))}
      </div>

      <h2 id="job-match">Job match</h2>
      <p>
        When you add a job description, ATSly extracts its requirements and compares them
        with your resume in three steps: exact terms, recognized equivalents (for example
        “JS” and “JavaScript”), and requirements your experience demonstrates in different
        words. A requirement only counts as met when we can quote the part of your resume
        that shows it.
      </p>
      <ul>
        <li>Required skills and tools: 40%</li>
        <li>Responsibilities your experience aligns with: 20%</li>
        <li>Preferred skills: 10%</li>
        <li>Years of experience: 10%</li>
        <li>Education and certifications: 10%</li>
        <li>Job title and seniority: 10%</li>
      </ul>
      <p>
        If the job description doesn&apos;t mention something, such as years of
        experience, that part is marked as not specified and its weight is shared across
        the rest.
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        {MATCH_BANDS.map((b) => (
          <span key={b.band} className="inline-flex items-center gap-2">
            <BandChip band={b.band} />
            <span className="text-sm text-subtle tabular-nums">{b.range}</span>
          </span>
        ))}
      </div>

      <h2 id="ai">How AI is used</h2>
      <p>
        Almost all of the ATS score comes from rule-based checks that give the same result
        every time. AI is used where judgment helps: rating how well bullets communicate
        impact, recognizing requirements described in different words, and writing
        recommendations.
      </p>
      <ul>
        <li>AI can change your ATS score by at most 3 points.</li>
        <li>
          Any text AI quotes from your resume must exist in your resume, or it is
          discarded.
        </li>
        <li>
          Suggested rewrites keep your facts. Where a number would help, we show a
          placeholder such as [X%] instead of inventing one.
        </li>
        <li>We never recommend adding skills or experience you don&apos;t have.</li>
      </ul>

      <h2 id="limits">Limitations</h2>
      <ul>
        <li>
          No tool can reproduce every ATS. Treat the score as guidance, not a verdict.
        </li>
        <li>
          Resumes in languages other than English are analyzed with reduced accuracy.
        </li>
        <li>
          Scanned or image-only resumes can&apos;t be read and score low on formatting.
        </li>
        <li>A high match score does not guarantee an interview.</li>
      </ul>

      <h2 id="versions">Versions</h2>
      <p>
        Every report records the version of the scoring rules used. When the rules change,
        older reports keep their original scores, so you can compare like with like.
      </p>

      <p className="!mt-14 border-t border-border pt-8">
        Ready to try it? <Link href="/scan">Scan your resume</Link>.
      </p>
    </ProsePage>
  );
}
