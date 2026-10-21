import type { EducationLevel, ParsedResume } from "@/lib/parsing/types";

import {
  SENIORITY_RANK,
  SENIORITY_WORDS,
  TITLE_STOPWORDS,
  TITLE_SYNONYMS,
} from "./lexicon";
import type { FitRow, JobEducationLevel, JobRequirements, Seniority } from "./types";

/** Fit computations — docs/PLANNING.md §19.2. Each returns a 0–100 score or null (na). */

export type Fit = { score: number | null; row: FitRow; flag?: string };

/** "about 3.5 years", rounded to the nearest half year. */
export function describeYears(years: number): string {
  const rounded = Math.round(years * 2) / 2;
  if (rounded === 0) return "less than a year";
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `about ${text} ${rounded === 1 ? "year" : "years"}`;
}

export function resumeYears(resume: ParsedResume): number {
  return (resume.stats.totalExperienceMonths ?? 0) / 12;
}

export function experienceFit(resume: ParsedResume, job: JobRequirements): Fit {
  const { min, max } = job.yearsExperience;
  if (min === null) {
    return {
      score: null,
      row: {
        status: "not_specified",
        detail: "The job description doesn't state years of experience.",
      },
    };
  }
  const years = resumeYears(resume);
  const asked = max !== null ? `${min}–${max} years` : `${min}+ years`;
  const shows = `your resume shows ${describeYears(years)}`;

  if (years >= min) {
    if (max !== null && years > max + 5) {
      return {
        score: 80,
        row: {
          status: "exceeds",
          detail: `The posting asks for ${asked}; ${shows}, so you may be overqualified.`,
        },
      };
    }
    return {
      score: 100,
      row: { status: "meets", detail: `The posting asks for ${asked}; ${shows}.` },
    };
  }
  const gap = min - years;
  const score = gap <= 1 ? 70 : gap <= 2 ? 40 : 10;
  return {
    score,
    row: {
      status: gap <= 1 ? "close" : "gap",
      detail: `The posting asks for ${asked}; ${shows}.`,
    },
    flag: `The posting asks for at least ${min} years of experience; your resume shows ${describeYears(years)}.`,
  };
}

const LEVEL_RANK: Record<EducationLevel | JobEducationLevel, number> = {
  unspecified: 0,
  other: 0,
  highschool: 1,
  associate: 2,
  bachelor: 3,
  master: 4,
  doctorate: 5,
};

const LEVEL_NAME: Record<Exclude<JobEducationLevel, "unspecified">, string> = {
  highschool: "a high school diploma",
  associate: "an associate degree",
  bachelor: "a bachelor's degree",
  master: "a master's degree",
  doctorate: "a doctorate",
};

export function highestEducation(resume: ParsedResume): EducationLevel | null {
  let best: EducationLevel | null = null;
  for (const entry of resume.education) {
    if (entry.level && (!best || LEVEL_RANK[entry.level] > LEVEL_RANK[best]))
      best = entry.level;
  }
  return best;
}

/**
 * Degree level fit, blended 50/50 with coverage of required certifications when the
 * posting asks for any.
 */
export function educationFit(
  resume: ParsedResume,
  job: JobRequirements,
  requiredCertifications: { total: number; matched: number },
): Fit {
  const level = job.education.level;
  const hasCertifications = requiredCertifications.total > 0;
  if (level === "unspecified" && !hasCertifications) {
    return {
      score: null,
      row: {
        status: "not_specified",
        detail: "The job description doesn't state an education requirement.",
      },
    };
  }

  const certificationScore = hasCertifications
    ? Math.round((requiredCertifications.matched / requiredCertifications.total) * 100)
    : null;
  if (level === "unspecified") {
    return {
      score: certificationScore,
      row: {
        status: certificationScore === 100 ? "meets" : "gap",
        detail: `Your resume shows ${requiredCertifications.matched} of ${requiredCertifications.total} required certifications.`,
      },
    };
  }

  const highest = highestEducation(resume);
  const difference = LEVEL_RANK[highest ?? "unspecified"] - LEVEL_RANK[level];
  const degreeScore = difference >= 0 ? 100 : difference === -1 ? 50 : 0;
  const score =
    certificationScore === null
      ? degreeScore
      : Math.round((degreeScore + certificationScore) / 2);

  const asked = LEVEL_NAME[level];
  const shows =
    highest && highest !== "other"
      ? `the highest on your resume is ${LEVEL_NAME[highest]}`
      : "no degree was found on your resume";
  const status =
    difference >= 0
      ? score === 100
        ? "meets"
        : "close"
      : difference === -1
        ? "close"
        : "gap";
  return {
    score,
    row: {
      status,
      detail: `The posting ${job.education.required ? "asks for" : "prefers"} ${asked}${job.education.field ? ` in ${job.education.field}` : ""}; ${shows}.`,
    },
    flag:
      difference < 0 && job.education.required
        ? `The posting asks for ${asked}; ${shows}.`
        : undefined,
  };
}

/** Lowercase title words without seniority markers or filler, with synonyms unified. */
export function titleTokens(title: string): Set<string> {
  const words = title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}+#\s-]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  const tokens = new Set<string>();
  for (const word of words) {
    if (TITLE_STOPWORDS.has(word)) continue;
    tokens.add(TITLE_SYNONYMS[word] ?? word);
  }
  return tokens;
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let shared = 0;
  for (const token of a) if (b.has(token)) shared += 1;
  return shared / (a.size + b.size - shared);
}

export function seniorityOf(
  title: string | undefined,
  years: number,
): Exclude<Seniority, "unspecified"> {
  const fromTitle = title
    ? SENIORITY_WORDS.find((s) => s.pattern.test(title))
    : undefined;
  if (fromTitle) return fromTitle.seniority as Exclude<Seniority, "unspecified">;
  if (years < 2) return "junior";
  if (years < 5) return "mid";
  if (years < 8) return "senior";
  return "lead";
}

const SENIORITY_SCORE = [100, 70, 40];

/** Title word overlap blended 50/50 with distance on the seniority ladder (§19.2). */
export function titleFit(resume: ParsedResume, job: JobRequirements): Fit {
  if (!job.jobTitle) {
    return {
      score: null,
      row: {
        status: "not_specified",
        detail: "The job description doesn't name a job title.",
      },
    };
  }
  const wanted = titleTokens(job.jobTitle);
  const titles = resume.experience
    .map((e) => e.title)
    .filter((t): t is string => Boolean(t))
    .slice(0, 3);
  let best = { title: titles[0], similarity: 0 };
  for (const title of titles) {
    const similarity = jaccard(wanted, titleTokens(title));
    if (similarity > best.similarity) best = { title, similarity };
  }
  const titleScore = Math.round(best.similarity * 100);

  let score = titleScore;
  if (job.seniority !== "unspecified") {
    const mine = seniorityOf(titles[0], resumeYears(resume));
    const distance = Math.abs(SENIORITY_RANK[mine] - SENIORITY_RANK[job.seniority]);
    const seniorityScore = SENIORITY_SCORE[distance] ?? 10;
    score = Math.round((titleScore + seniorityScore) / 2);
  }

  const detail = best.title
    ? `Your closest title, “${best.title}”, compared with “${job.jobTitle}”.`
    : `No job titles were found on your resume to compare with “${job.jobTitle}”.`;
  return {
    score,
    row: { status: score >= 70 ? "meets" : score >= 40 ? "close" : "gap", detail },
  };
}
