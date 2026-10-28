import "server-only";

import { AiCacheModel, type AiCacheDocument } from "../models/ai-cache";
import { RateLimitModel } from "../models/rate-limit";
import { withDb } from "../with-db";

const CACHE_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
const DUPLICATE_KEY = 11000;
/** Spend is counted in millionths of a dollar so $inc stays exact. */
const MICROS = 1_000_000;

const spendKey = (day: Date) => `ai:spend:${day.toISOString().slice(0, 10)}`;

export const aiRepository = {
  getCached(
    key: string,
  ): Promise<{ payload: unknown; tokens: { input: number; output: number } } | null> {
    return withDb(async () => {
      const doc = await AiCacheModel.findOne({ key, expiresAt: { $gt: new Date() } })
        .select({ payload: 1, tokens: 1 })
        .lean<Pick<AiCacheDocument, "payload" | "tokens">>();
      return doc ? { payload: doc.payload, tokens: doc.tokens } : null;
    });
  },

  putCached(entry: Omit<AiCacheDocument, "expiresAt" | "createdAt">): Promise<void> {
    return withDb(async () => {
      try {
        await AiCacheModel.create({
          ...entry,
          expiresAt: new Date(Date.now() + CACHE_DAYS * DAY_MS),
        });
      } catch (error) {
        // Two scans computed the same result at once; the first one stored is kept.
        if ((error as { code?: number }).code !== DUPLICATE_KEY) throw error;
      }
    });
  },

  /** Dollars spent on AI today (UTC). */
  spentToday(now = new Date()): Promise<number> {
    return withDb(async () => {
      const doc = await RateLimitModel.findOne({ key: spendKey(now) }).lean();
      return (doc?.count ?? 0) / MICROS;
    });
  },

  addSpend(usd: number, now = new Date()): Promise<void> {
    const micros = Math.round(usd * MICROS);
    if (micros <= 0) return Promise.resolve();
    return withDb(async () => {
      const update = () =>
        RateLimitModel.updateOne(
          { key: spendKey(now) },
          {
            $inc: { count: micros },
            $setOnInsert: { expiresAt: new Date(now.getTime() + 2 * DAY_MS) },
          },
          { upsert: true },
        );
      try {
        await update();
      } catch (error) {
        if ((error as { code?: number }).code !== DUPLICATE_KEY) throw error;
        await update();
      }
    });
  },
};
