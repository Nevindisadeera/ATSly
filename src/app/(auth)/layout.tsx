import type { Metadata } from "next";
import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { SkipLink } from "@/components/layout/skip-link";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

const footerLink =
  "rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

/** Login and register — docs/PLANNING.md §7.5: a centered card on a soft background. */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <SkipLink />
      <main
        id="main"
        tabIndex={-1}
        className="flex flex-1 flex-col items-center bg-soft px-4 py-10 outline-none sm:py-16"
      >
        <Logo className="mb-8" />
        <div className="w-full max-w-[420px]">{children}</div>
        <p className="mt-8 flex gap-4 text-xs text-subtle">
          <Link href="/terms" className={footerLink}>
            Terms
          </Link>
          <Link href="/privacy" className={footerLink}>
            Privacy
          </Link>
          <Link href="/methodology" className={footerLink}>
            How scoring works
          </Link>
        </p>
      </main>
    </>
  );
}
