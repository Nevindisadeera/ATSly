"use client";

import { ChevronDown } from "lucide-react";
import { cn } from "cn";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import {
  KeywordChipContent,
  keywordChipClasses,
  type KeywordChipProps,
} from "./keyword-chip";

/**
 * Keyword chip that opens its details (match type, evidence) on click, tap or Enter.
 * The touch-friendly counterpart of KeywordChipWithTooltip; import it directly.
 */
export function KeywordChipWithDetails({
  details,
  detailsLabel,
  className,
  ...chip
}: KeywordChipProps & {
  details: React.ReactNode;
  /** Accessible name for the popover, e.g. "Python: how it matched". */
  detailsLabel: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            keywordChipClasses(chip.state, className),
            "cursor-pointer outline-none hover:border-border-strong focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background data-[state=open]:border-navy",
          )}
        >
          <KeywordChipContent {...chip} />
          <ChevronDown aria-hidden="true" className="size-3.5 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent aria-label={detailsLabel}>{details}</PopoverContent>
    </Popover>
  );
}
