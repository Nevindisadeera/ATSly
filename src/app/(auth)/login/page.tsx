import type { Metadata } from "next";

import { AuthCard } from "@/components/auth/auth-card";
import { loginPageError } from "@/components/auth/auth-messages";
import { LoginForm } from "@/components/auth/login-form";
import { googleSignInEnabled } from "@/lib/auth/auth";
import { hasGuestIdentity } from "@/lib/auth/current-owner";
import { safeNextPath } from "@/lib/auth/redirect";

export const metadata: Metadata = { title: "Log in" };

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

/** /login — docs/PLANNING.md §7.5. Signed-in visitors are redirected by the proxy. */
export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  return (
    <AuthCard
      title="Log in"
      description="Your reports, saved in one place."
      guestNote={await hasGuestIdentity()}
    >
      <LoginForm
        next={safeNextPath(first(params.next))}
        googleEnabled={googleSignInEnabled}
        initialError={loginPageError(first(params.error), first(params.code))}
      />
    </AuthCard>
  );
}
