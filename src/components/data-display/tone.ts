import type { Band, Severity, Tone } from "@/types/report";

/** Presentation metadata for each band. Labels follow docs/PLANNING.md §18.3 and §19.2. */
export const BAND_META: Record<Band, { label: string; tone: Tone }> = {
  excellent: { label: "Excellent", tone: "positive" },
  good: { label: "Good", tone: "neutral" },
  fair: { label: "Fair", tone: "caution" },
  needs_work: { label: "Needs work", tone: "negative" },
  strong: { label: "Strong", tone: "positive" },
  moderate: { label: "Moderate", tone: "neutral" },
  partial: { label: "Partial", tone: "caution" },
  low: { label: "Low", tone: "negative" },
};

/** Stroke / fill color for marks (rings, bars, dots). */
export const TONE_STROKE: Record<Tone, string> = {
  positive: "var(--success)",
  neutral: "var(--navy)",
  caution: "var(--warning)",
  negative: "var(--danger)",
};

/** Classes for small labelled surfaces (chips). Text uses the -strong shade for contrast. */
export const TONE_CHIP_CLASSES: Record<Tone, string> = {
  positive: "border-success/30 bg-success-soft text-success-strong",
  neutral: "border-border bg-soft text-foreground",
  caution: "border-warning/40 bg-warning-soft text-warning-strong",
  negative: "border-danger/30 bg-danger-soft text-danger-strong",
};

export const SEVERITY_META: Record<Severity, { label: string; dotClass: string }> = {
  critical: { label: "Critical", dotClass: "bg-danger" },
  major: { label: "Major", dotClass: "bg-warning" },
  minor: { label: "Minor", dotClass: "bg-slate-400" },
  info: { label: "Info", dotClass: "bg-primary" },
};
