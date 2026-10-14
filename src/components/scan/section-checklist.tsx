import { useId } from "react";
import { CircleCheck, Minus } from "lucide-react";
import { cn } from "cn";

import type { ResumeSectionKind } from "@/types/api";

import { sectionChecklist } from "./section-checklist-items";

type SectionChecklistProps = {
  sections: { kind: ResumeSectionKind }[];
  className?: string;
};

/**
 * What the parser found, as the plan specifies: "Experience ✓ · Education ✓ · Skills ✓ ·
 * Summary –". Missing core sections are shown so the user knows what an ATS may not see.
 */
export function SectionChecklist({ sections, className }: SectionChecklistProps) {
  const labelId = useId();
  const items = sectionChecklist(sections);
  // When nothing was found, the upload warnings already explain it; don't repeat it here.
  const showHint = items.some((i) => !i.found) && items.some((i) => i.found);

  return (
    <div className={className}>
      <p id={labelId} className="text-xs font-medium text-subtle">
        Sections
      </p>
      <ul aria-labelledby={labelId} className="mt-2 flex flex-wrap gap-2">
        {items.map((item) => (
          <li
            key={item.kind}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-sm border px-2.5 text-sm",
              item.found
                ? "border-border bg-soft text-foreground"
                : "border-dashed border-border-strong bg-background text-muted-foreground",
            )}
          >
            {item.found ? (
              <CircleCheck aria-hidden="true" className="size-3.5 text-success-strong" />
            ) : (
              <Minus aria-hidden="true" className="size-3.5" />
            )}
            {item.label}
            <span className="sr-only">{item.found ? ", found" : ", not found"}</span>
          </li>
        ))}
      </ul>
      {showHint ? (
        <p className="mt-2 text-xs text-subtle">
          Sections marked – weren&apos;t found. If your resume has them, a standard
          heading helps ATS systems find them.
        </p>
      ) : null}
    </div>
  );
}
