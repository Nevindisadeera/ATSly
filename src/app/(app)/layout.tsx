import type { Metadata } from "next";

import { AppHeader } from "@/components/layout/app-header";
import { SkipLink } from "@/components/layout/skip-link";

// Product pages are personal; keep them out of search results.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <SkipLink />
      <AppHeader />
      <main id="main" tabIndex={-1} className="flex-1 bg-soft outline-none">
        {children}
      </main>
    </>
  );
}
