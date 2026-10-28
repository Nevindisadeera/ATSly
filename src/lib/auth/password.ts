import "server-only";

import { compare, hash } from "bcryptjs";

/**
 * Password hashing — docs/PLANNING.md §23: bcrypt with cost 12. Tests use the minimum cost
 * so suites stay fast; the hash format is the same.
 */
export const PASSWORD_HASH_COST = process.env.NODE_ENV === "test" ? 4 : 12;

export function hashPassword(password: string): Promise<string> {
  return hash(password, PASSWORD_HASH_COST);
}

// Compared against when the account doesn't exist, so a wrong email takes as long as a
// wrong password and response times don't reveal which emails have accounts.
let unknownAccountHash: Promise<string> | undefined;

export async function verifyPassword(
  password: string,
  passwordHash: string | null,
): Promise<boolean> {
  if (!passwordHash) {
    unknownAccountHash ??= hash("no account has this password", PASSWORD_HASH_COST);
    await compare(password, await unknownAccountHash);
    return false;
  }
  return compare(password, passwordHash);
}
