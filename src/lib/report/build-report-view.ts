import "server-only";

import { BAND_DESCRIPTIONS, recognizedSkillUsage } from "@/lib/ats";
import type { AtsReport, CategoryKey, CheckResult } from "@/lib/ats/types";
import type { MatchedTerm, MatchReport } from "@/lib/matching/types";
import type { ParsedResume } from "@/lib/parsing/types";
import { formatDate, formatDateRange } from "@/lib/utils/format";
import { SECTION_LABELS } from "@/lib/utils/section-labels";
import type { ResumeSectionKind, ScanAiStatus, ScanDetail } from "@/types/api";

import {
  buildRecommendationsView,
  checkAnchor,
  quoteLocator,
  type QuoteLocator,
} from "./build-recommendations-view";
import type {
  CheckView,
  IssueGroupView,
  KeywordsView,
  MatchedTermView,
  MatchView,
  ParsedEntryView,
  ParsedResumeView,
  ParsedSectionView,
  ReportView,
  TopActionView,
} from "./types";

/** Keyword hygiene checks summarized in the Keywords & skills section. */
const HYGIENE_CHECKS = ["K04", "K05", "K06", "K07"];
const IS_ISSUE = (c: CheckResult) => c.status === "fail" || c.status === "warn";

function toCheckView(check: CheckResult): CheckView {
  return {
    id: check.id,
    anchor: checkAnchor(check.id),
    title: check.title,
    status: check.status,
    severity: check.severity,
    certainty: check.confidence === "high" ? "Detected" : "Likely",
    points: check.deduction,
    explanation: check.explanation,
    fix: check.fix,
    evidence: check.evidence,
  };
}

/** The three most valuable fixes: largest deductions first, each fix once. */
export function topActions(ats: AtsReport, limit = 3): TopActionView[] {
  const seen = new Set<string>();
  const actions: TopActionView[] = [];
  for (const issue of ats.issues) {
    if (!issue.fix || seen.has(issue.fix)) continue;
    seen.add(issue.fix);
    actions.push({ anchor: checkAnchor(issue.id), title: issue.title, fix: issue.fix });
    if (actions.length === limit) break;
  }
  return actions;
}

function issueGroups(ats: AtsReport): IssueGroupView[] {
  return ats.categories.map((category) => ({
    key: category.key,
    label: category.label,
    score: category.score,
    issues: category.checks
      .filter(IS_ISSUE)
      .sort((a, b) => b.deduction - a.deduction)
      .map(toCheckView),
    passed: category.checks.filter((c) => c.status === "pass").map(toCheckView),
    notApplicable: category.checks.filter((c) => c.status === "na").map(toCheckView),
  }));
}

export function buildKeywordsView(ats: AtsReport, resume: ParsedResume): KeywordsView {
  const usage = recognizedSkillUsage(resume);
  const groups = new Map<string, { term: string; backed: boolean }[]>();
  for (const { skill, backed } of usage) {
    const category = skill.category ?? "Other";
    const list = groups.get(category) ?? [];
    list.push({ term: skill.raw, backed });
    groups.set(category, list);
  }
  const checks = ats.categories.flatMap((c) => c.checks);
  return {
    // Largest groups first, so the resume's main skill areas lead.
    groups: [...groups.entries()]
      .map(([category, skills]) => ({ category, skills }))
      .sort((a, b) => b.skills.length - a.skills.length),
    backedCount: usage.filter((u) => u.backed).length,
    recognizedCount: usage.length,
    unrecognized: resume.skills.filter((s) => !s.taxonomyId).map((s) => s.raw),
    hygiene: HYGIENE_CHECKS.map((id) => checks.find((c) => c.id === id))
      .filter((c): c is CheckResult => c !== undefined)
      .map(toCheckView),
  };
}

function experienceEntry(entry: ParsedResume["experience"][number]): ParsedEntryView {
  const flags: string[] = [];
  if (!entry.title) flags.push("We weren't sure which line is the job title.");
  if (!entry.company) flags.push("We couldn't find the company name.");
  if (!entry.start) flags.push("No dates were found for this role.");
  return {
    heading: entry.title ?? entry.company ?? "Untitled role",
    subheading: entry.title ? entry.company : undefined,
    meta: [formatDateRange(entry.start, entry.end), entry.location]
      .filter(Boolean)
      .join(" · "),
    details: entry.bullets,
    flags,
  };
}

