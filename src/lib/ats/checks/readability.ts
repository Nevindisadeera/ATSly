import { isPassive, percent, plural, readingGrade, wordsOf } from "../text-metrics";
import type { Check } from "../types";
import { englishOnly, notApplicable, pass, problem, sample } from "./helpers";

/** Readability (weight 10): can a recruiter scan it quickly? — §18.4. */

const MIN_BULLETS = 3;
const tooFewBullets = () => notApplicable(`Needs at least ${MIN_BULLETS} bullet points.`);

function sentencesOf(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** True when the minority style still covers at least a fifth of the items. */
function mixed(matching: number, total: number): boolean {
  const share = matching / total;
  return share >= 0.2 && share <= 0.8;
}

export const readabilityChecks: Check[] = [
  {
    id: "R01",
    category: "readability",
    title: "Average bullet length",
    rule: "Average bullet over 32 words: −15. Under 7 words: −8.",
    maxDeduction: 15,
    severity: "minor",
    confidence: "high",
    fix: "Aim for bullets of about 12 to 25 words. Split long ones and add detail to very short ones.",
    run({ bullets }) {
      if (bullets.length < MIN_BULLETS) return tooFewBullets();
      const average =
        bullets.reduce((sum, b) => sum + wordsOf(b.text).length, 0) / bullets.length;
      const rounded = Math.round(average);
      if (average > 32)
        return problem(15, `Bullets average ${rounded} words, which is hard to scan.`, [
          { count: rounded },
        ]);
      if (average < 7)
        return problem(
          8,
          `Bullets average only ${rounded} words, too short to show what you achieved.`,
          [{ count: rounded }],
        );
      return pass(`Bullets average ${rounded} words.`);
    },
  },
  {
    id: "R02",
    category: "readability",
    title: "Paragraph blocks in experience",
    rule: "Any experience item over 50 words: −25.",
    maxDeduction: 25,
    severity: "major",
    confidence: "high",
    fix: "Break long paragraphs into bullet points, one achievement each.",
    strength: "Experience written as scannable bullets",
    run({ resume }) {
      if (resume.experience.length === 0) return notApplicable("No experience entries.");
      const blocks = resume.experience.flatMap((e) =>
        e.bullets
          .filter((b) => wordsOf(b).length > 50)
          .map((b) => ({
            text: b,
            location: `Experience › ${e.company ?? e.title ?? "Role"}`,
          })),
      );
      return blocks.length === 0
        ? pass("Experience is written in short items.")
        : problem(
            25,
            `${plural(blocks.length, "paragraph")} of more than 50 words ${blocks.length === 1 ? "was" : "were"} found in your experience. Recruiters skim, and long blocks get skipped.`,
            sample(blocks).map((b) => ({ excerpt: b.text, location: b.location })),
          );
    },
  },
  {
    id: "R03",
    category: "readability",
    title: "Text density",
    rule: "More than 650 words per page: −15.",
    maxDeduction: 15,
    severity: "minor",
    confidence: "high",
    fix: "Cut less relevant detail or older roles so each page has room to breathe.",
    run({ resume }) {
      const perPage = resume.stats.wordsPerPage;
      return perPage <= 650
        ? pass(`About ${perPage} words per page.`)
        : problem(
            15,
            `About ${perPage} words per page makes the resume dense and slow to scan.`,
            [{ count: perPage }],
          );
    },
  },
  {
    id: "R04",
    category: "readability",
    title: "Passive voice",
    rule: "Passive voice in more than 20% of bullets: −10. English only.",
    maxDeduction: 10,
    severity: "minor",
    confidence: "medium",
    fix: "Write in the active voice: “Reduced costs by 20%” rather than “Costs were reduced by 20%”.",
    run({ bullets, resume }) {
      if (bullets.length < MIN_BULLETS) return tooFewBullets();
      const skip = englishOnly(resume);
      if (skip) return skip;
      const passive = bullets.filter((b) => isPassive(b.text));
      return passive.length / bullets.length <= 0.2
        ? pass("Bullets are mostly in the active voice.")
        : problem(
            10,
            `${percent(passive.length, bullets.length)}% of bullets use the passive voice, which hides who did the work.`,
            sample(passive).map((b) => ({ excerpt: b.text, location: b.location })),
          );
    },
  },
  {
    id: "R05",
    category: "readability",
    title: "Reading level",
    rule: "Flesch–Kincaid grade above 14 on bullets and summary: −10. English only.",
    maxDeduction: 10,
    severity: "info",
    confidence: "medium",
    fix: "Use shorter sentences and plainer words where you can.",
    run({ bullets, resume }) {
      const skip = englishOnly(resume);
      if (skip) return skip;
      const sentences = [
        ...bullets.map((b) => b.text),
        ...sentencesOf(resume.summary?.text ?? ""),
      ];
      const grade = readingGrade(sentences);
      if (grade === null) return notApplicable("Not enough sentences to measure.");
      const rounded = Math.round(grade);
      return grade <= 14
        ? pass(`Reading grade is about ${Math.max(1, rounded)}.`)
        : problem(
            10,
            `Reading grade is about ${rounded}, which is harder to skim than needed.`,
            [{ count: rounded }],
          );
    },
  },
  {
    id: "R06",
    category: "readability",
    title: "Bullet punctuation",
    rule: "Between 20% and 80% of bullets end with a full stop: −5.",
    maxDeduction: 5,
    severity: "info",
    confidence: "high",
    fix: "End either all bullets or none of them with a full stop.",
    run({ bullets }) {
      if (bullets.length < MIN_BULLETS) return tooFewBullets();
      const withPeriod = bullets.filter((b) => /\.\s*$/.test(b.text)).length;
      return !mixed(withPeriod, bullets.length)
        ? pass("Bullets end consistently.")
        : problem(
            5,
            `${withPeriod} of ${bullets.length} bullets end with a full stop and the rest don't.`,
            [{ count: withPeriod }],
          );
    },
  },
  {
    id: "R07",
    category: "readability",
    title: "Bullet capitalization",
    rule: "Between 20% and 80% of bullets start in lowercase: −5.",
    maxDeduction: 5,
    severity: "info",
    confidence: "high",
    fix: "Start every bullet with a capital letter.",
    run({ bullets }) {
      const lettered = bullets.filter((b) => /^\p{L}/u.test(b.text));
      if (lettered.length < MIN_BULLETS) return tooFewBullets();
      const lower = lettered.filter((b) => /^\p{Ll}/u.test(b.text));
      return !mixed(lower.length, lettered.length)
        ? pass("Bullets are capitalized consistently.")
        : problem(
            5,
            `${plural(lower.length, "bullet")} ${lower.length === 1 ? "starts" : "start"} with a lowercase letter while the rest are capitalized.`,
            sample(lower).map((b) => ({ excerpt: b.text, location: b.location })),
          );
    },
  },
  {
    id: "R08",
    category: "readability",
    title: "Long summary sentences",
    rule: "Any summary sentence over 35 words: −7.",
    maxDeduction: 7,
    severity: "minor",
    confidence: "high",
    fix: "Keep summary sentences under 25 words.",
    run({ resume }) {
      const summary = resume.summary?.text.trim();
      if (!summary) return notApplicable("No summary.");
      const long = sentencesOf(summary).filter((s) => wordsOf(s).length > 35);
      return long.length === 0
        ? pass("Summary sentences are a readable length.")
        : problem(
            7,
            `${plural(long.length, "summary sentence")} ${long.length === 1 ? "is" : "are"} longer than 35 words.`,
            sample(long).map((excerpt) => ({ excerpt, location: "Summary" })),
          );
    },
  },
];
