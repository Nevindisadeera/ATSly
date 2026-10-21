import { model, models, Schema, type Model, type Types } from "mongoose";

import type {
  ScanAiStatus,
  ScanErrorCode,
  ScanStage,
  ScanStatus,
  ScanSummary,
} from "@/types/api";

import { BASE_OPTIONS, OwnerSchema } from "./shared";

/**
 * scans — docs/PLANNING.md §16.4. One analysis of one resume. The finished report is
 * embedded: it is produced once, read as a unit, and never partially updated afterwards.
 * Fields for job matching and AI (match, jobSnapshot, ai details) arrive in Phases 9a and 10a.
 */

export const SCAN_STATUSES: ScanStatus[] = ["queued", "running", "complete", "failed"];
export const SCAN_STAGES: ScanStage[] = [
  "ats_rules",
  "job_matching",
  "ai_analysis",
  "finalizing",
];
const SCAN_ERROR_CODES: ScanErrorCode[] = ["INTERNAL", "TIMEOUT"];
const AI_STATUSES: ScanAiStatus[] = ["complete", "partial", "skipped", "failed"];

const ErrorSchema = new Schema(
  {
    code: { type: String, enum: SCAN_ERROR_CODES, required: true },
    message: { type: String, required: true },
    retryable: { type: Boolean, required: true },
  },
  { _id: false },
);

const SummarySchema = new Schema(
  {
    headline: { type: String, required: true },
    atsScore: { type: Number, required: true, min: 0, max: 100 },
    atsBand: {
      type: String,
      enum: ["excellent", "good", "fair", "needs_work"],
      required: true,
    },
    topActions: { type: [String], default: [] },
    issueCounts: {
      critical: { type: Number, required: true },
      major: { type: Number, required: true },
      minor: { type: Number, required: true },
    },
  },
  { _id: false },
);

const ScanSchema = new Schema(
  {
    owner: { type: OwnerSchema, required: true },
    /** Set for guest-owned scans; the TTL index deletes them at this time. */
    expiresAt: { type: Date },
    resumeId: { type: Schema.Types.ObjectId, ref: "Resume", required: true },
    jobDescriptionId: { type: Schema.Types.ObjectId, ref: "JobDescription" },
    status: { type: String, enum: SCAN_STATUSES, required: true, default: "queued" },
    stage: { type: String, enum: SCAN_STAGES, default: null },
    error: { type: ErrorSchema, default: undefined },
    engineVersion: { type: String, required: true },
    promptVersion: { type: String },
    model: { type: String },
    /** AtsReport from the engine; typed in code, stored as-is. */
    ats: { type: Schema.Types.Mixed },
    ai: {
      type: new Schema(
        { status: { type: String, enum: AI_STATUSES, required: true } },
        { _id: false },
      ),
      default: undefined,
    },
    summary: { type: SummarySchema, default: undefined },
    resumeSnapshot: {
      fileName: { type: String, required: true },
      pageCount: { type: Number, required: true },
      wordCount: { type: Number, required: true },
    },
    durationMs: { type: Number },
  },
  BASE_OPTIONS,
);

ScanSchema.index({ "owner.type": 1, "owner.id": 1, createdAt: -1 });
ScanSchema.index({ resumeId: 1, createdAt: -1 });
// The stale sweep looks for queued or running scans that stopped making progress.
ScanSchema.index({ status: 1, updatedAt: 1 });
ScanSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/** Stored shape, written out explicitly for the same reason as ResumeDocument. */
export type ScanDocument = {
  _id: Types.ObjectId;
  owner: { type: "guest" | "user"; id: string };
  expiresAt?: Date | null;
  resumeId: Types.ObjectId;
  jobDescriptionId?: Types.ObjectId | null;
  status: ScanStatus;
  stage?: ScanStage | null;
  error?: { code: ScanErrorCode; message: string; retryable: boolean } | null;
  engineVersion: string;
  promptVersion?: string | null;
  model?: string | null;
  ats?: unknown;
  ai?: { status: ScanAiStatus } | null;
  summary?: ScanSummary | null;
  resumeSnapshot: { fileName: string; pageCount: number; wordCount: number };
  durationMs?: number | null;
  createdAt: Date;
  updatedAt: Date;
};

/** Reuses the compiled model across hot reloads. */
export const ScanModel: Model<ScanDocument> =
  (models.Scan as Model<ScanDocument> | undefined) ??
  model<ScanDocument>("Scan", ScanSchema, "scans");