function educationEntry(entry: ParsedResume["education"][number]): ParsedEntryView {
  const flags: string[] = [];
  if (!entry.institution) flags.push("We couldn't find the school or university.");
  if (!entry.degree) flags.push("We weren't sure which line is the qualification.");
  return {
    heading: entry.degree ?? entry.institution ?? entry.rawText.split("\n")[0] ?? "",
    subheading: entry.degree ? entry.institution : undefined,
    meta: [
      entry.field && entry.field !== entry.degree ? entry.field : "",
      formatDateRange(entry.start, entry.end),
    ]
      .filter(Boolean)
      .join(" · "),
    details: [],
    flags,
  };
}

/** Kinds whose contents the parser breaks down; others are listed by name only. */
const DETAILED: ResumeSectionKind[] = [
  "summary",
  "experience",
  "education",
  "skills",
  "projects",
  "certifications",
  "languages",
];

export function buildParsedView(resume: ParsedResume): ParsedResumeView {
  const c = resume.contact;
  const contact = [
    { label: "Name", value: c.name },
    { label: "Email", value: c.email },
    { label: "Phone", value: c.phone },
    { label: "Location", value: c.location },
    ...c.links.map((link) => ({
      label:
        link.type === "linkedin"
          ? "LinkedIn"
          : link.type === "github"
            ? "GitHub"
            : link.type === "portfolio"
              ? "Portfolio"
              : "Link",
      value: link.url,
    })),
  ].filter((field): field is { label: string; value: string } => Boolean(field.value));

  const contactFlags: string[] = [];
  if (!c.name) contactFlags.push("We couldn't find your name at the top.");
  if (!c.email) contactFlags.push("No email address was found.");
  if (c.inHeaderOrFooter)
    contactFlags.push("Some contact details were only in the page header or footer.");

  const found = new Set(resume.sections.map((s) => s.kind));
  const sections: ParsedSectionView[] = [];
  const add = (
    kind: ResumeSectionKind,
    view: Omit<ParsedSectionView, "kind" | "label">,
  ) => sections.push({ kind, label: SECTION_LABELS[kind], ...view });

  if (resume.summary?.text) add("summary", { text: resume.summary.text, entries: [] });
  if (resume.experience.length > 0)
    add("experience", { entries: resume.experience.map(experienceEntry) });
  if (resume.education.length > 0)
    add("education", { entries: resume.education.map(educationEntry) });
  if (resume.skills.length > 0)
    add("skills", { entries: [], list: resume.skills.map((s) => s.raw) });
  if (resume.projects.length > 0)
    add("projects", {
      entries: resume.projects.map((p) => ({
        heading: p.name ?? "Untitled project",
        meta: p.technologies.join(", ") || undefined,
        details: p.bullets,
        flags: p.name ? [] : ["We weren't sure which line is the project name."],
      })),
    });
  if (resume.certifications.length > 0)
    add("certifications", {
      entries: resume.certifications.map((cert) => ({
        heading: cert.name,
        meta:
          [cert.issuer, cert.date ? formatDateRange(cert.date) : ""]
            .filter(Boolean)
            .join(" · ") || undefined,
        details: [],
        flags: [],
      })),
    });
  if (resume.languages.length > 0)
    add("languages", {
      entries: [],
      list: resume.languages.map((l) => (l.level ? `${l.name} (${l.level})` : l.name)),
    });

  const otherSections = [...found]
    .filter((kind) => kind !== "contact" && !DETAILED.includes(kind))
    .map((kind) => SECTION_LABELS[kind]);

  return { contact, contactFlags, sections, otherSections };
}

function matchHow(term: MatchedTerm): string {
  if (term.matchType === "exact") return "Exact match";
  if (term.matchType === "normalized") return "Matched as a related term";
  return term.partial ? "Partly matched by AI" : "Matched by AI";
}

/** Why matching may have missed skills described in other words — §20 degradation. */
function precisionNote(aiStatus: ScanAiStatus | null): string | null {
  if (aiStatus === "complete") return null;
  if (aiStatus === "partial" || aiStatus === "failed")
    return "Part of the AI review didn't finish, so skills your resume describes in other words may not have been matched.";
  return "Matched on exact names and known related terms only. Skills your resume describes in other words are recognized by AI review, which didn't run for this scan.";
}

const FIT_STATUS: Record<MatchView["fit"][number]["status"], string> = {
  meets: "Meets",
  exceeds: "Exceeds",
  close: "Close",
  gap: "Gap",
  not_specified: "Not specified",
};

const FIT_LABELS = {
  experience: "Experience",
  education: "Education & certifications",
  title: "Title & seniority",
} as const;

