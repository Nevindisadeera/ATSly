"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "cn";

export type ReportNavItem = { id: string; label: string; badge?: string };

type ReportNavProps = {
  items: ReportNavItem[];
  /** "rail": sticky left column at ≥ lg. "strip": sticky horizontal tabs below lg (§12). */
  variant: "rail" | "strip";
  className?: string;
};

/** Tracks which section is in view: the first one crossing a band near the top. */
function useActiveSection(ids: string[]): string | undefined {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    const visible = new Map<string, boolean>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) visible.set(entry.target.id, entry.isIntersecting);
        const first = ids.find((id) => visible.get(id));
        if (first) setActive(first);
      },
      { rootMargin: "-15% 0px -70% 0px" },
    );
    for (const id of ids) {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, [ids]);
  return active;
}

/** In-page navigation for the report — docs/PLANNING.md §7.3. */
export function ReportNav({ items, variant, className }: ReportNavProps) {
  const [ids] = useState(() => items.map((item) => item.id));
  const active = useActiveSection(ids);
  const strip = useRef<HTMLUListElement>(null);

  // Keep the active tab visible in the scrollable strip, without moving the page.
  useEffect(() => {
    if (variant !== "strip" || !strip.current) return;
    const list = strip.current;
    const tab = list.querySelector<HTMLElement>(`[data-section="${active}"]`);
    if (!tab) return;
    const start = tab.offsetLeft - 16;
    const end = tab.offsetLeft + tab.offsetWidth + 16;
    if (start < list.scrollLeft || end > list.scrollLeft + list.clientWidth) {
      list.scrollTo({ left: Math.max(0, start), behavior: "smooth" });
    }
  }, [active, variant]);

  if (variant === "rail") {
    return (
      <nav aria-label="Report sections" className={cn("hidden lg:block", className)}>
        <ul className="sticky top-8 grid gap-1">
          {items.map((item) => (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                aria-current={active === item.id ? "location" : undefined}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active === item.id
                    ? "bg-background font-medium text-foreground ring-1 ring-border"
                    : "text-subtle hover:bg-background hover:text-foreground",
                )}
              >
                {item.label}
                {item.badge ? (
                  <span className="rounded-sm border border-border bg-background px-1.5 text-xs font-medium text-foreground tabular-nums">
                    {item.badge}
                  </span>
                ) : null}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    );
  }

  return (
    <nav
      aria-label="Report sections"
      className={cn(
        "sticky top-0 z-20 -mx-4 border-b border-border bg-soft/95 backdrop-blur-sm sm:-mx-6 lg:hidden",
        className,
      )}
    >
      <ul
        ref={strip}
        className="flex h-12 scrollbar-none items-center gap-1 overflow-x-auto px-4 sm:px-6"
      >
        {items.map((item) => (
          <li key={item.id} className="shrink-0">
            <a
              href={`#${item.id}`}
              data-section={item.id}
              aria-current={active === item.id ? "location" : undefined}
              className={cn(
                "inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm whitespace-nowrap outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active === item.id
                  ? "bg-background font-medium text-foreground shadow-[inset_0_-2px_0_var(--navy)]"
                  : "text-subtle hover:text-foreground",
              )}
            >
              {item.label}
              {item.badge ? (
                <span className="text-xs text-subtle tabular-nums">{item.badge}</span>
              ) : null}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
