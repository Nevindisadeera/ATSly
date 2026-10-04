import { cn } from "cn";

import { BandChip, ScoreBar, ScoreRing, SeverityDot } from "@/components/data-display";

import { SAMPLE_REPORT } from "./sample-report";

/** A static rendering of a real report, built from the same components the product uses. */
export function ReportPreview({ className }: { className?: string }) {
  const r = SAMPLE_REPORT;
  return (
    <figure
      className={cn(
        "rounded-xl border border-border bg-soft p-3 sm:p-4",
        "[--preview-shadow:0_24px_48px_-24px_rgb(15_23_42/0.18)]",
        className,
      )}
    >
      <div className="rounded-lg border border-border bg-background shadow-(--preview-shadow)">
        <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-3.5">
          <p className="truncate text-sm font-medium text-foreground">{r.fileName}</p>
          <p className="shrink-0 text-xs text-muted-foreground">ATS report</p>
        </div>

        <div className="grid gap-6 p-5 sm:grid-cols-[auto_1fr] sm:items-center">
          <ScoreRing
            animate={false}
            value={r.ats.score}
            band={r.ats.band}
            label="Sample ATS score"
            size={120}
          />
          <div className="grid gap-3">
            <BandChip band={r.ats.band}>Minor improvements</BandChip>
            <p className="text-sm leading-6 text-body">{r.headline}</p>
          </div>
        </div>

        <div className="grid gap-4 border-t border-border px-5 py-5">
          {r.categories.map((c) => (
            <ScoreBar
              animate={false}
              key={c.label}
              label={c.label}
              value={c.score}
              weight={c.weight}
              compact
            />
          ))}
        </div>

        <ul className="grid divide-y divide-border border-t border-border">
          {r.issues.map((issue) => (
            <li
              key={issue.title}
              className="flex items-center justify-between gap-4 px-5 py-3"
            >
              <SeverityDot severity={issue.severity}>{issue.title}</SeverityDot>
              <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
                −{issue.points}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <figcaption className="px-1 pt-3 text-xs text-subtle">
        Sample report. Your results depend on your resume.
      </figcaption>
    </figure>
  );
}
