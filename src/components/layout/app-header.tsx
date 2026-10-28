import Link from "next/link";
import { cn } from "cn";

import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth/auth";

import { AccountMenu } from "./account-menu";
import { Container } from "./container";

const navLink =
  "inline-flex h-9 items-center rounded-md px-3 text-sm text-subtle transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/** Header for the product area (/scan, /results, /dashboard, /settings). */
export async function AppHeader() {
  const session = await auth();
  const user = session?.user;

  return (
    <header className="border-b border-border bg-background">
      <Container width="app" className="flex h-16 items-center justify-between gap-4">
        <Logo />
        <nav aria-label="Main" className="flex items-center gap-1 sm:gap-2">
          <Link href="/methodology" className={cn(navLink, "hidden sm:inline-flex")}>
            How scoring works
          </Link>
          {user ? (
            <>
              <Link href="/dashboard" className={cn(navLink, "hidden sm:inline-flex")}>
                Dashboard
              </Link>
              <AccountMenu
                name={user.name ?? user.email ?? "Account"}
                email={user.email ?? ""}
              />
            </>
          ) : (
            <Button asChild variant="secondary" size="sm">
              <Link href="/login">Log in</Link>
            </Button>
          )}
        </nav>
      </Container>
    </header>
  );
}
