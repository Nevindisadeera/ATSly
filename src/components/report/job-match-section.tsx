import { Info } from "lucide-react";
import { cn } from "cn";

import { KeywordChip, ScoreBar, SectionHeading } from "@/components/data-display";
import { KeywordChipWithDetails } from "@/components/data-display/keyword-chip-details";
import type {
  FitRowView,
  MatchedTermView,
  MatchView,
  MissingTermView,
  ReportView,
} from "@/lib/report/types";

import { MatchRescanCard } from "./match-rescan-card";

const FIT_TONE: Record<FitRowView["status"], string> = {
  meets: "border-success/30 bg-success-soft text-success-strong",
  exceeds: "border-border bg-soft text-foreground",
  close: "border-warning/40 bg-warning-soft text-warning-strong",
  gap: "border-danger/30 bg-danger-soft text-danger-strong",
  not_specified: "border-border bg-soft text-subtle",
};

/** How each component scored; components that couldn't be assessed are shown as such. */
function MatchBreakdown({ match }: { match: MatchView }) {
  return (
    <div className="rounded-lg border border-border bg-background p-6">
      <h3 className="type-h4">Match breakdown</h3>
      <ul className="mt-5 grid gap-5">
        {match.components.map((c) =>
          c.score !== null ? (
            <li key={c.key}>
              <ScoreBar
                label={c.label}
                value={c.score}
                caption={`${c.effectiveWeight}% of match`}
              />
            </li>
          ) : (
            <li key={c.key} className="grid gap-1">
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-[0.9375rem] font-medium text-subtle">
                  {c.label}
                </span>
                <span className="shrink-0 text-sm text-subtle">Not assessed</span>
              </div>
              {c.note ? <p className="text-xs leading-5 text-subtle">{c.note}</p> : null}
            </li>
          ),
        )}
      </ul>
      {match.redistributed ? (
        <p className="mt-5 border-t border-border pt-4 text-xs leading-5 text-subtle">
          Components that couldn&apos;t be assessed don&apos;t count against you; their
          weight is shared proportionally among the others.
        </p>
      ) : null}
    </div>
  );
}

function MatchedChips({ terms }: { terms: MatchedTermView[] }) {
  return (
    <ul className="mt-3 flex flex-wrap gap-2">
      {terms.map((t) => (
        <li key={t.term} className="max-w-full">
          <KeywordChipWithDetails
            term={t.term}
            state="matched"
            detailsLabel={`${t.term}: how it matched`}
            details={
              <div className="grid gap-2">
                <p className="font-medium text-foreground">{t.how}</p>
                {t.evidence ? (
                  <blockquote className="rounded-sm bg-soft px-3 py-2 leading-6 text-body">
                    <span aria-hidden="true">“</span>
                    {t.evidence}
                    <span aria-hidden="true">”</span>
                  </blockquote>
                ) : null}
                {t.location ? <p className="text-xs text-subtle">{t.location}</p> : null}
              </div>
            }
          />
        </li>
      ))}
    </ul>
  );
}

function MissingList({ terms }: { terms: MissingTermView[] }) {
  return (
    <ul className="mt-3 grid gap-3">
      {terms.map((t) => (
        <li
          key={t.term}
          className="grid gap-1.5 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-baseline sm:gap-3"
        >
          <KeywordChip term={t.term} state="missing" className="w-fit" />
          <span className="text-sm leading-6 text-subtle">{t.suggestion}</span>
        </li>
      ))}
    </ul>
  );
}

function RequirementGroup({
  title,
  matched,
  missing,
}: {
  title: string;
  matched: MatchedTermView[];
  missing: MissingTermView[];
}) {
  if (matched.length === 0 && missing.length === 0) return null;
  return (
    <div className="grid gap-6">
      <h3 className="type-h4">{title}</h3>
      {matched.length > 0 ? (
        <div>
          <h4 className="text-sm font-medium text-foreground">
            Found in your resume ({matched.length})
          </h4>
          <p className="mt-1 text-xs text-subtle">
            Select a skill to see where it was found.
          </p>
          <MatchedChips terms={matched} />
        </div>
      ) : null}
      {missing.length > 0 ? (
        <div>
          <h4 className="text-sm font-medium text-foreground">
            Not found ({missing.length})
          </h4>
          <MissingList terms={missing} />
        </div>
      ) : null}
    </div>
  );
}

