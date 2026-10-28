import "server-only";

import { cookies, headers } from "next/headers";

import { decodeGuestCookie, GUEST_COOKIE } from "./guest";
import type { Owner } from "./owner";
import { sessionUserId } from "./session";

/**
 * The owner of the current request, for Server Components that read data through services
 * (docs/PLANNING.md §22): the signed-in user, else the guest cookie, else null.
 */
export async function currentOwner(): Promise<Owner | null> {
  const userId = await sessionUserId(await headers());
  if (userId) return { type: "user", id: userId };
  const store = await cookies();
  const guestId = decodeGuestCookie(store.get(GUEST_COOKIE)?.value);
  return guestId ? { type: "guest", id: guestId } : null;
}
