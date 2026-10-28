import Link from "next/link";
import { FileQuestion } from "lucide-react";

import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";

/** Unknown report, someone else's, or one that expired — docs/PLANNING.md §5, state 22. */
export default function ResultsNotFound() {
  return (
    <Container width="reading" className="py-16 md:py-24">
      <div className="flex flex-col items-center rounded-lg border border-border bg-background px-6 py-12 text-center">
        <FileQuestion aria-hidden="true" className="size-5 text-muted-foreground" />
        <h1 className="mt-4 type-h3 text-balance">
          This report doesn&apos;t exist or you don&apos;t have access to it.
        </h1>
        <p className="mt-3 max-w-md text-sm leading-6 text-subtle">
          Guest reports open only in the browser that created them and are deleted after a
          few days. Reports saved to an account open when you&apos;re logged in.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button asChild>
            <Link href="/scan">Scan a resume</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/login">Log in</Link>
          </Button>
        </div>
      </div>
    </Container>
  );
}
