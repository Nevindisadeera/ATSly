import type { Metadata } from "next";

import { AuthCard } from "@/components/auth/auth-card";
import { RegisterForm } from "@/components/auth/register-form";
import { googleSignInEnabled } from "@/lib/auth/auth";
import { hasGuestIdentity } from "@/lib/auth/current-owner";
import { safeNextPath } from "@/lib/auth/redirect";

export const metadata: Metadata = { title: "Create account" };

/** /register — docs/PLANNING.md §7.5. Signed-in visitors are redirected by the proxy. */
export default async function RegisterPage({ searchParams }: PageProps<"/register">) {
  const { next } = await searchParams;
  return (
    <AuthCard
      title="Create your account"
      description="Free. Keep your reports and track your scores over time."
      guestNote={await hasGuestIdentity()}
    >
      <RegisterForm
        next={safeNextPath(Array.isArray(next) ? next[0] : next)}
        googleEnabled={googleSignInEnabled}
      />
    </AuthCard>
  );
}
