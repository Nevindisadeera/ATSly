import type { Metadata } from "next";
import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false },
};

/** Any URL that doesn't exist — docs/PLANNING.md §7.9. */
export default function NotFound() {
  return (
    <main
      id="main"
      className="flex flex-1 flex-col items-center justify-center bg-soft px-4 py-16 text-center"
    >
      <Logo />
      <p className="mt-10 type-caption text-subtle">404</p>
      <h1 className="mt-2 type-h2 text-balance">This page doesn&apos;t exist.</h1>
      <p className="mt-3 max-w-md text-sm leading-6 text-subtle">
        The link may be mistyped, or the page may have moved.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button asChild>
          <Link href="/scan">Scan a resume</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Go to the home page</Link>
        </Button>
      </div>
    </main>
  );
}
