"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, LayoutDashboard, LogOut, Settings } from "lucide-react";
import { signOut } from "next-auth/react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? [parts[0]!, parts.at(-1)!] : parts.slice(0, 1);
  return letters.map((part) => part[0]!.toUpperCase()).join("") || "?";
}

/** The signed-in account in the app header — docs/PLANNING.md §7 (11b). */
export function AccountMenu({ name, email }: { name: string; email: string }) {
  const [signingOut, setSigningOut] = useState(false);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Account menu for ${name}`}
        className="flex h-9 items-center gap-2 rounded-md pr-1.5 pl-1 text-sm text-foreground outline-none hover:bg-track focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background data-[state=open]:bg-track"
      >
        <span
          aria-hidden="true"
          className="flex size-7 items-center justify-center rounded-full bg-navy text-xs font-medium text-white"
        >
          {initials(name)}
        </span>
        <span className="hidden max-w-36 truncate sm:inline">{name}</span>
        <ChevronDown aria-hidden="true" className="size-4 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="grid gap-0.5 font-normal">
          <span className="truncate text-sm font-medium text-foreground">{name}</span>
          <span className="truncate text-xs text-subtle">{email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/dashboard">
            <LayoutDashboard aria-hidden="true" />
            Dashboard
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings aria-hidden="true" />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={signingOut}
          onSelect={() => {
            setSigningOut(true);
            void signOut({ redirectTo: "/" });
          }}
        >
          <LogOut aria-hidden="true" />
          {signingOut ? "Logging out…" : "Log out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
