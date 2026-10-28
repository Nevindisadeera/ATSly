import { after } from "next/server";

import { resolveOwner } from "@/lib/auth/request-owner";
import { readJsonBody } from "@/lib/http/body";
import { AppError } from "@/lib/http/errors";
import { jsonError, jsonSuccess, newRequestId } from "@/lib/http/respond";
import { clientAddress } from "@/lib/security/rate-limit";
import { consumeScanQuota } from "@/lib/security/scan-limiter";
import { runScanPipeline } from "@/lib/services/scan-pipeline";
import { createScan } from "@/lib/services/scan-service";
import { createScanSchema, MAX_SCAN_BODY_BYTES } from "@/lib/validation/scan";
import type { CreateScanResult } from "@/types/api";

/** The pipeline runs in after(), within this route's duration — docs/PLANNING.md §25. */
export const maxDuration = 60;

const ROUTE = "POST /api/scans";

/**
 * Starts a scan of one of the caller's resumes. Responds 202 with the scan id at once; the
 * analysis finishes after the response and the client polls GET /api/scans/:id/status.
 */
export async function POST(request: Request): Promise<Response> {
  const requestId = newRequestId();
  try {
    const body = await readJsonBody(request, MAX_SCAN_BODY_BYTES);
    const input = createScanSchema.safeParse(body);
    if (!input.success) {
      throw new AppError("INVALID_INPUT", { message: input.error.issues[0]?.message });
    }

    // Without an owner cookie there is no resume the caller could own.
    const resolved = await resolveOwner(request);
    if (!resolved) throw new AppError("NOT_FOUND");

    const quota = await consumeScanQuota(resolved.owner, clientAddress(request.headers));
    if (!quota.allowed) {
      throw new AppError("RATE_LIMITED", {
        message: "You've reached today's scan limit.",
        headers: { "Retry-After": String(quota.retryAfterSeconds) },
      });
    }

    const result = await createScan(input.data, { requestId, owner: resolved.owner });
    after(() => runScanPipeline(result.scanId, { requestId }));
    return jsonSuccess<CreateScanResult>(result, requestId, { status: 202 });
  } catch (error) {
    return jsonError(error, requestId, ROUTE);
  }
}
