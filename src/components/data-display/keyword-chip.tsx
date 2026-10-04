import { Check, Plus } from "lucide-react";
import { cn } from "cn";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export type KeywordChipState = "matched" | "missing" | "backed" | "listed";

type KeywordChipProps = {
  term: string;
  /**
   * matched: found in the resume (job match). missing: required by the job but not found.
   * backed: a listed skill that also appears in experience. listed: listed in Skills only.
   */
  state: KeywordChipState;
  importance?: "required" | "preferred";
  /** Optional detail, e.g. match type and evidence. Makes the chip focusable. */
  tooltip?: React.ReactNode;
  className?: string;
};

const STATE_CLASSES: Record<KeywordChipState, string> = {
  matched: "border-border bg-soft text-foreground",
  backed: "border-border bg-soft text-foreground",
  missing: "border-border-strong bg-background text-foreground",
  listed: "border-dashed border-border-strong bg-background text-body",
};

const STATE_SR_TEXT: Record<KeywordChipState, string> = {
  matched: "matched",
  backed: "backed by experience",
  missing: "missing",
  listed: "listed only",
};

export function KeywordChip({
  term,
  state,
  importance,
  tooltip,
  className,
}: KeywordChipProps) {
  const icon =
    state === "matched" || state === "backed" ? (
      <Check
        aria-hidden="true"
        className="size-3.5 text-success-strong"
        strokeWidth={2}
      />
    ) : state === "missing" ? (
      <Plus
        aria-hidden="true"
        className="size-3.5 text-muted-foreground"
        strokeWidth={2}
      />
    ) : null;

  const content = (
    <>
      {icon}
      <span>{term}</span>
      {importance === "preferred" ? (
        <span className="text-xs font-normal text-muted-foreground">preferred</span>
      ) : null}
      <span className="sr-only">
        , {STATE_SR_TEXT[state]}
        {importance === "required" ? ", required" : ""}
      </span>
    </>
  );

  const classes = cn(
    "inline-flex h-7 max-w-full items-center gap-1.5 rounded-sm border px-2.5 text-sm font-medium",
    STATE_CLASSES[state],
    className,
  );

  if (!tooltip) {
    return <span className={classes}>{content}</span>;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            classes,
            "cursor-default outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          )}
        >
          {content}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6}>
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}
