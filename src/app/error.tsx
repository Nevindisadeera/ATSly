"use client";

import Link from "next/link";
import { CircleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Unexpected errors anywhere below the root layout — docs/PLANNING.md §24. Routes with a
 * closer error.tsx (the results page) show their own.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main
      id="main"
      className="flex flex-1 flex-col items-center justify-center bg-soft px-4 py-16 text-center"
    >
      <CircleAlert aria-hidden="true" className="size-5 text-danger" />
      <h1 className="mt-4 type-h2 text-balance">Something went wrong.</h1>
      <p className="mt-3 max-w-md text-sm leading-6 text-subtle">
        It&apos;s a problem on our side, and your saved reports are safe. Please try again
        in a moment.
        {error.digest ? ` Reference: ${error.digest}` : null}
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button onClick={reset}>Try again</Button>
        <Button asChild variant="outline">
          <Link href="/">Go to the home page</Link>
        </Button>
      </div>
    </main>
  );
}
