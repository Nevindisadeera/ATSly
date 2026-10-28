import { TASK_INSTRUCTIONS } from "./prompts";
import type { AiTaskName } from "./provider";
import {
  ContentAnalysisSchema,
  JobRequirementsSchema,
  MatchAssessmentSchema,
  type AiJobRequirements,
  type ContentAnalysis,
  type MatchAssessment,
} from "./schemas";

/** The three AI tasks — docs/PLANNING.md §20: schema, instructions and output budget. */
export const AI_TASKS = {
  extractJobRequirements: {
    schema: JobRequirementsSchema,
    instructions: TASK_INSTRUCTIONS.extractJobRequirements,
    maxOutputTokens: 2_500,
  },
  analyzeContent: {
    schema: ContentAnalysisSchema,
    instructions: TASK_INSTRUCTIONS.analyzeContent,
    maxOutputTokens: 5_000,
  },
  assessMatch: {
    schema: MatchAssessmentSchema,
    instructions: TASK_INSTRUCTIONS.assessMatch,
    maxOutputTokens: 4_000,
  },
} as const;

export type AiTaskOutput = {
  extractJobRequirements: AiJobRequirements;
  analyzeContent: ContentAnalysis;
  assessMatch: MatchAssessment;
};

export const AI_TASK_NAMES = Object.keys(AI_TASKS) as AiTaskName[];
