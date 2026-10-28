import { Info } from "lucide-react";

import { GUEST_CLAIM_NOTE } from "./auth-messages";

/** The card around the login and register forms, with the guest-claim note when it applies. */
export function AuthCard({
  title,
  description,
  guestNote,
  children,
}: {
  title: string;
  description: string;
  /** This browser has guest reports that signing in will keep (§7.5). */
  guestNote: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-background p-6 shadow-card sm:p-8">
      <h1 className="type-h3">{title}</h1>
      <p className="mt-2 text-sm leading-6 text-subtle">{description}</p>
      {guestNote ? (
        <p className="mt-5 flex gap-2.5 rounded-md bg-soft px-3.5 py-2.5 text-sm leading-6 text-body">
          <Info
            aria-hidden="true"
            className="mt-1 size-4 shrink-0 text-muted-foreground"
          />
          {GUEST_CLAIM_NOTE}
        </p>
      ) : null}
      <div className="mt-6">{children}</div>
    </div>
  );
}
