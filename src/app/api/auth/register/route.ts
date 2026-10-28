import { readJsonBody } from "@/lib/http/body";
import { AppError } from "@/lib/http/errors";
import { jsonError, jsonSuccess, newRequestId } from "@/lib/http/respond";
import { clientAddress } from "@/lib/security/rate-limit";
import { registerUser } from "@/lib/services/account-service";
import { MAX_REGISTER_BODY_BYTES, registerSchema } from "@/lib/validation/auth";

const ROUTE = "POST /api/auth/register";

/**
 * Creates an account — docs/PLANNING.md §22. The client then signs in with the same
 * credentials, which also moves its guest data to the account.
 */
export async function POST(request: Request): Promise<Response> {
  const requestId = newRequestId();
  try {
    const body = await readJsonBody(request, MAX_REGISTER_BODY_BYTES);
    const input = registerSchema.safeParse(body);
    if (!input.success) {
      const issue = input.error.issues[0];
      throw new AppError("INVALID_INPUT", {
        message: issue?.message,
        // The field lets the form put the message next to the right input.
        ...(issue?.path[0] ? { details: { field: String(issue.path[0]) } } : {}),
      });
    }
    const result = await registerUser(input.data, {
      requestId,
      address: clientAddress(request.headers),
    });
    return jsonSuccess(result, requestId, { status: 201 });
  } catch (error) {
    return jsonError(error, requestId, ROUTE);
  }
}
