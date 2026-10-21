"use client";

import { Check, CircleMinus } from "lucide-react";

import { EvidenceBlock, SeverityDot } from "@/components/data-display";
import { SEVERITY_META } from "@/components/data-display/tone";
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { CheckView } from "@/lib/report/types";

/** A failed or warned check: severity, title, certainty and points, expanding to the details. */
export function CheckRow({ check }: { check: CheckView }) {
  const quotes = check.evidence.filter((e) => e.excerpt);
  const places = check.evidence.filter((e) => !e.excerpt && e.location);

  return (
    <AccordionItem
      value={check.anchor}
      id={check.anchor}
      className="scroll-mt-24 border-border"
    >
      <AccordionTrigger className="items-center gap-3 rounded-none px-4 py-3.5 hover:no-underline focus-visible:ring-offset-0">
        <span className="flex min-w-0 flex-1 flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <SeverityDot severity={check.severity} className="font-medium text-foreground">
            <span>
              <span className="sr-only">{SEVERITY_META[check.severity].label}: </span>
              {check.title}
            </span>
          </SeverityDot>
          <span className="flex shrink-0 items-center gap-3 pl-4 sm:pl-0">
            <span className="rounded-sm border border-border px-1.5 py-0.5 text-xs font-normal text-subtle">
              {check.certainty}
            </span>
            <span className="text-sm font-medium text-foreground tabular-nums">
              <span aria-hidden="true">−{check.points}</span>
              <span className="sr-only">, {check.points} points</span>
            </span>
          </span>
        </span>
      </AccordionTrigger>
      <AccordionContent className="h-auto px-4 pb-5">
        <div className="text-sm leading-6 text-body">{check.explanation}</div>
        {quotes.length > 0 ? (
          <div className="mt-4 grid gap-2">
            {quotes.map((e, i) => (
              <EvidenceBlock key={i} text={e.excerpt!} location={e.location} />
            ))}
          </div>
        ) : null}
        {places.length > 0 ? (
          <div className="mt-3 text-sm text-subtle">
            Found in: {places.map((e) => e.location).join("; ")}
          </div>
        ) : null}
        {check.fix ? (
          <div className="mt-4 rounded-md bg-primary-soft px-4 py-3">
            <div className="text-sm font-medium text-foreground">How to fix</div>
            <div className="mt-1 text-sm leading-6 text-body">{check.fix}</div>
          </div>
        ) : null}
      </AccordionContent>
    </AccordionItem>
  );
}

/** A check that passed or didn't apply, shown in the collapsed list at the end of a group. */
export function SettledCheck({ check }: { check: CheckView }) {
  const applicable = check.status !== "na";
  return (
    <li id={check.anchor} className="flex scroll-mt-24 gap-2.5 py-2.5 text-sm leading-6">
      {applicable ? (
        <Check
          aria-hidden="true"
          className="mt-1 size-4 shrink-0 text-success-strong"
          strokeWidth={2.25}
        />
      ) : (
        <CircleMinus
          aria-hidden="true"
          className="mt-1 size-4 shrink-0 text-muted-foreground"
        />
      )}
      <div className="min-w-0">
        <span className="font-medium text-foreground">{check.title}</span>
        <span className="sr-only">{applicable ? ", passed" : ", not applicable"}</span>
        <div className="text-subtle">
          {applicable ? check.explanation : `Not applicable: ${check.explanation}`}
        </div>
      </div>
    </li>
  );
}
