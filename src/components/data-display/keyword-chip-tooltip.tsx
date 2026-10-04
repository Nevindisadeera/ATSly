import { cn } from "cn";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import {
  KeywordChipContent,
  keywordChipClasses,
  type KeywordChipProps,
} from "./keyword-chip";

/**
 * Keyword chip with a detail tooltip (match type, evidence). Focusable so the tooltip is
 * reachable by keyboard. Kept in its own module so pages without tooltips don't load
 * Radix Tooltip; import it directly rather than from the data-display barrel.
 */
export function KeywordChipWithTooltip({
  tooltip,
  className,
  ...chip
}: KeywordChipProps & { tooltip: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            keywordChipClasses(chip.state, className),
            "cursor-default outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          )}
        >
          <KeywordChipContent {...chip} />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6}>
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}
