import type { Check } from "../types";
import { completenessChecks } from "./completeness";
import { contentChecks } from "./content";
import { formattingChecks } from "./formatting";
import { keywordChecks } from "./keywords";
import { readabilityChecks } from "./readability";
import { structureChecks } from "./structure";

/** Every check, in report order. docs/SCORING.md is generated from this list. */
export const CHECKS: readonly Check[] = [
  ...formattingChecks,
  ...structureChecks,
  ...completenessChecks,
  ...keywordChecks,
  ...contentChecks,
  ...readabilityChecks,
];
