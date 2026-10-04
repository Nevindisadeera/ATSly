import Link from "next/link";

import { Logo } from "@/components/brand/logo";

import { Container } from "./container";

/**
 * Header for the product area (/scan, /results, /dashboard). Dashboard, account menu and
 * sign-in links are added with authentication (Phase 11b).
 */
export function AppHeader() {
  return (
    <header className="border-b border-border bg-background">
      <Container width="app" className="flex h-16 items-center justify-between gap-6">
        <Logo />
        <nav aria-label="Main">
          <Link
            href="/methodology"
            className="inline-flex h-9 items-center rounded-md px-3 text-sm text-subtle transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            How scoring works
          </Link>
        </nav>
      </Container>
    </header>
  );
}
