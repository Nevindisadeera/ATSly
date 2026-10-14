/**
 * Who owns a piece of data — docs/PLANNING.md §16. Every user-data document carries an
 * owner, and every repository query is scoped by it. Guests become users at sign-up
 * (Phase 11a) by re-owning their documents.
 */
export type Owner = { type: "guest" | "user"; id: string };

export function sameOwner(a: Owner, b: Owner): boolean {
  return a.type === b.type && a.id === b.id;
}
