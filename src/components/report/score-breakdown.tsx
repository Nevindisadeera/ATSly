import Link from "next/link";

import { SectionHeading } from "@/components/data-display";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ReportView } from "@/lib/report/types";

const points = (value: number) => value.toFixed(2);

/** The methodology in brief, with a link to the full page — docs/PLANNING.md §7.3. */
function HowWeScore() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="link" className="text-sm">
          How we score
        </Button>
      </DialogTrigger>
      <DialogContent className="gap-5 p-6 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="type-h4">How we score</DialogTitle>
          <DialogDescription className="text-sm leading-6 text-subtle">
            Your score estimates how reliably ATS software can read your resume. It
            doesn&apos;t depend on any job.
          </DialogDescription>
        </DialogHeader>
        <ul className="grid list-disc gap-2 pl-5 text-sm leading-6 text-body">
          <li>Six categories each start at 100.</li>
          <li>
            Every check that finds a problem deducts points. Problems found by layout
            heuristics are marked “Likely” and deduct less.
          </li>
          <li>
            Checks that can&apos;t apply to your resume are skipped and cost nothing.
          </li>
          <li>
            Your score is the weighted sum of the six category scores, rounded to a whole
            number.
          </li>
        </ul>
        <Link
          href="/methodology"
          className="w-fit rounded-sm text-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Read the full methodology
        </Link>
      </DialogContent>
    </Dialog>
  );
}

/** "Why did I get 74?" — docs/PLANNING.md §18.5. The numbers come straight from the engine. */
export function ScoreBreakdown({ view }: { view: ReportView }) {
  return (
    <section id="breakdown" aria-labelledby="breakdown-title" className="scroll-mt-20">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <SectionHeading
          id="breakdown-title"
          as="h2"
          size="h3"
          title="Score breakdown"
          description="Each category is scored out of 100 and weighted. The weighted points add up to your score."
        />
        <div className="shrink-0">
          <HowWeScore />
        </div>
      </div>

      <div className="mt-6 hidden overflow-hidden rounded-lg border border-border bg-background md:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-11 px-5">Category</TableHead>
              <TableHead className="h-11 px-5 text-right">Weight</TableHead>
              <TableHead className="h-11 px-5 text-right">Your score</TableHead>
              <TableHead className="h-11 px-5 text-right">Points</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {view.categories.map((c) => (
              <TableRow key={c.key} className="hover:bg-transparent">
                <TableCell className="px-5 py-3 font-medium text-foreground">
                  {c.label}
                </TableCell>
                <TableCell className="px-5 py-3 text-right text-subtle tabular-nums">
                  {c.weight}%
                </TableCell>
                <TableCell className="px-5 py-3 text-right tabular-nums">
                  {c.score}
                </TableCell>
                <TableCell className="px-5 py-3 text-right tabular-nums">
                  {points(c.weightedPoints)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter className="bg-soft">
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={3} className="px-5 py-3">
                <span className="font-medium text-foreground">Total</span>
                <span className="ml-2 font-normal text-subtle">
                  Σ score × weight ÷ 100, rounded
                </span>
              </TableCell>
              <TableCell className="px-5 py-3 text-right text-foreground tabular-nums">
                {points(view.weightedTotal)} → {view.score}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>

      {/* Below md the table becomes a list (§12). */}
      <dl className="mt-6 grid gap-3 md:hidden">
        {view.categories.map((c) => (
          <div key={c.key} className="rounded-lg border border-border bg-background p-4">
            <dt className="font-medium text-foreground">{c.label}</dt>
            <dd className="mt-1 text-sm text-subtle">
              Score {c.score} × {c.weight}% ={" "}
              <span className="font-medium text-foreground tabular-nums">
                {points(c.weightedPoints)} points
              </span>
            </dd>
          </div>
        ))}
        <div className="rounded-lg border border-border bg-soft p-4">
          <dt className="font-medium text-foreground">Total</dt>
          <dd className="mt-1 text-sm text-subtle">
            {points(view.weightedTotal)}, rounded to{" "}
            <span className="font-medium text-foreground">{view.score}</span>
          </dd>
        </div>
      </dl>
    </section>
  );
}
