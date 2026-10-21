import { Check } from "lucide-react";

import { BandChip, ScoreBar, ScoreRing, SeverityDot } from "@/components/data-display";
import type { ReportView } from "@/lib/report/types";
import { pluralize } from "@/lib/utils/format";

/** Score hero and overview — docs/PLANNING.md §7.3, sections 2 and 3. */
export function OverviewSection({ view }: { view: ReportView }) {
  return (
    <section id="overview" aria-labelledby="overview-title" className="scroll-mt-20">
      <h2 id="overview-title" className="sr-only">
        Overview
      </h2>

      <div className="rounded-lg border border-border bg-background p-6 sm:p-8">
        <div className="grid gap-8 md:grid-cols-[auto_minmax(0,1fr)] md:items-start">
          <div className="flex flex-col items-center gap-4">
            {/* 168px on larger screens, 120px on phones (§12). */}
            <div className="hidden sm:block">
              <ScoreRing
                value={view.score}
                band={view.band}
                label="ATS score"
                size={168}
              />
            </div>
            <div className="sm:hidden">
              <ScoreRing
                value={view.score}
                band={view.band}
                label="ATS score"
                size={120}
              />
            </div>
            <BandChip band={view.band}>{view.bandDescription}</BandChip>
          </div>

          <div className="min-w-0">
            <p className="type-lead text-pretty text-foreground">{view.headline}</p>
            {view.topActions.length > 0 ? (
              <>
                <h3 className="mt-6 text-sm font-medium text-foreground">
                  {view.topActions.length === 1
                    ? "Top action"
                    : `Top ${view.topActions.length} actions`}
                </h3>
                <ol className="mt-3 grid gap-4">
                  {view.topActions.map((action, i) => (
                    <li key={action.anchor} className="flex gap-3">
                      <span
                        aria-hidden="true"
                        className="flex size-6 shrink-0 items-center justify-center rounded-full border border-border bg-soft text-xs font-medium text-foreground tabular-nums"
                      >
                        {i + 1}
                      </span>
                      <a
                        href={`#${action.anchor}`}
                        className="group min-w-0 rounded-sm text-sm leading-6 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        <span className="font-medium text-foreground underline-offset-4 group-hover:underline">
                          {action.title}
                        </span>
                        <span className="block text-subtle">{action.fix}</span>
                      </a>
                    </li>
                  ))}
                </ol>
              </>
            ) : (
              <p className="mt-6 text-sm text-subtle">
                No issues found. Your resume passed every check that applied.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-border bg-background p-6">
        <h3 className="type-h4">Category scores</h3>
        <ul className="mt-5 grid gap-5">
          {view.categories.map((c) => (
            <li key={c.key}>
              <ScoreBar label={c.label} value={c.score} weight={c.weight} />
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border border-border bg-background p-6">
          <h3 className="type-h4">What&apos;s working</h3>
          {view.strengths.length > 0 ? (
            <ul className="mt-4 grid gap-3">
              {view.strengths.map((strength) => (
                <li key={strength} className="flex gap-2.5 text-sm leading-6 text-body">
                  <Check
                    aria-hidden="true"
                    className="mt-1 size-4 shrink-0 text-success-strong"
                    strokeWidth={2.25}
                  />
                  {strength}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm leading-6 text-subtle">
              Nothing stands out yet. The top actions above are the quickest way to change
              that.
            </p>
          )}
        </div>

        <div className="rounded-lg border border-border bg-background p-6">
          <h3 className="type-h4">Issues by severity</h3>
          <ul className="mt-4 grid gap-3">
            {(["critical", "major", "minor"] as const).map((severity) => (
              <li key={severity} className="flex items-center justify-between gap-4">
                <SeverityDot severity={severity} />
                <span className="text-sm font-medium text-foreground tabular-nums">
                  {view.issueCounts[severity]}
                </span>
              </li>
            ))}
          </ul>
          {view.issueTotal > 0 ? (
            <a
              href="#issues"
              className="mt-5 inline-flex rounded-sm text-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              See all {pluralize(view.issueTotal, "issue")}
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}