/** Job match — docs/PLANNING.md §7.3, section 7, and §19.3. */
export function JobMatchSection({ view }: { view: ReportView }) {
  const match = view.match;
  const role = view.job?.title
    ? `${view.job.title}${view.job.company ? ` at ${view.job.company}` : ""}`
    : "this job";

  return (
    <section id="job-match" aria-labelledby="job-match-title" className="scroll-mt-20">
      <SectionHeading
        id="job-match-title"
        as="h2"
        size="h3"
        title="Job match"
        description={
          match
            ? `How well this resume matches ${role}, based on the requirements found in the posting.`
            : undefined
        }
      />

      {!match ? (
        <MatchRescanCard resumeId={view.resumeId} canRescan={view.canRescan} />
      ) : (
        <div className="mt-6 grid gap-6">
          <MatchBreakdown match={match} />

          <div className="grid gap-10 rounded-lg border border-border bg-background p-6">
            <RequirementGroup
              title="Required skills"
              matched={match.matchedRequired}
              missing={match.missingRequired}
            />
            <RequirementGroup
              title="Preferred skills"
              matched={match.matchedPreferred}
              missing={match.missingPreferred}
            />
            {match.matchedRequired.length +
              match.missingRequired.length +
              match.matchedPreferred.length +
              match.missingPreferred.length ===
            0 ? (
              <p className="text-sm text-subtle">
                No specific skills or tools were found in this job description.
              </p>
            ) : null}
          </div>

          <div className="rounded-lg border border-border bg-background p-6">
            <h3 className="type-h4">Fit</h3>
            <dl className="mt-4 divide-y divide-border">
              {match.fit.map((row) => (
                <div
                  key={row.key}
                  className="grid gap-2 py-4 first:pt-0 last:pb-0 sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-6"
                >
                  <dt className="flex items-center justify-between gap-3 sm:block">
                    <span className="text-sm font-medium text-foreground">
                      {row.label}
                    </span>
                    <span
                      className={cn(
                        "inline-flex h-6 items-center rounded-full border px-2.5 text-xs font-medium sm:mt-2 sm:flex sm:w-fit",
                        FIT_TONE[row.status],
                      )}
                    >
                      {row.statusLabel}
                    </span>
                  </dt>
                  <dd className="text-sm leading-6 text-body">{row.detail}</dd>
                </div>
              ))}
            </dl>
          </div>

          {match.strongMatches.length > 0 || match.weakMatches.length > 0 ? (
            <div className="grid gap-6 rounded-lg border border-border bg-background p-6 md:grid-cols-2">
              {match.strongMatches.length > 0 ? (
                <div>
                  <h3 className="type-h4">Strong matches</h3>
                  <ul className="mt-3 grid gap-3 text-sm leading-6">
                    {match.strongMatches.map((m) => (
                      <li key={m.requirement}>
                        <span className="font-medium text-foreground">
                          {m.requirement}
                        </span>
                        <span className="block text-subtle">“{m.evidence}”</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {match.weakMatches.length > 0 ? (
                <div>
                  <h3 className="type-h4">Weak matches</h3>
                  <ul className="mt-3 grid gap-3 text-sm leading-6">
                    {match.weakMatches.map((m) => (
                      <li key={m.requirement}>
                        <span className="font-medium text-foreground">
                          {m.requirement}
                        </span>
                        <span className="block text-subtle">{m.reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}

          {match.honestyFlags.length > 0 ? (
            <div
              role="note"
              className="rounded-lg border border-border bg-background p-6"
            >
              <h3 className="flex items-center gap-2 type-h4">
                <Info aria-hidden="true" className="size-4 text-muted-foreground" />
                Worth knowing
              </h3>
              <ul className="mt-3 grid list-disc gap-2 pl-5 text-sm leading-6 text-body">
                {match.honestyFlags.map((flag) => (
                  <li key={flag}>{flag}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
