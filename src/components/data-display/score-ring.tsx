import type { CSSProperties } from "react";
import { cn } from "cn";

import type { Band } from "@/types/report";

import { ringGeometry, ringStrokeWidth } from "./ring-geometry";
import { BAND_META, TONE_STROKE } from "./tone";

type ScoreRingProps = {
  /** Score from 0 to 100. */
  value: number;
  band: Band;
  /** Accessible name prefix, e.g. "ATS score" or "Job match". */
  label: string;
  /** Diameter in px. Plan sizes: 96 (dashboard), 128 (compact), 168 (report hero). */
  size?: 96 | 120 | 128 | 168;
  /** Draws the arc once on mount. Disabled automatically under prefers-reduced-motion. */
  animate?: boolean;
  /** Visible caption under the number, e.g. "ATS score". Omit to show "/ 100" only. */
  caption?: string;
  className?: string;
};

const NUMBER_CLASS: Record<NonNullable<ScoreRingProps["size"]>, string> = {
  96: "type-score-md",
  120: "text-[2.5rem] leading-none font-light tracking-[-0.03em] tabular-nums",
  128: "text-[2.75rem] leading-none font-light tracking-[-0.03em] tabular-nums",
  168: "type-score-xl",
};

export function ScoreRing({
  value,
  band,
  label,
  size = 168,
  animate = true,
  caption,
  className,
}: ScoreRingProps) {
  const strokeWidth = ringStrokeWidth(size);
  const { radius, center, circumference, dashOffset, clamped } = ringGeometry(
    value,
    size,
    strokeWidth,
  );
  const meta = BAND_META[band];
  const score = Math.round(clamped);

  return (
    <div
      role="img"
      aria-label={`${label} ${score} out of 100, ${meta.label}`}
      className={cn("relative inline-grid shrink-0 place-items-center", className)}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="absolute inset-0 -rotate-90"
        aria-hidden="true"
      >
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="var(--track)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={TONE_STROKE[meta.tone]}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className={cn(animate && "motion-safe:animate-ring-draw")}
          style={{ "--ring-circumference": circumference } as CSSProperties}
        />
      </svg>
      <div className="relative flex flex-col items-center" aria-hidden="true">
        <span className={cn("text-foreground", NUMBER_CLASS[size])}>{score}</span>
        <span className="mt-1 text-xs font-medium text-muted-foreground">
          {caption ?? "/ 100"}
        </span>
      </div>
    </div>
  );
}
