import Link from "next/link";
import { cn } from "cn";

import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

import { Container } from "./container";
import { HeaderScrollState } from "./header-scroll-state";

const NAV = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/methodology", label: "Methodology" },
];

/** Marketing header. Transparent at the top of the page; a hairline and solid surface once scrolled. */
export function SiteHeader() {
  return (
    <header
      id="site-header"
      className={cn(
        "sticky top-0 z-40 border-b border-transparent transition-colors duration-200",
        "data-scrolled:border-border data-scrolled:bg-background/90 data-scrolled:backdrop-blur-md",
      )}
    >
      <Container className="flex h-16 items-center justify-between gap-6">
        <Logo />
        <nav aria-label="Main" className="flex items-center gap-1 sm:gap-2">
          <ul className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="inline-flex h-9 items-center rounded-md px-3 text-sm text-subtle transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          {/* Navy outline here so the hero's blue button stays the only filled primary on screen. */}
          <Button asChild variant="secondary" size="sm">
            <Link href="/scan">Scan my resume</Link>
          </Button>
        </nav>
      </Container>
      <HeaderScrollState targetId="site-header" />
    </header>
  );
}
