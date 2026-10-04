import { useId } from "react";
import { cn } from "cn";

import type { Tone } from "@/types/report";

import { TONE_STROKE } from "./tone";

type ScoreBarProps = {
  label: string;
  value: number;
  max?: number;
  /** Category weight shown as a muted caption, e.g. 25 renders "25% of score". */
  weight?: number;
  /** Navy by default; status tones only when the value itself carries meaning. */
  tone?: Tone;
  /** Smaller type and thinner track for dense lists. */
  compact?: boolean;
  animate?: boolean;
  className?: string;
};

export function ScoreBar({
  label,
  value,
  max = 100,
  weight,
  tone = "neutral",
  compact = false,
  animate = true,
  className,
}: ScoreBarProps) {
  const labelId = useId();
  const safeMax = max > 0 ? max : 100;
  const clamped = Math.min(Math.max(Number.isFinite(value) ? value : 0, 0), safeMax);
  const percent = (clamped / safeMax) * 100;
  const display = Math.round(clamped);

  return (
    <div className={cn("grid gap-2", className)}>
      <div className="flex items-baseline justify-between gap-4">
        <div className="flex min-w-0 items-baseline gap-2">
          <span
            id={labelId}
            className={cn(
              "truncate font-medium text-foreground",
              compact ? "text-sm" : "text-[0.9375rem]",
            )}
          >
            {label}
          </span>
          {weight !== undefined ? (
            <span className="shrink-0 text-xs text-muted-foreground">
              {weight}% of score
            </span>
          ) : null}
        </div>
        <span
          className={cn(
            "shrink-0 font-medium text-foreground tabular-nums",
            compact ? "text-sm" : "text-[0.9375rem]",
          )}
        >
          {display}
          <span className="sr-only"> out of {safeMax}</span>
        </span>
      </div>
      <div
        role="progressbar"
        aria-labelledby={labelId}
        aria-valuemin={0}
        aria-valuemax={safeMax}
        aria-valuenow={display}
        className={cn(
          "w-full overflow-hidden rounded-full bg-track",
          compact ? "h-1" : "h-1.5",
        )}
      >
        <div
          className={cn(
            "h-full origin-left rounded-full",
            animate && "motion-safe:animate-bar-grow",
          )}
          style={{ width: `${percent}%`, backgroundColor: TONE_STROKE[tone] }}
        />
      </div>
    </div>
  );
}
