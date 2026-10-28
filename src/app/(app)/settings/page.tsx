import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Container } from "@/components/layout/container";
import { DangerZone } from "@/components/settings/danger-zone";
import { currentOwner } from "@/lib/auth/current-owner";
import { isAppError } from "@/lib/http/errors";
import { getAccount } from "@/lib/services/account-service";
import { formatDate } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Settings" };

const SIGN_IN = "/login?next=%2Fsettings";

const METHOD_LABELS = { password: "Email and password", google: "Google" } as const;

/** /settings — docs/PLANNING.md §7.6. */
export default async function SettingsPage() {
  const owner = await currentOwner();
  if (owner?.type !== "user") redirect(SIGN_IN);
  const account = await getAccount(owner.id).catch((error: unknown) => {
    if (isAppError(error) && error.code === "UNAUTHENTICATED") return null;
    throw error;
  });
  if (!account) redirect(SIGN_IN);

  const rows = [
    { label: "Name", value: account.name },
    { label: "Email", value: account.email },
    {
      label: "Sign-in method",
      value: account.signInMethods.map((m) => METHOD_LABELS[m]).join(", ") || "—",
    },
    { label: "Member since", value: formatDate(account.createdAt) },
  ];

  return (
    <Container width="reading" className="grid gap-8 py-8 md:py-12">
      <h1 className="type-h2">Settings</h1>

      <section
        aria-labelledby="account-title"
        className="rounded-lg border border-border bg-background p-6"
      >
        <h2 id="account-title" className="type-h4">
          Account
        </h2>
        <dl className="mt-4 divide-y divide-border">
          {rows.map((row) => (
            <div
              key={row.label}
              className="grid gap-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-6"
            >
              <dt className="text-sm text-subtle">{row.label}</dt>
              <dd className="text-sm wrap-break-word text-foreground">{row.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <DangerZone />
    </Container>
  );
}
