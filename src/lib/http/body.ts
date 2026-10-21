import { AppError } from "./errors";

/**
 * Reads the request body, stopping as soon as it exceeds the limit. Content-Length is
 * checked first but can't be trusted (or may be absent), so the stream is capped too.
 */
export async function readBodyWithLimit(
  request: Request,
  limit: number,
  tooLarge: () => AppError,
): Promise<Buffer> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > limit) throw tooLarge();
  if (!request.body) throw new AppError("INVALID_INPUT");

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > limit) {
      await reader.cancel();
      throw tooLarge();
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

/** Reads a JSON request body of at most `limit` bytes. Anything else is INVALID_INPUT. */
export async function readJsonBody(request: Request, limit: number): Promise<unknown> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new AppError("INVALID_INPUT", { message: "Send the request body as JSON." });
  }
  const body = await readBodyWithLimit(
    request,
    limit,
    () => new AppError("INVALID_INPUT", { message: "The request body is too large." }),
  );
  try {
    return JSON.parse(body.toString("utf8"));
  } catch {
    throw new AppError("INVALID_INPUT", {
      message: "The request body is not valid JSON.",
    });
  }
}
