import { afterAll, beforeAll, beforeEach } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

import { connectDb, disconnectDb } from "@/lib/db/mongoose";

/**
 * Starts a private in-memory MongoDB for the current test file, connects the app's
 * Mongoose instance to it, and empties every collection before each test.
 */
export function setupTestDatabase() {
  let server: MongoMemoryServer | undefined;

  beforeAll(async () => {
    server = await MongoMemoryServer.create();
    process.env.MONGODB_URI = server.getUri("atsly-test");
    await connectDb();
    // Build indexes up front so TTL and uniqueness behave as in production.
    await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
  }, 120_000);

  beforeEach(async () => {
    const collections = await mongoose.connection.db?.collections();
    await Promise.all((collections ?? []).map((c) => c.deleteMany({})));
  });

  afterAll(async () => {
    await disconnectDb();
    await server?.stop();
    delete process.env.MONGODB_URI;
  });
}
