import { cn } from "cn";

import type { Band } from "@/types/report";

import { BAND_META, TONE_CHIP_CLASSES, TONE_STROKE } from "./tone";

type BandChipProps = {
  band: Band;
  /** Overrides the default band label, e.g. "ATS-ready". */
  children?: React.ReactNode;
  className?: string;
};

export function BandChip({ band, children, className }: BandChipProps) {
  const meta = BAND_META[band];
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium",
        TONE_CHIP_CLASSES[meta.tone],
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="size-1.5 rounded-full"
        style={{ backgroundColor: TONE_STROKE[meta.tone] }}
      />
      {children ?? meta.label}
    </span>
  );
}
