/**
 * Shared report view-model types used by UI components.
 * Score-to-band calculation lives in the ATS and matching engines (Phases 7a and 9a);
 * components only receive the resulting band.
 */

/** ATS compatibility bands — docs/PLANNING.md §18.3. */
export type AtsBand = "excellent" | "good" | "fair" | "needs_work";

/** Job match bands — docs/PLANNING.md §19.2. */
export type MatchBand = "strong" | "moderate" | "partial" | "low";

export type Band = AtsBand | MatchBand;

export type Severity = "critical" | "major" | "minor" | "info";

/** Visual tone shared by bands and bars. Neutral is navy: "good" needs no color. */
export type Tone = "positive" | "neutral" | "caution" | "negative";
