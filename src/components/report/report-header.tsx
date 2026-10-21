import Link from "next/link";
import { Clock } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ReportView } from "@/lib/report/types";
import { pluralize } from "@/lib/utils/format";

/** Guest reports expire — docs/PLANNING.md §7.3 (state 25). The account CTA arrives in 11b. */
export function GuestBanner({ deletesOn }: { deletesOn: string }) {
  return (
    <div
      role="note"
      className="flex gap-3 rounded-lg border border-border bg-background px-4 py-3 text-sm leading-6 text-body"
    >
      <Clock aria-hidden="true" className="mt-1 size-4 shrink-0 text-muted-foreground" />
      <p>
        Guest reports are deleted automatically. This one will be deleted on{" "}
        <span className="font-medium text-foreground">{deletesOn}</span>.
      </p>
    </div>
  );
}

export function ReportHeader({ view }: { view: ReportView }) {
  return (
    <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className="type-caption text-subtle">ATS report</p>
        <h1 className="mt-2 type-h2 wrap-break-word">{view.fileName}</h1>
        <p className="mt-2 text-sm text-subtle">
          Scanned {view.scannedOn} · {pluralize(view.pageCount, "page")} ·{" "}
          {pluralize(view.wordCount, "word")}
        </p>
      </div>
      <Button asChild variant="secondary" className="w-full shrink-0 sm:w-fit">
        <Link href="/scan">New scan</Link>
      </Button>
    </header>
  );
}
