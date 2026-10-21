import { resolveOwner } from "@/lib/auth/guest";
import { UPLOAD_LIMITS } from "@/lib/config/limits";
import { readBodyWithLimit } from "@/lib/http/body";
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
    const rate = await uploadRateLimiter.consume(
      `upload:ip:${clientAddress(request.headers)}`,
    );
    if (!rate.allowed) {
      throw new AppError("RATE_LIMITED", {
        headers: { "Retry-After": String(rate.retryAfterSeconds) },
      });
    }

    const body = await readBodyWithLimit(
      request,
      MAX_BODY_BYTES,
      () => new AppError("FILE_TOO_LARGE"),
    );
    const file = await readFilePart(request, body);
    // The guest identity is issued on the first upload, never just for visiting the site.
    const { owner, setCookie } = resolveOwner(request, { create: true });
    const result = await acceptResumeUpload(file, { requestId, owner });
    return jsonSuccess(result, requestId, {
      status: 201,
      headers: setCookie ? { "Set-Cookie": setCookie } : undefined,
    });
  } catch (error) {
    return jsonError(error, requestId, ROUTE);
  }
}
