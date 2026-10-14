import "server-only";

import mongoose from "mongoose";

import { AppError } from "@/lib/http/errors";
import { logger } from "@/lib/logging/logger";

/**
 * One cached Mongoose connection per server instance. Serverless functions reuse warm
 * instances, so the connection is kept on globalThis to survive hot reloads in development.
 */

type Cache = { promise?: Promise<typeof mongoose> };
const globalCache = globalThis as typeof globalThis & { __atslyMongo?: Cache };
const cache: Cache = (globalCache.__atslyMongo ??= {});

export async function connectDb(): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) return mongoose;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    logger.error("db.not_configured", { variable: "MONGODB_URI" });
    throw new AppError("SERVICE_UNAVAILABLE", {
      message: "The database is not configured.",
    });
  }

  cache.promise ??= mongoose
    .connect(uri, {
      // Fail fast instead of queueing operations while disconnected.
      bufferCommands: false,
      serverSelectionTimeoutMS: 5_000,
      maxPoolSize: 10,
      autoIndex: true,
    })
    .catch((error: unknown) => {
      cache.promise = undefined;
      throw error;
    });
  return cache.promise;
}

/** For tests and scripts. */
export async function disconnectDb(): Promise<void> {
  cache.promise = undefined;
  await mongoose.disconnect();
}

export async function pingDb(): Promise<boolean> {
  try {
    await connectDb();
    await mongoose.connection.db?.admin().ping();
    return true;
  } catch {
    return false;
  }
}
