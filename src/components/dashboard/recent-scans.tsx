"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CircleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { deleteScan, fetchScanPage } from "@/lib/client/dashboard";
import { formatDate } from "@/lib/utils/format";
import type { ScanListItem, ScanListPage } from "@/types/api";

import { jobLabel } from "./latest-scan-card";

function Score({ value }: { value: number | null }) {
  return value === null ? (
    <span className="text-muted-foreground">—</span>
  ) : (
    <span className="font-medium text-foreground tabular-nums">{value}</span>
  );
}

/** A score, or what happened to a scan that has none. */
function Outcome({ scan }: { scan: ScanListItem }) {
  if (scan.status === "failed") return <span className="text-danger-strong">Failed</span>;
  if (scan.status !== "complete") return <span className="text-subtle">In progress</span>;
  return <Score value={scan.atsScore} />;
}

const linkClass =
  "rounded-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

/**
 * Recent scans — docs/PLANNING.md §7.4: a table from md up, cards below, "Load more" by
 * cursor, and delete with a confirmation.
 */
export function RecentScans({ initial }: { initial: ScanListPage }) {
  const router = useRouter();
  const [items, setItems] = useState(initial.items);
  const [cursor, setCursor] = useState(initial.nextCursor);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [target, setTarget] = useState<ScanListItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function loadMore() {
    if (!cursor || loading) return;
    setLoading(true);
    setLoadError(false);
    const page = await fetchScanPage(cursor);
    setLoading(false);
    if (!page.ok) return setLoadError(true);
    setItems((current) => [...current, ...page.data.items]);
    setCursor(page.data.nextCursor);
  }

  async function confirmDelete() {
    if (!target || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    const result = await deleteScan(target.id);
    setDeleting(false);
    // Already gone counts as done.
    if (!result.ok && result.code !== "NOT_FOUND") {
      return setDeleteError("We couldn't delete this report. Please try again.");
    }
    setItems((current) => current.filter((scan) => scan.id !== target.id));
    setTarget(null);
    // The latest report and the stats above depend on what's left.
    router.refresh();
  }

  const view = (scan: ScanListItem) => (
    <Link href={`/results/${scan.id}`} className={linkClass}>
      View<span className="sr-only"> report for {scan.resume.fileName}</span>
    </Link>
  );
  const remove = (scan: ScanListItem) => (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="text-subtle hover:text-danger-strong"
      onClick={() => {
        setDeleteError(null);
        setTarget(scan);
      }}
    >
      Delete<span className="sr-only"> report for {scan.resume.fileName}</span>
    </Button>
  );

  return (
    <section aria-labelledby="recent-title">
      <h2 id="recent-title" className="type-h4">
        Recent scans
      </h2>

      {items.length === 0 ? (
        <p className="mt-4 text-sm text-subtle">
          No scans left. Scan a resume to start again.
        </p>
      ) : (
        <>
          {/* Table from md up. */}
          <div className="mt-4 hidden overflow-hidden rounded-lg border border-border bg-background md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-xs text-subtle">
                <tr>
                  <th scope="col" className="px-5 py-3 font-normal">
                    Date
                  </th>
                  <th scope="col" className="px-5 py-3 font-normal">
                    Resume
                  </th>
                  <th scope="col" className="px-5 py-3 font-normal">
                    Job
                  </th>
                  <th scope="col" className="px-5 py-3 text-right font-normal">
                    ATS
                  </th>
                  <th scope="col" className="px-5 py-3 text-right font-normal">
                    Match
                  </th>
                  <th scope="col" className="px-5 py-3 font-normal">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((scan) => (
                  <tr key={scan.id}>
                    <td className="px-5 py-3 whitespace-nowrap text-body">
                      {formatDate(scan.createdAt)}
                    </td>
                    <td
                      className="max-w-56 truncate px-5 py-3 text-foreground"
                      title={scan.resume.fileName}
                    >
                      {scan.resume.fileName}
                    </td>
                    <td className="max-w-56 truncate px-5 py-3 text-body">
                      {jobLabel(scan.job) ?? (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Outcome scan={scan} />
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Score value={scan.matchScore} />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-2">
                        {view(scan)}
                        {remove(scan)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cards below md. */}
          <ul className="mt-4 grid gap-3 md:hidden">
            {items.map((scan) => (
              <li
                key={scan.id}
                className="rounded-lg border border-border bg-background p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {scan.resume.fileName}
                    </p>
                    <p className="mt-0.5 text-xs text-subtle">
                      {formatDate(scan.createdAt)}
                      {scan.job ? ` · ${jobLabel(scan.job)}` : ""}
                    </p>
                  </div>
                  <dl className="flex shrink-0 gap-4 text-right text-sm">
                    <div>
                      <dt className="text-xs text-subtle">ATS</dt>
                      <dd>
                        <Outcome scan={scan} />
                      </dd>
                    </div>
                    {scan.matchScore !== null ? (
                      <div>
                        <dt className="text-xs text-subtle">Match</dt>
                        <dd>
                          <Score value={scan.matchScore} />
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
                  {view(scan)}
                  {remove(scan)}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {cursor ? (
        <div className="mt-4 grid justify-items-center gap-2">
          <Button type="button" variant="outline" loading={loading} onClick={loadMore}>
            Load more
          </Button>
          {loadError ? (
            <p role="alert" className="text-sm text-danger-strong">
              We couldn&apos;t load more scans. Try again.
            </p>
          ) : null}
        </div>
      ) : null}

      <AlertDialog
        open={target !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) setTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this report?</AlertDialogTitle>
            <AlertDialogDescription>
              The report for {target?.resume.fileName} will be permanently removed. The
              resume stays, so you can scan it again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError ? (
            <p role="alert" className="flex gap-2 text-sm text-danger-strong">
              <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              {deleteError}
            </p>
          ) : null}
          <AlertDialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={deleting}
              onClick={() => setTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger-outline"
              loading={deleting}
              onClick={confirmDelete}
            >
              Delete report
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
