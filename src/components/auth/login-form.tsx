"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

import { Button } from "@/components/ui/button";

import { AuthErrorSummary, AuthField } from "./auth-field";
import { signInError, type AuthError, type AuthField as Field } from "./auth-messages";
import { GoogleButton, OrDivider } from "./google-button";

type LoginFormProps = {
  /** Where to go after signing in; already checked to be a path on this site. */
  next: string;
  googleEnabled: boolean;
  /** An error Auth.js redirected back with, e.g. a refused Google sign-in. */
  initialError: AuthError | null;
};

/** Log in — docs/PLANNING.md §7.5. */
export function LoginForm({ next, googleEnabled, initialError }: LoginFormProps) {
  const router = useRouter();
  const id = useId();
  const errorId = `${id}-error`;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<AuthError | null>(initialError);
  const [pending, setPending] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  function fail(problem: AuthError) {
    setError(problem);
    setPending(false);
    // Back to the field to fix, or to the password to try again.
    (problem.field === "email" ? emailRef : passwordRef).current?.focus();
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    if (!email.trim())
      return fail({ message: "Enter your email address.", field: "email" });
    if (!password) return fail({ message: "Enter your password.", field: "password" });

    setPending(true);
    setError(null);
    let result;
    try {
      result = await signIn("credentials", { email, password, redirect: false });
    } catch {
      return fail({ message: "Connection lost. Check your connection and try again." });
    }
    if (result?.error) return fail(signInError(result.code));
    // Stay pending while the next page loads with the new session.
    router.replace(next);
    router.refresh();
  }

  const invalid = (field: Field) => error?.field === field;

  return (
    <div className="grid gap-6">
      {googleEnabled ? (
        <>
          <GoogleButton next={next} disabled={pending} />
          <OrDivider />
        </>
      ) : null}

      <form noValidate onSubmit={submit} className="grid gap-5" aria-label="Log in">
        <AuthErrorSummary id={errorId} error={error} />
        <AuthField
          ref={emailRef}
          id={`${id}-email`}
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={setEmail}
          invalid={invalid("email")}
          errorId={errorId}
        />
        <AuthField
          ref={passwordRef}
          id={`${id}-password`}
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={setPassword}
          invalid={invalid("password")}
          errorId={errorId}
        />
        <Button type="submit" size="lg" className="w-full" loading={pending}>
          {pending ? "Logging in…" : "Log in"}
        </Button>
      </form>

      <p className="text-center text-sm text-subtle">
        New to ATSly?{" "}
        <Link
          href={`/register?next=${encodeURIComponent(next)}`}
          className="rounded-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}
