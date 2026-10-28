import { resolveOwner } from "@/lib/auth/request-owner";
import { AppError } from "@/lib/http/errors";
import { jsonError, jsonSuccess, newRequestId, noContent } from "@/lib/http/respond";
import { deleteResumeForOwner, getResumeForOwner } from "@/lib/services/resume-service";

/**
 * A resume belongs to whoever uploaded it. Without a session or valid guest cookie, or for
 * someone else's resume, the answer is 404 — the same as for an id that doesn't exist.
 */
async function ownerOrNotFound(request: Request) {
  const resolved = await resolveOwner(request);
  if (!resolved) throw new AppError("NOT_FOUND");
  return resolved.owner;
}

export async function GET(request: Request, ctx: RouteContext<"/api/resumes/[id]">) {
  const requestId = newRequestId();
  try {
    const { id } = await ctx.params;
    const resume = await getResumeForOwner(await ownerOrNotFound(request), id);
    return jsonSuccess(resume, requestId);
  } catch (error) {
    return jsonError(error, requestId, "GET /api/resumes/:id");
  }
}

export async function DELETE(request: Request, ctx: RouteContext<"/api/resumes/[id]">) {
  const requestId = newRequestId();
  try {
    const { id } = await ctx.params;
    await deleteResumeForOwner(await ownerOrNotFound(request), id);
    return noContent(requestId);
  } catch (error) {
    return jsonError(error, requestId, "DELETE /api/resumes/:id");
  }
}
