import { model, models, Schema, type Model } from "mongoose";

/**
 * rate_limits — docs/PLANNING.md §16.6. One document per key per fixed window, e.g.
 * "upload:ip:203.0.113.7:493210". Expired windows are removed by the TTL index.
 */
export type RateLimitDocument = { key: string; count: number; expiresAt: Date };

const RateLimitSchema = new Schema<RateLimitDocument>(
  {
    key: { type: String, required: true },
    count: { type: Number, required: true, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { versionKey: false },
);

RateLimitSchema.index({ key: 1 }, { unique: true });
RateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RateLimitModel: Model<RateLimitDocument> =
  (models.RateLimit as Model<RateLimitDocument> | undefined) ??
  model<RateLimitDocument>("RateLimit", RateLimitSchema, "rate_limits");
