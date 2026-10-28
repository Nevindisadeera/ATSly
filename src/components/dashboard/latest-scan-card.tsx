import Link from "next/link";

import { ScoreRing } from "@/components/data-display";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils/format";
import type { ScanListItem } from "@/types/api";

export function jobLabel(job: ScanListItem["job"]): string | null {
  if (!job) return null;
  if (job.title && job.company) return `${job.title} at ${job.company}`;
  return job.title ?? job.company ?? "A job description";
}

/** The newest complete report — docs/PLANNING.md §7.4. */
export function LatestScanCard({ scan }: { scan: ScanListItem }) {
  const job = jobLabel(scan.job);
  return (
    <section
      aria-labelledby="latest-title"
      className="rounded-lg border border-border bg-background p-6 sm:p-8"
    >
      <h2 id="latest-title" className="type-caption text-subtle">
        Latest analysis
      </h2>
      <div className="mt-5 flex flex-col gap-6 md:flex-row md:items-center md:gap-8">
        <div className="flex gap-6">
          {scan.atsScore !== null && scan.atsBand ? (
            <ScoreRing
              value={scan.atsScore}
              band={scan.atsBand}
              label="ATS score"
              caption="ATS"
              size={96}
            />
          ) : null}
          {scan.matchScore !== null && scan.matchBand ? (
            <ScoreRing
              value={scan.matchScore}
              band={scan.matchBand}
              label="Job match"
              caption="Match"
              size={96}
            />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[0.9375rem] font-medium wrap-break-word text-foreground">
            {scan.resume.fileName}
          </p>
          <p className="mt-1 text-sm text-subtle">
            {formatDate(scan.createdAt)}
            {job ? ` · ${job}` : ""}
          </p>
          {scan.topAction ? (
            <p className="mt-3 text-sm leading-6 text-body">
              <span className="font-medium text-foreground">Top action: </span>
              {scan.topAction}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col gap-3 sm:flex-row md:flex-col lg:flex-row">
          <Button
            asChild
            variant="secondary"
            className="w-full sm:w-fit md:w-full lg:w-fit"
          >
            <Link href={`/results/${scan.id}`}>View report</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="w-full sm:w-fit md:w-full lg:w-fit"
          >
            <Link href={`/scan?resume=${scan.resume.id}`}>Scan against another job</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
