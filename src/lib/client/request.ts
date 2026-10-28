import { failureFrom, isSuccessBody, type ClientFailure } from "./api-response";

export type ClientOutcome<T> = { ok: true; data: T } | ClientFailure;

async function send(url: string, init: RequestInit): Promise<Response | ClientFailure> {
  try {
    return await fetch(url, {
      ...init,
      headers: { Accept: "application/json", ...init.headers },
      cache: "no-store",
    });
  } catch (error) {
    const aborted = error instanceof DOMException && error.name === "AbortError";
    return { ok: false, code: aborted ? "ABORTED" : "NETWORK_ERROR", status: 0 };
  }
}

/** A JSON API call that never throws: the data, or a ClientFailure. */
export async function requestJson<T>(
  url: string,
  init: RequestInit,
): Promise<ClientOutcome<T>> {
  const response = await send(url, init);
  if (!(response instanceof Response)) return response;

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // Not JSON (e.g. a proxy error page); handled as a failure below.
  }
  if (response.ok && isSuccessBody<T>(body)) return { ok: true, data: body.data };
  return failureFrom(response.status, body, response.headers);
}

/** A call whose success has no body (204), e.g. a delete. Never throws. */
export async function requestEmpty(
  url: string,
  init: RequestInit,
): Promise<{ ok: true } | ClientFailure> {
  const response = await send(url, init);
  if (!(response instanceof Response)) return response;
  if (response.ok) return { ok: true };
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // Not JSON; the status decides.
  }
  return failureFrom(response.status, body, response.headers);
}
