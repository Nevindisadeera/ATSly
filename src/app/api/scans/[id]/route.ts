import { resolveOwner } from "@/lib/auth/guest";
import { AppError } from "@/lib/http/errors";
import { jsonError, jsonSuccess, newRequestId } from "@/lib/http/respond";
import { getScanForOwner } from "@/lib/services/scan-service";

/**
 * A scan with its full report once complete. Someone else's scan, or any scan without a
 * valid owner cookie, is a 404 — the same as an id that doesn't exist.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/scans/[id]">) {
  const requestId = newRequestId();
  try {
    const { id } = await ctx.params;
    const resolved = resolveOwner(request);
    if (!resolved) throw new AppError("NOT_FOUND");
    return jsonSuccess(await getScanForOwner(resolved.owner, id), requestId);
  } catch (error) {
    return jsonError(error, requestId, "GET /api/scans/:id");
  }
}
