import { after } from "next/server";
import { z } from "zod";

import { resolveOwner } from "@/lib/auth/request-owner";
import { readJsonBody } from "@/lib/http/body";
import { AppError } from "@/lib/http/errors";
import { jsonError, jsonSuccess, newRequestId } from "@/lib/http/respond";
import { clientAddress } from "@/lib/security/rate-limit";
import { consumeScanQuota } from "@/lib/security/scan-limiter";
import { deleteAllData } from "@/lib/services/account-service";
import { listScans, SCAN_PAGE } from "@/lib/services/dashboard-service";
import { runScanPipeline } from "@/lib/services/scan-pipeline";
import { createScan } from "@/lib/services/scan-service";
import { confirmDeleteSchema } from "@/lib/validation/auth";
import { createScanSchema, MAX_SCAN_BODY_BYTES } from "@/lib/validation/scan";
import type { CreateScanResult, DeletedData, ScanListPage } from "@/types/api";

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

const listQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(SCAN_PAGE.max, `limit can be at most ${SCAN_PAGE.max}.`)
    .optional(),
  cursor: z.string().max(200).optional(),
});

/** Lists are for accounts; guests reach their reports from the results link (§22). */
async function signedInUser(request: Request) {
  const resolved = await resolveOwner(request);
  if (resolved?.owner.type !== "user") throw new AppError("UNAUTHENTICATED");
  return resolved.owner;
}

/** The signed-in user's scans, newest first, a page at a time (`?limit=&cursor=`). */
export async function GET(request: Request): Promise<Response> {
  const requestId = newRequestId();
  try {
    const owner = await signedInUser(request);
    const params = new URL(request.url).searchParams;
    const query = listQuerySchema.safeParse({
      limit: params.get("limit") ?? undefined,
      cursor: params.get("cursor") ?? undefined,
    });
    if (!query.success) {
      throw new AppError("INVALID_INPUT", { message: query.error.issues[0]?.message });
    }
    return jsonSuccess<ScanListPage>(await listScans(owner, query.data), requestId);
  } catch (error) {
    return jsonError(error, requestId, "GET /api/scans");
  }
}

/**
 * Deletes all of the signed-in user's scans, with the resumes and job descriptions behind
 * them (§7.6). The body must be `{ "confirm": "DELETE" }`.
 */
export async function DELETE(request: Request): Promise<Response> {
  const requestId = newRequestId();
  try {
    const owner = await signedInUser(request);
    const input = confirmDeleteSchema.safeParse(await readJsonBody(request, 1024));
    if (!input.success) {
      throw new AppError("INVALID_INPUT", { message: input.error.issues[0]?.message });
    }
    return jsonSuccess<DeletedData>(await deleteAllData(owner, { requestId }), requestId);
  } catch (error) {
    return jsonError(error, requestId, "DELETE /api/scans");
  }
}
