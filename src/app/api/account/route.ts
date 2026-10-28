import { resolveOwner } from "@/lib/auth/request-owner";
import { SECURE_SESSION_COOKIE, SESSION_COOKIE } from "@/lib/auth/session";
import { readJsonBody } from "@/lib/http/body";
import { AppError } from "@/lib/http/errors";
import { jsonError, newRequestId, noContent } from "@/lib/http/respond";
import { deleteAccount } from "@/lib/services/account-service";
import { confirmDeleteSchema } from "@/lib/validation/auth";

/**
 * Deletes the signed-in account and everything in it — docs/PLANNING.md §7.6 and §16.7.
 * The body must be `{ "confirm": "DELETE" }`. The response signs this browser out.
 */
export async function DELETE(request: Request): Promise<Response> {
  const requestId = newRequestId();
  try {
    const resolved = await resolveOwner(request);
    if (resolved?.owner.type !== "user") throw new AppError("UNAUTHENTICATED");
    const input = confirmDeleteSchema.safeParse(await readJsonBody(request, 1024));
    if (!input.success) {
      throw new AppError("INVALID_INPUT", { message: input.error.issues[0]?.message });
    }

    await deleteAccount(resolved.owner.id, { requestId });

    const response = noContent(requestId);
    for (const [name, secure] of [
      [SESSION_COOKIE, false],
      [SECURE_SESSION_COOKIE, true],
    ] as const) {
      response.headers.append(
        "Set-Cookie",
        `${name}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`,
      );
    }
    return response;
  } catch (error) {
    return jsonError(error, requestId, "DELETE /api/account");
  }
}
