"use client";

import { CircleAlert } from "lucide-react";

import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";

/** Unexpected failures loading a report, e.g. the database is unreachable — §24. */
export default function ResultsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <Container width="reading" className="py-16 md:py-24">
      <div className="flex flex-col items-center rounded-lg border border-border bg-background px-6 py-12 text-center">
        <CircleAlert aria-hidden="true" className="size-5 text-danger" />
        <h1 className="mt-4 type-h3">We couldn&apos;t load this report.</h1>
        <p className="mt-3 max-w-md text-sm leading-6 text-subtle">
          Something went wrong on our side. Your report is saved, so please try again in a
          moment.
          {error.digest ? ` Reference: ${error.digest}` : null}
        </p>
        <Button className="mt-8" onClick={reset}>
          Try again
        </Button>
      </div>
    </Container>
  );
}
