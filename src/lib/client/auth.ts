import { requestJson, type ClientOutcome } from "./request";

export type RegisterPayload = { name: string; email: string; password: string };

/** POST /api/auth/register: creates an account. Signing in is a separate step. Never throws. */
export function registerAccount(
  payload: RegisterPayload,
): Promise<ClientOutcome<{ id: string }>> {
  return requestJson<{ id: string }>("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
