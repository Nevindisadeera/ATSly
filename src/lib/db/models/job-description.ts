import { model, models, Schema, type Model, type Types } from "mongoose";

import { BASE_OPTIONS, OwnerSchema } from "./shared";

/**
 * job_descriptions — docs/PLANNING.md §16.3. A posting the user pasted, with the
 * requirements extracted from it. Scans reference it; the same text pasted again by the same
 * owner reuses the stored extraction.
 */
const JobDescriptionSchema = new Schema(
  {
    owner: { type: OwnerSchema, required: true },
    /** Set for guest-owned job descriptions; the TTL index deletes them at this time. */
    expiresAt: { type: Date },
    title: { type: String, maxlength: 120 },
    company: { type: String, maxlength: 120 },
    rawText: { type: String, required: true, maxlength: 15_000 },
    /** sha256 of the normalized text and title; the dedupe and (Phase 10a) AI cache key. */
    normalizedHash: { type: String, required: true, match: /^[0-9a-f]{64}$/ },
    /** JobRequirements; typed in code, stored as-is. */
    extracted: { type: Schema.Types.Mixed, required: true },
    extractionSource: { type: String, enum: ["ai", "rules"], required: true },
    /** Version of the rules extractor (the matching engine version). */
    extractorVersion: { type: String, required: true },
    promptVersion: { type: String },
  },
  BASE_OPTIONS,
);

JobDescriptionSchema.index({ "owner.type": 1, "owner.id": 1, createdAt: -1 });
JobDescriptionSchema.index({ normalizedHash: 1 });
JobDescriptionSchema.index({
  "owner.type": 1,
  "owner.id": 1,
  normalizedHash: 1,
  extractorVersion: 1,
});
JobDescriptionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type JobDescriptionDocument = {
  _id: Types.ObjectId;
  owner: { type: "guest" | "user"; id: string };
  expiresAt?: Date | null;
  title?: string | null;
  company?: string | null;
  rawText: string;
  normalizedHash: string;
  extracted: unknown;
  extractionSource: "ai" | "rules";
  extractorVersion: string;
  promptVersion?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export const JobDescriptionModel: Model<JobDescriptionDocument> =
  (models.JobDescription as Model<JobDescriptionDocument> | undefined) ??
  model<JobDescriptionDocument>(
    "JobDescription",
    JobDescriptionSchema,
    "job_descriptions",
  );
