import { resolveOwner } from "@/lib/auth/request-owner";
import { AppError } from "@/lib/http/errors";
import { jsonError, jsonSuccess, newRequestId } from "@/lib/http/respond";
import { getScanStatusForOwner } from "@/lib/services/scan-service";

/** Polled by the results page while a scan runs. Small on purpose: no report fields. */
export async function GET(request: Request, ctx: RouteContext<"/api/scans/[id]/status">) {
  const requestId = newRequestId();
  try {
    const { id } = await ctx.params;
    const resolved = await resolveOwner(request);
    if (!resolved) throw new AppError("NOT_FOUND");
    return jsonSuccess(await getScanStatusForOwner(resolved.owner, id), requestId);
  } catch (error) {
    return jsonError(error, requestId, "GET /api/scans/:id/status");
  }
}
