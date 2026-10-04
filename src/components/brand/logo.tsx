import Link from "next/link";
import { cn } from "cn";

/** The ATSly mark: a three-quarter score ring. Decorative; the wordmark carries the name. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      className={cn("size-5 shrink-0", className)}
      fill="none"
    >
      <circle cx="10" cy="10" r="7.5" stroke="var(--border-strong)" strokeWidth="2.5" />
      <path
        d="M10 2.5a7.5 7.5 0 1 1-7.5 7.5"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

type LogoProps = {
  href?: string;
  className?: string;
};

/** Mark plus wordmark, linking home. */
export function Logo({ href = "/", className }: LogoProps) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-2 rounded-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
    >
      <LogoMark />
      <span className="text-[1.0625rem] font-semibold tracking-tight">ATSly</span>
      <span className="sr-only">, home</span>
    </Link>
  );
}
