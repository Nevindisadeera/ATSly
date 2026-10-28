import { resolveOwner } from "@/lib/auth/request-owner";
import { AppError } from "@/lib/http/errors";
import { jsonError, jsonSuccess, newRequestId, noContent } from "@/lib/http/respond";
import { deleteScanForOwner } from "@/lib/services/dashboard-service";
import { getScanForOwner } from "@/lib/services/scan-service";

/**
 * A scan with its full report once complete. Someone else's scan, or any scan without a
 * valid owner cookie, is a 404 — the same as an id that doesn't exist.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/scans/[id]">) {
  const requestId = newRequestId();
  try {
    const { id } = await ctx.params;
    const resolved = await resolveOwner(request);
    if (!resolved) throw new AppError("NOT_FOUND");
    return jsonSuccess(await getScanForOwner(resolved.owner, id), requestId);
  } catch (error) {
    return jsonError(error, requestId, "GET /api/scans/:id");
  }
}

/** Deletes one of the caller's scans (its resume stays). 404 for anyone else's. */
export async function DELETE(request: Request, ctx: RouteContext<"/api/scans/[id]">) {
  const requestId = newRequestId();
  try {
    const { id } = await ctx.params;
    const resolved = await resolveOwner(request);
    if (!resolved) throw new AppError("NOT_FOUND");
    await deleteScanForOwner(resolved.owner, id);
    return noContent(requestId);
  } catch (error) {
    return jsonError(error, requestId, "DELETE /api/scans/:id");
  }
}
