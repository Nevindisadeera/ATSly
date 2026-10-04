import { Check } from "lucide-react";
import { cn } from "cn";

const STEPS = ["Resume", "Job description", "Analyze"] as const;

type ScanStepperProps = {
  /** Zero-based index of the current step. */
  current: number;
  className?: string;
};

/** Quiet progress indicator for the scan flow. Collapses to "Step 1 of 3" on small screens. */
export function ScanStepper({ current, className }: ScanStepperProps) {
  return (
    <nav aria-label="Scan progress" className={className}>
      <p className="text-sm text-subtle sm:hidden">
        Step {current + 1} of {STEPS.length}
        <span className="text-foreground"> · {STEPS[current]}</span>
      </p>
      <ol className="hidden items-center gap-3 sm:flex">
        {STEPS.map((label, i) => {
          const state = i < current ? "complete" : i === current ? "current" : "upcoming";
          return (
            <li
              key={label}
              aria-current={state === "current" ? "step" : undefined}
              className="flex items-center gap-3"
            >
              <span className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full border text-xs font-medium tabular-nums",
                    state === "complete" && "border-navy bg-navy text-white",
                    state === "current" && "border-navy text-foreground",
                    state === "upcoming" && "border-border-strong text-muted-foreground",
                  )}
                >
                  {state === "complete" ? (
                    <Check className="size-3.5" strokeWidth={2.5} />
                  ) : (
                    i + 1
                  )}
                </span>
                <span
                  className={cn(
                    "text-sm",
                    state === "upcoming"
                      ? "text-muted-foreground"
                      : "font-medium text-foreground",
                  )}
                >
                  {label}
                  {state === "complete" ? (
                    <span className="sr-only">, completed</span>
                  ) : null}
                </span>
              </span>
              {i < STEPS.length - 1 ? (
                <span aria-hidden="true" className="h-px w-8 bg-border-strong" />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
