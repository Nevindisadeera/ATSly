import { pingDb } from "@/lib/db/mongoose";
import { newRequestId } from "@/lib/http/respond";

import packageJson from "../../../../package.json";

/** Liveness and database reachability, for uptime checks — docs/PLANNING.md §22. */
export async function GET(): Promise<Response> {
  const requestId = newRequestId();
  const dbUp = await pingDb();
  const version = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? packageJson.version;
  return Response.json(
    { data: { ok: dbUp, db: dbUp ? "up" : "down", version } },
    {
      status: dbUp ? 200 : 503,
      headers: { "Cache-Control": "no-store", "X-Request-Id": requestId },
    },
  );
}
