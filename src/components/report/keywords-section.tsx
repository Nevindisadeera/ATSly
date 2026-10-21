import { Check, CircleMinus } from "lucide-react";

import { EmptyState, KeywordChip, SectionHeading } from "@/components/data-display";
import type { CheckView, KeywordsView } from "@/lib/report/types";

function HygieneStatus({ check }: { check: CheckView }) {
  if (check.status === "pass") {
    return (
      <span className="inline-flex items-center gap-1.5 text-success-strong">
        <Check aria-hidden="true" className="size-4" strokeWidth={2.25} />
        Passed
      </span>
    );
  }
  if (check.status === "na") {
    return (
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        <CircleMinus aria-hidden="true" className="size-4" />
        Not applicable
      </span>
    );
  }
  return (
    <a
      href={`#${check.anchor}`}
      className="rounded-sm font-medium text-foreground tabular-nums underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <span aria-hidden="true">−{check.points}</span>
      <span className="sr-only">{check.points} points, see the issue</span>
    </a>
  );
}

/** Recognized skills and keyword hygiene — docs/PLANNING.md §7.3, section 6. */
export function KeywordsSection({ keywords }: { keywords: KeywordsView | null }) {
  return (
    <section id="keywords" aria-labelledby="keywords-title" className="scroll-mt-20">
      <SectionHeading
        id="keywords-title"
        as="h2"
        size="h3"
        title="Keywords & skills"
        description="Skills recognized in your skills section. Backed skills also appear in your experience or projects, which carries more weight with ATS searches and recruiters."
      />

      {keywords === null ? (
        <p className="mt-6 rounded-lg border border-border bg-background p-6 text-sm text-subtle">
          The resume behind this report is no longer stored, so skill details aren&apos;t
          available.
        </p>
      ) : (
        <>
          {keywords.recognizedCount === 0 ? (
            <EmptyState
              className="mt-6"
              title="No recognized skills"
              description="We didn't recognize any skills in a skills section. List your tools, technologies and methods by their standard names."
            />
          ) : (
            <div className="mt-6 rounded-lg border border-border bg-background p-6">
              <p className="text-sm text-body">
                <span className="font-medium text-foreground tabular-nums">
                  {keywords.backedCount} of {keywords.recognizedCount}
                </span>{" "}
                recognized skills are backed by your experience or projects.
              </p>
              <ul
                aria-label="Legend"
                className="mt-4 flex flex-wrap gap-x-6 gap-y-3 text-sm text-subtle"
              >
                <li className="flex items-center gap-2">
                  <KeywordChip term="Backed" state="backed" />
                  also in your experience
                </li>
                <li className="flex items-center gap-2">
                  <KeywordChip term="Listed only" state="listed" />
                  only in your skills list
                </li>
              </ul>

              <div className="mt-6 grid gap-6 border-t border-border pt-6">
                {keywords.groups.map((group) => (
                  <div key={group.category}>
                    <h3 className="text-sm font-medium text-foreground">
                      {group.category}
                    </h3>
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {group.skills.map((skill) => (
                        <li key={skill.term} className="max-w-full">
                          <KeywordChip
                            term={skill.term}
                            state={skill.backed ? "backed" : "listed"}
                          />
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              {keywords.unrecognized.length > 0 ? (
                <p className="mt-6 text-sm leading-6 text-subtle">
                  Also listed, but not recognized: {keywords.unrecognized.join(", ")}.
                </p>
              ) : null}
            </div>
          )}

          {keywords.hygiene.length > 0 ? (
            <div className="mt-6 rounded-lg border border-border bg-background">
              <h3 className="px-6 pt-5 type-h4">Keyword hygiene</h3>
              <ul className="mt-2 divide-y divide-border">
                {keywords.hygiene.map((check) => (
                  <li
                    key={check.id}
                    className="flex items-center justify-between gap-4 px-6 py-3 text-sm"
                  >
                    <span className="text-body">{check.title}</span>
                    <HygieneStatus check={check} />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
