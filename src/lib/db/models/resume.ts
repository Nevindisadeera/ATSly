import { model, models, Schema, type Model, type Types } from "mongoose";

import { BASE_OPTIONS, OwnerSchema } from "./shared";

/**
 * resumes — docs/PLANNING.md §16.2.
 * The original file is never stored. The extracted text and layout signals are kept so
 * resumes can be re-scored when the engine improves; the parsed resume is embedded because
 * it is always read with the resume and never queried on its own.
 */
const ResumeSchema = new Schema(
  {
    owner: { type: OwnerSchema, required: true },
    /** Set for guest-owned resumes; the TTL index deletes them at this time. */
    expiresAt: { type: Date },
    file: {
      originalName: { type: String, required: true, maxlength: 200 },
      extension: { type: String, enum: ["pdf", "docx"], required: true },
      mimeType: { type: String, default: "" },
      sizeBytes: { type: Number, required: true, min: 1 },
      sha256: { type: String, required: true, match: /^[0-9a-f]{64}$/ },
      pageCount: { type: Number, required: true, min: 1 },
    },
    extraction: {
      engine: { type: String, enum: ["pdfjs", "ooxml"], required: true },
      /** Plain body text, capped (see MAX_STORED_TEXT). */
      text: { type: String, default: "" },
      wordCount: { type: Number, required: true },
      charCount: { type: Number, required: true },
      warnings: { type: [String], default: [] },
      /** LayoutProbe from the parser; typed in code, stored as-is. */
      layout: { type: Schema.Types.Mixed, required: true },
    },
    /** ParsedResume from the parser; typed in code, stored as-is. */
    parsed: { type: Schema.Types.Mixed, required: true },
    parserVersion: { type: String, required: true },
    language: { type: String, enum: ["en", "other"], required: true },
  },
  BASE_OPTIONS,
);

ResumeSchema.index({ "owner.type": 1, "owner.id": 1, createdAt: -1 });
// Re-uploading the same file returns the existing resume.
ResumeSchema.index({
  "owner.type": 1,
  "owner.id": 1,
  "file.sha256": 1,
  parserVersion: 1,
});
ResumeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/**
 * Stored shape. Written out explicitly because Mongoose's inference marks nested fields
 * optional even when the schema requires them; the schema enforces this at runtime.
 */
export type ResumeDocument = {
  _id: Types.ObjectId;
  owner: { type: "guest" | "user"; id: string };
  expiresAt?: Date | null;
  file: {
    originalName: string;
    extension: "pdf" | "docx";
    mimeType: string;
    sizeBytes: number;
    sha256: string;
    pageCount: number;
  };
  extraction: {
    engine: "pdfjs" | "ooxml";
    text: string;
    wordCount: number;
    charCount: number;
    warnings: string[];
    layout: unknown;
  };
  parsed: unknown;
  parserVersion: string;
  language: "en" | "other";
  createdAt: Date;
  updatedAt: Date;
};

/** Reuses the compiled model across hot reloads. */
export const ResumeModel: Model<ResumeDocument> =
  (models.Resume as Model<ResumeDocument> | undefined) ??
  model<ResumeDocument>("Resume", ResumeSchema, "resumes");

/** Extracted text kept per resume; a 10-page resume is well under this. */
export const MAX_STORED_TEXT = 200_000;
