"use client";

import { useEffect, useState } from "react";
import { CircleAlert, Info, Lightbulb } from "lucide-react";
import { cn } from "cn";

import { EmptyState, SectionHeading } from "@/components/data-display";
import { StartScanButton } from "@/components/scan/start-scan-button";
import type {
  RecommendationPriority,
  RecommendationsNotice,
  RecommendationsView,
  RetryView,
} from "@/lib/report/types";
import { pluralize } from "@/lib/utils/format";

import { RecommendationCard } from "./recommendation-card";

type Filter = "all" | RecommendationPriority;

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "high", label: "High" },
  { key: "medium", label: "Medium" },
  { key: "low", label: "Low" },
];

export const RECOMMENDATIONS_DISCLAIMER =
  "Suggestions are generated from your own content. Verify accuracy before using them.";

/** Runs the analysis again: a new scan of the same resume, against the same job. */
function Retry({ retry }: { retry: RetryView }) {
  return (
    <StartScanButton
      resumeId={retry.resumeId}
      jobDescriptionId={retry.jobDescriptionId ?? undefined}
      label="Try again"
      variant="secondary"
    />
  );
}

function Notice({ notice }: { notice: RecommendationsNotice }) {
  const Icon = notice.tone === "warning" ? CircleAlert : Info;
  return (
    <div
      className={cn(
        "mt-6 flex gap-3 rounded-lg border p-5 sm:p-6",
        notice.tone === "warning"
          ? "border-warning/40 bg-warning-soft"
          : "border-border bg-soft",
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn(
          "mt-0.5 size-5 shrink-0",
          notice.tone === "warning" ? "text-warning-strong" : "text-muted-foreground",
        )}
        strokeWidth={1.75}
      />
      <div className="min-w-0">
        <h3 className="text-[0.9375rem] font-medium text-foreground">{notice.title}</h3>
        <p className="mt-1 text-sm leading-6 text-body">{notice.body}</p>
        {notice.retry ? (
          <div className="mt-4">
            <Retry retry={notice.retry} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Recommendations — docs/PLANNING.md §7.3, section 8: filter chips by priority and one card
 * per recommendation. Links to "#recommendation-<id>" (the top actions) clear a filter that
 * hides their card and scroll it into view.
 */
export function RecommendationsSection({
  recommendations,
}: {
  recommendations: RecommendationsView;
}) {
  const { items, counts, notice, empty } = recommendations;
  const [filter, setFilter] = useState<Filter>("all");
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    const reveal = () => {
      const anchor = decodeURIComponent(window.location.hash.slice(1));
      const rec = items.find((r) => r.anchor === anchor);
      if (!rec) return;
      setFilter((current) =>
        current === "all" || current === rec.priority ? current : "all",
      );
      // Scroll once a card the filter hid has rendered.
      requestAnimationFrame(() =>
        requestAnimationFrame(() =>
          document.getElementById(anchor)?.scrollIntoView({ block: "start" }),
        ),
      );
    };
    // Clicking a link to the current hash doesn't fire hashchange, so watch clicks too.
    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest?.(
        'a[href^="#recommendation-"]',
      );
      if (link) requestAnimationFrame(reveal);
    };
    const initial = requestAnimationFrame(reveal);
    window.addEventListener("hashchange", reveal);
    document.addEventListener("click", onClick);
    return () => {
      cancelAnimationFrame(initial);
      window.removeEventListener("hashchange", reveal);
      document.removeEventListener("click", onClick);
    };
  }, [items]);

  function choose(next: Filter) {
    setFilter(next);
    const shown = next === "all" ? items.length : counts[next];
    setAnnouncement(
      next === "all"
        ? `Showing all ${pluralize(shown, "recommendation")}.`
        : `Showing ${pluralize(shown, `${next}-priority recommendation`)}.`,
    );
  }

  const visible = filter === "all" ? items : items.filter((r) => r.priority === filter);

  return (
    <section
      id="recommendations"
      aria-labelledby="recommendations-title"
      className="scroll-mt-20"
    >
      <SectionHeading
        id="recommendations-title"
        as="h2"
        size="h3"
        title="Recommendations"
        description={
          items.length > 0
            ? `${pluralize(items.length, "specific change")} to make, most important first.`
            : undefined
        }
      />

      {notice ? <Notice notice={notice} /> : null}

      {empty ? (
        <EmptyState
          className="mt-6"
          icon={<Lightbulb />}
          title={empty.title}
          description={empty.description}
          action={empty.retry ? <Retry retry={empty.retry} /> : undefined}
        />
      ) : null}

      {items.length > 0 ? (
        <>
          <div
            role="group"
            aria-label="Filter by priority"
            className="mt-6 flex flex-wrap gap-2"
          >
            {FILTERS.map(({ key, label }) => {
              const count = key === "all" ? items.length : counts[key];
              const active = filter === key;
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={active}
                  disabled={count === 0}
                  onClick={() => choose(key)}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
                    active
                      ? "border-navy bg-navy text-white"
                      : "border-border-strong bg-background text-foreground hover:bg-soft",
                  )}
                >
                  {label}
                  <span
                    className={cn(
                      "text-xs tabular-nums",
                      active ? "text-white/80" : "text-subtle",
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
          <p role="status" className="sr-only">
            {announcement}
          </p>

          <ol className="mt-6 grid gap-4">
            {visible.map((rec) => (
              <li key={rec.id}>
                <RecommendationCard rec={rec} />
              </li>
            ))}
          </ol>

          <p className="mt-6 text-sm leading-6 text-subtle">
            {RECOMMENDATIONS_DISCLAIMER}
          </p>
        </>
      ) : null}
    </section>
  );
}
