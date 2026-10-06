import { UPLOAD_LIMITS } from "@/lib/config/limits";
import { AppError } from "@/lib/http/errors";
import { jsonError, jsonSuccess, newRequestId } from "@/lib/http/respond";
import { clientAddress } from "@/lib/security/rate-limit";
import { uploadRateLimiter } from "@/lib/security/upload-limiter";
import { acceptResumeUpload } from "@/lib/services/resume-service";

export const maxDuration = 30;

const ROUTE = "POST /api/resumes";

/** Room for multipart boundaries and part headers on top of the file itself. */
const MULTIPART_OVERHEAD_BYTES = 64 * 1024;
const MAX_BODY_BYTES = UPLOAD_LIMITS.maxBytes + MULTIPART_OVERHEAD_BYTES;

/**
 * Reads the request body, stopping as soon as it exceeds the limit. Content-Length is
 * checked first but can't be trusted (or may be absent), so the stream is capped too.
 */
async function readBodyWithLimit(request: Request, limit: number): Promise<Buffer> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > limit) throw new AppError("FILE_TOO_LARGE");
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
      throw new AppError("FILE_TOO_LARGE");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

/** Extracts the single `file` part from a multipart/form-data body. */
async function readFilePart(request: Request, body: Buffer) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    throw new AppError("INVALID_INPUT", {
      message: "Send the file as multipart/form-data.",
    });
  }

  let form: FormData;
  try {
    form = await new Response(new Uint8Array(body), {
      headers: { "content-type": contentType },
    }).formData();
  } catch {
    throw new AppError("INVALID_INPUT", { message: "The upload could not be read." });
  }

  const files = form.getAll("file");
  if (files.length !== 1 || !(files[0] instanceof File)) {
    throw new AppError("INVALID_INPUT", {
      message: "Attach exactly one file in the `file` field.",
    });
  }
  const file = files[0];
  return {
    name: file.name,
    type: file.type,
    bytes: Buffer.from(await file.arrayBuffer()),
  };
}

export async function POST(request: Request): Promise<Response> {
  const requestId = newRequestId();
  try {
    const rate = uploadRateLimiter.consume(`upload:ip:${clientAddress(request.headers)}`);
    if (!rate.allowed) {
      throw new AppError("RATE_LIMITED", {
        headers: { "Retry-After": String(rate.retryAfterSeconds) },
      });
    }

    const body = await readBodyWithLimit(request, MAX_BODY_BYTES);
    const file = await readFilePart(request, body);
    const result = await acceptResumeUpload(file, { requestId });
    return jsonSuccess(result, requestId, { status: 201 });
  } catch (error) {
    return jsonError(error, requestId, ROUTE);
  }
}
