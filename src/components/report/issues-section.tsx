"use client";

import { useEffect, useState } from "react";

import { SectionHeading } from "@/components/data-display";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { IssueGroupView } from "@/lib/report/types";
import { pluralize } from "@/lib/utils/format";

import { CheckRow, SettledCheck } from "./check-row";

const settledKey = (group: IssueGroupView) => `settled-${group.key}`;

/** Only the first group with a critical or major issue starts open — §7.3. */
function initialGroups(groups: IssueGroupView[]): string[] {
  const first = groups.find((g) =>
    g.issues.some((c) => c.severity === "critical" || c.severity === "major"),
  );
  return first ? [first.key] : [];
}

/**
 * Issues grouped by category — docs/PLANNING.md §7.3, section 5. Links to "#check-<id>"
 * (the top actions) open the check's group and row and scroll it into view.
 */
export function IssuesSection({
  groups,
  issueTotal,
}: {
  groups: IssueGroupView[];
  issueTotal: number;
}) {
  const [openGroups, setOpenGroups] = useState<string[]>(() => initialGroups(groups));
  const [openRows, setOpenRows] = useState<string[]>([]);

  useEffect(() => {
    const reveal = () => {
      const anchor = decodeURIComponent(window.location.hash.slice(1));
      if (!anchor.startsWith("check-")) return;
      const group = groups.find((g) =>
        [...g.issues, ...g.passed, ...g.notApplicable].some((c) => c.anchor === anchor),
      );
      if (!group) return;
      const isIssue = group.issues.some((c) => c.anchor === anchor);
      const row = isIssue ? anchor : settledKey(group);
      setOpenGroups((open) => (open.includes(group.key) ? open : [...open, group.key]));
      setOpenRows((open) => (open.includes(row) ? open : [...open, row]));
      // Scroll once the opened content has rendered.
      requestAnimationFrame(() =>
        requestAnimationFrame(() =>
          document.getElementById(anchor)?.scrollIntoView({ block: "start" }),
        ),
      );
    };
    // Clicking a link to the current hash doesn't fire hashchange, so watch clicks too.
    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest?.('a[href^="#check-"]');
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
  }, [groups]);

  return (
    <section id="issues" aria-labelledby="issues-title" className="scroll-mt-20">
      <SectionHeading
        id="issues-title"
        as="h2"
        size="h3"
        title="Issues"
        description={
          issueTotal > 0
            ? `${pluralize(issueTotal, "issue")} found, grouped by category. “Detected” issues are certain; “Likely” ones come from layout heuristics and deduct less.`
            : "No issues found. Every check passed or didn't apply to your resume."
        }
      />

      <Accordion
        type="multiple"
        value={openGroups}
        onValueChange={setOpenGroups}
        className="mt-6 rounded-lg border border-border bg-background"
      >
        {groups.map((group) => {
          const settled = [...group.passed, ...group.notApplicable];
          return (
            <AccordionItem key={group.key} value={group.key} className="border-border">
              <AccordionTrigger className="items-center rounded-none px-4 py-4 hover:no-underline focus-visible:ring-offset-0 sm:px-6">
                <span className="flex flex-1 flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-[0.9375rem] font-medium text-foreground">
                    {group.label}
                  </span>
                  <span className="text-sm font-normal text-subtle">
                    {group.issues.length === 0
                      ? "No issues"
                      : pluralize(group.issues.length, "issue")}{" "}
                    · {group.score}/100
                  </span>
                </span>
              </AccordionTrigger>
              {/* h-auto on every report panel: the shared accordion pins a panel to the
                  height measured when it opened, so nested rows opening later would clip. */}
              <AccordionContent className="h-auto px-4 pb-5 sm:px-6">
                {group.issues.length > 0 ? (
                  <Accordion
                    type="multiple"
                    value={openRows}
                    onValueChange={setOpenRows}
                    className="rounded-md border border-border"
                  >
                    {group.issues.map((check) => (
                      <CheckRow key={check.anchor} check={check} />
                    ))}
                  </Accordion>
                ) : null}

                {settled.length > 0 ? (
                  <Accordion
                    type="multiple"
                    value={openRows}
                    onValueChange={setOpenRows}
                    className={group.issues.length > 0 ? "mt-3" : undefined}
                  >
                    <AccordionItem value={settledKey(group)} className="border-0">
                      <AccordionTrigger className="items-center rounded-sm py-2 text-sm font-medium text-subtle hover:text-foreground hover:no-underline">
                        {[
                          group.passed.length > 0
                            ? `${pluralize(group.passed.length, "check")} passed`
                            : null,
                          group.notApplicable.length > 0
                            ? `${group.notApplicable.length} not applicable`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </AccordionTrigger>
                      <AccordionContent className="h-auto pb-0">
                        <ul className="divide-y divide-border">
                          {settled.map((check) => (
                            <SettledCheck key={check.anchor} check={check} />
                          ))}
                        </ul>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                ) : null}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </section>
  );
}
