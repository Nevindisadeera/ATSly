import { randomUUID } from "node:crypto";

import { logger } from "@/lib/logging/logger";
import type { ApiErrorBody, ApiSuccessBody } from "@/types/api";

import { AppError, isAppError } from "./errors";

const BASE_HEADERS = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

export function newRequestId(): string {
  return randomUUID();
}

export function jsonSuccess<T>(
  data: T,
  requestId: string,
  init: { status?: number } = {},
): Response {
  const body: ApiSuccessBody<T> = { data };
  return Response.json(body, {
    status: init.status ?? 200,
    headers: { ...BASE_HEADERS, "X-Request-Id": requestId },
  });
}

/**
 * Turns any thrown value into the API error envelope. Expected AppErrors keep their code;
 * anything else is logged and returned as a generic INTERNAL error with no internals exposed.
 */
export function jsonError(error: unknown, requestId: string, route: string): Response {
  const appError = isAppError(error) ? error : new AppError("INTERNAL", { cause: error });

  if (!isAppError(error)) {
    logger.error("request.unhandled_error", {
      route,
      requestId,
      errorName: error instanceof Error ? error.name : typeof error,
      errorMessage: error instanceof Error ? error.message : undefined,
    });
  }

  const body: ApiErrorBody = {
    error: { code: appError.code, message: appError.message },
  };
  return Response.json(body, {
    status: appError.status,
    headers: { ...BASE_HEADERS, ...appError.headers, "X-Request-Id": requestId },
  });
}
