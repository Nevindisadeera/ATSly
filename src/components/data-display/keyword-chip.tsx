import { Check, Plus } from "lucide-react";
import { cn } from "cn";

export type KeywordChipState = "matched" | "missing" | "backed" | "listed";

export type KeywordChipProps = {
  term: string;
  /**
   * matched: found in the resume (job match). missing: required by the job but not found.
   * backed: a listed skill that also appears in experience. listed: listed in Skills only.
   */
  state: KeywordChipState;
  importance?: "required" | "preferred";
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

export function keywordChipClasses(state: KeywordChipState, className?: string) {
  return cn(
    "inline-flex h-7 max-w-full items-center gap-1.5 rounded-sm border px-2.5 text-sm font-medium",
    STATE_CLASSES[state],
    className,
  );
}

/** Icon, term, preferred marker and screen-reader state, shared by both chip variants. */
export function KeywordChipContent({
  term,
  state,
  importance,
}: Pick<KeywordChipProps, "term" | "state" | "importance">) {
  return (
    <>
      {state === "matched" || state === "backed" ? (
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
      ) : null}
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
}

/** Static keyword chip. For a chip with a detail tooltip, use KeywordChipWithTooltip. */
export function KeywordChip({ term, state, importance, className }: KeywordChipProps) {
  return (
    <span className={keywordChipClasses(state, className)}>
      <KeywordChipContent term={term} state={state} importance={importance} />
    </span>
  );
}
