import { cn } from "cn";

import type { RecommendationPriority, RecommendationView } from "@/lib/report/types";

import { CopyButton } from "./copy-button";

const PRIORITY: Record<RecommendationPriority, { label: string; dotClass: string }> = {
  high: { label: "High priority", dotClass: "bg-danger" },
  medium: { label: "Medium priority", dotClass: "bg-warning" },
  low: { label: "Low priority", dotClass: "bg-slate-400" },
};

function placeholderNote(placeholders: string[]): string {
  const list =
    placeholders.length === 1
      ? placeholders[0]
      : `${placeholders.slice(0, -1).join(", ")} and ${placeholders.at(-1)}`;
  return `Replace ${list} with your real ${placeholders.length === 1 ? "figure" : "details"}. Suggestions never invent numbers.`;
}

type RecommendationCardProps = {
  rec: RecommendationView;
  headingLevel?: 3 | 4;
  className?: string;
};

/**
 * One recommendation — docs/PLANNING.md §7.3, section 8: priority, title, why it matters,
 * the user's text and a suggested rewrite with a Copy button, and where it applies.
 */
export function RecommendationCard({
  rec,
  headingLevel = 3,
  className,
}: RecommendationCardProps) {
  const Heading = `h${headingLevel}` as const;
  const priority = PRIORITY[rec.priority];
  const titleId = `${rec.anchor}-title`;

  return (
    <article
      id={rec.anchor}
      aria-labelledby={titleId}
      className={cn(
        "scroll-mt-24 rounded-lg border border-border bg-background p-6 sm:p-8",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="inline-flex h-6 items-center gap-2 rounded-full border border-border-strong px-2.5 text-xs font-medium text-foreground">
          <span
            aria-hidden="true"
            className={cn("size-1.5 rounded-full", priority.dotClass)}
          />
          {priority.label}
        </span>
        <span className="min-w-0 text-xs break-words text-subtle">
          {[rec.categoryLabel, rec.location].filter(Boolean).join(" · ")}
        </span>
      </div>

      <Heading id={titleId} className="mt-4 type-h4 text-pretty">
        {rec.title}
      </Heading>
      <p className="mt-2 text-sm leading-6 break-words text-body">{rec.detail}</p>

      {rec.before || rec.after ? (
        <dl className="mt-5 grid gap-3">
          {rec.before ? (
            <div className="rounded-md border border-border bg-soft p-4">
              <dt className="type-caption text-subtle">
                {rec.after ? "Current" : "From your resume"}
              </dt>
              <dd className="mt-2 text-sm leading-6 break-words text-body">
                {rec.before}
              </dd>
            </div>
          ) : null}
          {rec.after ? (
            <div className="relative rounded-md border border-border-strong p-4">
              <dt className="pr-24 type-caption text-subtle">Suggested</dt>
              <dd className="mt-2 text-sm leading-6 break-words text-foreground">
                {rec.after}
                <span className="absolute top-3 right-4">
                  <CopyButton text={rec.after} what="suggested text" />
                </span>
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      {rec.placeholders.length > 0 ? (
        <p className="mt-3 text-xs leading-5 text-subtle">
          {placeholderNote(rec.placeholders)}
        </p>
      ) : null}

      <p className="mt-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border pt-4 text-xs text-subtle">
        <span>{rec.sourceLabel}</span>
        {rec.related ? (
          <a
            href={rec.related.href}
            className="rounded-sm text-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {rec.related.label}
            <span className="sr-only">: {rec.title}</span>
          </a>
        ) : null}
      </p>
    </article>
  );
}
