"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "cn";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { detectJobTitle } from "@/lib/matching/title";

import {
  characterCount,
  jobDescriptionHint,
  jobDescriptionStatus,
  type JobDescriptionValue,
} from "./job-description";

type JobDescriptionInputProps = {
  value: JobDescriptionValue;
  onChange: (value: JobDescriptionValue) => void;
  label?: string;
  className?: string;
};

const HINT_TONE = {
  muted: "text-subtle",
  positive: "text-success-strong",
  danger: "font-medium text-danger-strong",
} as const;

/**
 * Job description textarea with a live character count, length hints and optional title
 * and company — docs/PLANNING.md §7.2. The title is prefilled from the posting until the
 * user edits it.
 */
export function JobDescriptionInput({
  value,
  onChange,
  label = "Job description",
  className,
}: JobDescriptionInputProps) {
  const id = useId();
  const [detailsOpen, setDetailsOpen] = useState(Boolean(value.title || value.company));
  const [titleEdited, setTitleEdited] = useState(Boolean(value.title));
  const status = jobDescriptionStatus(value.text);
  const hint = jobDescriptionHint(status);

  function changeText(text: string) {
    onChange({
      ...value,
      text,
      title: titleEdited ? value.title : (detectJobTitle(text) ?? ""),
    });
  }

  return (
    <div className={cn("grid gap-2", className)}>
      <Label htmlFor={`${id}-text`}>
        {label} <span className="font-normal text-subtle">(optional)</span>
      </Label>
      <Textarea
        id={`${id}-text`}
        value={value.text}
        onChange={(event) => changeText(event.target.value)}
        placeholder="Paste the job posting here…"
        aria-describedby={`${id}-hint ${id}-count`}
        aria-invalid={status === "too_long" || undefined}
        spellCheck={false}
        className="max-h-120 min-h-55 overflow-y-auto"
      />
      <div className="flex items-start justify-between gap-4 text-sm leading-6">
        <p
          id={`${id}-hint`}
          aria-live="polite"
          className={hint ? HINT_TONE[hint.tone] : undefined}
        >
          {hint?.text}
        </p>
        <span id={`${id}-count`} className="shrink-0 text-subtle tabular-nums">
          {characterCount(value.text)}
        </span>
      </div>

      <button
        type="button"
        aria-expanded={detailsOpen}
        aria-controls={`${id}-details`}
        onClick={() => setDetailsOpen((open) => !open)}
        className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-sm text-sm font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        Add details
        <ChevronDown
          aria-hidden="true"
          className={cn("size-4 transition-transform", detailsOpen && "rotate-180")}
        />
      </button>
      {/* Always rendered so aria-controls points at it; hidden while collapsed. */}
      <div
        id={`${id}-details`}
        className={cn("mt-2 gap-4 sm:grid-cols-2", detailsOpen ? "grid" : "hidden")}
      >
        <div className="grid gap-2">
          <Label htmlFor={`${id}-title`}>Job title</Label>
          <Input
            id={`${id}-title`}
            value={value.title}
            maxLength={120}
            onChange={(event) => {
              setTitleEdited(true);
              onChange({ ...value, title: event.target.value });
            }}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${id}-company`}>Company</Label>
          <Input
            id={`${id}-company`}
            value={value.company}
            maxLength={120}
            onChange={(event) => onChange({ ...value, company: event.target.value })}
          />
        </div>
      </div>
    </div>
  );
}
