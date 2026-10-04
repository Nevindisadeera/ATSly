import { cn } from "cn";

import type { Severity } from "@/types/report";

import { SEVERITY_META } from "./tone";

type SeverityDotProps = {
  severity: Severity;
  /** Visible text. Defaults to the severity name so color is never the only signal. */
  children?: React.ReactNode;
  className?: string;
};

export function SeverityDot({ severity, children, className }: SeverityDotProps) {
  const meta = SEVERITY_META[severity];
  return (
    <span className={cn("inline-flex items-center gap-2 text-sm text-body", className)}>
      <span
        aria-hidden="true"
        className={cn("size-2 shrink-0 rounded-full", meta.dotClass)}
      />
      {children ?? meta.label}
    </span>
  );
}
