import "server-only";

import { AppError, isAppError } from "@/lib/http/errors";
import { logger } from "@/lib/logging/logger";

import { connectDb } from "./mongoose";

/** Error names the MongoDB driver and Mongoose use when the server can't be reached. */
const CONNECTIVITY_ERRORS = new Set([
  "MongooseServerSelectionError",
  "MongoServerSelectionError",
  "MongoNetworkError",
  "MongoNetworkTimeoutError",
  "MongoNotConnectedError",
  "MongoTopologyClosedError",
  "MongoPoolClearedError",
]);

export function isConnectivityError(error: unknown): boolean {
  return error instanceof Error && CONNECTIVITY_ERRORS.has(error.name);
}

/**
 * Runs a database operation after ensuring a connection. Outages become a clean 503
 * SERVICE_UNAVAILABLE instead of a generic 500.
 */
export async function withDb<T>(operation: () => Promise<T>): Promise<T> {
  try {
    await connectDb();
    return await operation();
  } catch (error) {
    if (isAppError(error)) throw error;
    if (isConnectivityError(error)) {
      logger.error("db.unavailable", { errorName: (error as Error).name });
      throw new AppError("SERVICE_UNAVAILABLE", { cause: error });
    }
    throw error;
  }
}
