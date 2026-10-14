// Runs a local MongoDB for development with no installation: npm run db:local
// Data persists in .data/mongo between runs. Connection string: mongodb://127.0.0.1:27017/atsly
// If a MongoDB is already listening on 27017 (e.g. an installed service), this exits quietly.
import { mkdirSync } from "node:fs";
import { createConnection } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { MongoMemoryServer } from "mongodb-memory-server";

const PORT = 27017;
const dbPath = join(dirname(fileURLToPath(import.meta.url)), "../../.data/mongo");

const portInUse = await new Promise((resolve) => {
  const socket = createConnection({ port: PORT, host: "127.0.0.1" });
  socket.once("connect", () => {
    socket.end();
    resolve(true);
  });
  socket.once("error", () => resolve(false));
});

if (portInUse) {
  console.log(`A MongoDB is already running on port ${PORT}; using it.`);
  process.exit(0);
}

mkdirSync(dbPath, { recursive: true });
const server = await MongoMemoryServer.create({
  instance: { port: PORT, ip: "127.0.0.1", dbPath, storageEngine: "wiredTiger" },
});

console.log(`Local MongoDB ready at ${server.getUri("atsly")}`);
console.log(`Data directory: ${dbPath}`);
console.log("Press Ctrl+C to stop.");

const stop = async () => {
  await server.stop({ doCleanup: false });
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
