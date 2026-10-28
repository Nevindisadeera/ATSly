import { Container } from "@/components/layout/container";
import type { ReportView as ReportViewModel } from "@/lib/report/types";

import { IssuesSection } from "./issues-section";
import { KeywordsSection } from "./keywords-section";
import { OverviewSection } from "./overview-section";
import { ParsedResumeSection } from "./parsed-resume-section";
import { ReportFooter } from "./report-footer";
import { GuestBanner, ReportHeader } from "./report-header";
import { ReportNav, type ReportNavItem } from "./report-nav";
import { JobMatchSection } from "./job-match-section";
import { RecommendationsSection } from "./recommendations-section";
import { ScoreBreakdown } from "./score-breakdown";

/** The complete results page — docs/PLANNING.md §7.3. */
export function ReportView({ view }: { view: ReportViewModel }) {
  const nav: ReportNavItem[] = [
    { id: "overview", label: "Overview", badge: String(view.score) },
    { id: "breakdown", label: "Breakdown" },
    { id: "issues", label: "Issues", badge: String(view.issueTotal) },
    { id: "keywords", label: "Keywords" },
    {
      id: "job-match",
      label: "Job match",
      badge: view.match ? String(view.match.score) : undefined,
    },
    {
      id: "recommendations",
      label: "Recommendations",
      badge: view.recommendations.items.length
        ? String(view.recommendations.items.length)
        : undefined,
    },
    { id: "parsed-resume", label: "Parsed resume" },
  ];

  return (
    <Container width="app" className="py-8 md:py-12">
      {view.deletesOn ? (
        <GuestBanner deletesOn={view.deletesOn} next={`/results/${view.scanId}`} />
      ) : null}
      <div className={view.deletesOn ? "mt-6" : undefined}>
        <ReportHeader view={view} />
      </div>

      <ReportNav items={nav} variant="strip" className="mt-8" />

      <div className="mt-8 lg:mt-10 lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-12">
        <ReportNav items={nav} variant="rail" />
        <div className="grid max-w-[840px] min-w-0 gap-16">
          <OverviewSection view={view} />
          <ScoreBreakdown view={view} />
          <IssuesSection groups={view.issueGroups} issueTotal={view.issueTotal} />
          <KeywordsSection keywords={view.keywords} />
          <JobMatchSection view={view} />
          <RecommendationsSection recommendations={view.recommendations} />
          <ParsedResumeSection parsed={view.parsed} />
          <ReportFooter engineVersion={view.engineVersion} />
        </div>
      </div>
    </Container>
  );
}
