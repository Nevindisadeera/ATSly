import "server-only";

import { cookies } from "next/headers";

import { decodeGuestCookie, GUEST_COOKIE } from "./guest";
import type { Owner } from "./owner";

/**
 * The owner of the current request, for Server Components that read data through services
 * (docs/PLANNING.md §22). Null without a valid guest cookie. Accounts arrive in Phase 11a.
 */
export async function currentOwner(): Promise<Owner | null> {
  const store = await cookies();
  const guestId = decodeGuestCookie(store.get(GUEST_COOKIE)?.value);
  return guestId ? { type: "guest", id: guestId } : null;
}