/** The job match section — docs/PLANNING.md §7.3, section 7, and §19.3. */
export function buildMatchView(
  match: MatchReport,
  options: { aiStatus: ScanAiStatus | null; locate: QuoteLocator },
): MatchView {
  const { locate } = options;
  const matched = (importance: "required" | "preferred"): MatchedTermView[] =>
    match.matched
      .filter((m) => m.importance === importance && m.kind !== "soft")
      .map((m) => ({
        term: m.term,
        kind: m.kind,
        importance: m.importance,
        how: matchHow(m),
        partial: m.partial === true,
        byAi: m.matchType === "semantic",
        evidence: m.evidence,
        // AI evidence is a verified quote without a location; find it in the resume.
        location: m.location ?? (m.evidence ? locate(m.evidence) : undefined),
      }));
  const missing = (importance: "required" | "preferred") =>
    match.missing
      .filter((m) => m.importance === importance)
      .map((m) => ({ term: m.term, kind: m.kind, suggestion: m.suggestion }));

  return {
    score: match.score,
    band: match.band,
    components: match.components.map((c) => ({
      key: c.key,
      label: c.label,
      weight: c.weight,
      effectiveWeight: Math.round(c.effectiveWeight * 10) / 10,
      score: c.score,
      note: c.note,
    })),
    redistributed: match.components.some((c) => c.score === null),
    matchedRequired: matched("required"),
    matchedPreferred: matched("preferred"),
    missingRequired: missing("required"),
    missingPreferred: missing("preferred"),
    fit: (["experience", "education", "title"] as const).map((key) => ({
      key,
      label: FIT_LABELS[key],
      status: match.fit[key].status,
      statusLabel: FIT_STATUS[match.fit[key].status],
      detail: match.fit[key].detail,
    })),
    honestyFlags: match.honestyFlags,
    strongMatches: match.strongMatches.map((m) => ({
      ...m,
      location: locate(m.evidence),
    })),
    weakMatches: match.weakMatches,
    precisionNote: precisionNote(options.aiStatus),
  };
}

/**
 * The results page view of a complete scan. `resume` is null when the resume behind the
 * report is no longer stored; the report itself is self-contained.
 */
export function buildReportView(
  scan: ScanDetail,
  resume: ParsedResume | null,
): ReportView {
  const ats = scan.ats;
  if (scan.status !== "complete" || !ats || !scan.summary) {
    throw new Error("buildReportView needs a complete scan");
  }
  const weightedTotal =
    ats.categories.reduce((sum, c) => sum + c.score * c.weight, 0) / 100;
  const recommendations = buildRecommendationsView({
    ai: scan.ai,
    resume,
    resumeId: scan.resume.id,
    hasJob: scan.job !== null,
  });
  // Top actions open their recommendation (§7.3); the check itself when there is none.
  const recommendationFor = new Map(
    recommendations.items
      .filter((rec) => rec.checkAnchor)
      .map((rec) => [rec.checkAnchor, rec.anchor]),
  );

  return {
    scanId: scan.id,
    resumeId: scan.resume.id,
    fileName: scan.resume.fileName,
    scannedOn: formatDate(scan.createdAt),
    deletesOn: scan.expiresAt ? formatDate(scan.expiresAt) : null,
    pageCount: scan.resume.pageCount,
    wordCount: scan.resume.wordCount,
    score: ats.score,
    band: ats.band,
    bandDescription: BAND_DESCRIPTIONS[ats.band],
    // The summary headline gains the match sentence when there is a job (§18.6).
    headline: scan.summary.headline,
    topActions: topActions(ats).map((action) => ({
      ...action,
      anchor: recommendationFor.get(action.anchor) ?? action.anchor,
    })),
    categories: ats.categories.map((c) => ({
      key: c.key as CategoryKey,
      label: c.label,
      weight: c.weight,
      score: c.score,
      weightedPoints: c.weightedPoints,
    })),
    weightedTotal,
    strengths: ats.strengths,
    issueCounts: scan.summary.issueCounts,
    issueTotal: ats.issues.length,
    issueGroups: issueGroups(ats),
    keywords: resume ? buildKeywordsView(ats, resume) : null,
    parsed: resume ? buildParsedView(resume) : null,
    engineVersion: ats.engineVersion,
    job: scan.job ? { title: scan.job.title, company: scan.job.company } : null,
    match: scan.match
      ? buildMatchView(scan.match, {
          aiStatus: scan.ai?.status ?? null,
          locate: quoteLocator(resume),
        })
      : null,
    canRescan: resume !== null,
    recommendations,
  };
}
