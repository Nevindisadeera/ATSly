import { model, models, Schema, type Model } from "mongoose";

/**
 * ai_cache — docs/PLANNING.md §16.5. Results of AI tasks keyed by
 * sha256(task + promptVersion + model + inputHash), kept 30 days. Entries hold derived
 * analysis only; a job description's extraction is shared across users because identical
 * input gives identical output and contains nothing about the user.
 */
export type AiCacheDocument = {
  key: string;
  task: string;
  model: string;
  promptVersion: string;
  payload: unknown;
  tokens: { input: number; output: number };
  expiresAt: Date;
  createdAt: Date;
};

const AiCacheSchema = new Schema<AiCacheDocument>(
  {
    key: { type: String, required: true },
    task: { type: String, required: true },
    model: { type: String, required: true },
    promptVersion: { type: String, required: true },
    payload: { type: Schema.Types.Mixed, required: true },
    tokens: {
      input: { type: Number, required: true },
      output: { type: Number, required: true },
    },
    expiresAt: { type: Date, required: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
    minimize: false,
  },
);

AiCacheSchema.index({ key: 1 }, { unique: true });
AiCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const AiCacheModel: Model<AiCacheDocument> =
  (models.AiCache as Model<AiCacheDocument> | undefined) ??
  model<AiCacheDocument>("AiCache", AiCacheSchema, "ai_cache");
