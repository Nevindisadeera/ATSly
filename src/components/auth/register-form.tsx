"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

import { Button } from "@/components/ui/button";
import { registerAccount } from "@/lib/client/auth";
import { registerSchema } from "@/lib/validation/auth";

import { AuthErrorSummary, AuthField } from "./auth-field";
import {
  passwordHint,
  registerError,
  type AuthError,
  type AuthField as Field,
} from "./auth-messages";
import { GoogleButton, OrDivider } from "./google-button";

const linkClass =
  "rounded-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

/** Create account — docs/PLANNING.md §7.5. Signs in straight after, which claims guest data. */
export function RegisterForm({
  next,
  googleEnabled,
}: {
  next: string;
  googleEnabled: boolean;
}) {
  const router = useRouter();
  const id = useId();
  const errorId = `${id}-error`;
  const [values, setValues] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState<AuthError | null>(null);
  const [pending, setPending] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const set = (field: Field) => (value: string) =>
    setValues((current) => ({ ...current, [field]: value }));

  function fail(problem: AuthError) {
    setError(problem);
    setPending(false);
    const target = { name: nameRef, email: emailRef, password: passwordRef };
    if (problem.field) target[problem.field].current?.focus();
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    const input = registerSchema.safeParse(values);
    if (!input.success) {
      const issue = input.error.issues[0]!;
      return fail({ message: issue.message, field: issue.path[0] as Field });
    }

    setPending(true);
    setError(null);
    const created = await registerAccount(input.data);
    if (!created.ok) return fail(registerError(created, next));

    let result;
    try {
      result = await signIn("credentials", {
        email: input.data.email,
        password: input.data.password,
        redirect: false,
      });
    } catch {
      result = null;
    }
    if (!result || result.error) {
      // The account exists; only signing in failed, so send them to log in.
      router.replace(`/login?next=${encodeURIComponent(next)}`);
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <div className="grid gap-6">
      {googleEnabled ? (
        <>
          <GoogleButton next={next} disabled={pending} />
          <OrDivider />
        </>
      ) : null}

      <form
        noValidate
        onSubmit={submit}
        className="grid gap-5"
        aria-label="Create account"
      >
        <AuthErrorSummary id={errorId} error={error} />
        <AuthField
          ref={nameRef}
          id={`${id}-name`}
          label="Name"
          autoComplete="name"
          value={values.name}
          onChange={set("name")}
          invalid={error?.field === "name"}
          errorId={errorId}
        />
        <AuthField
          ref={emailRef}
          id={`${id}-email`}
          label="Email"
          type="email"
          autoComplete="email"
          value={values.email}
          onChange={set("email")}
          invalid={error?.field === "email"}
          errorId={errorId}
        />
        <AuthField
          ref={passwordRef}
          id={`${id}-password`}
          label="Password"
          type="password"
          autoComplete="new-password"
          value={values.password}
          onChange={set("password")}
          hint={passwordHint(values.password)}
          invalid={error?.field === "password"}
          errorId={errorId}
        />
        <p className="text-xs leading-5 text-subtle">
          By creating an account you agree to the{" "}
          <Link href="/terms" className={linkClass}>
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className={linkClass}>
            Privacy Policy
          </Link>
          .
        </p>
        <Button type="submit" size="lg" className="w-full" loading={pending}>
          {pending ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <p className="text-center text-sm text-subtle">
        Already have an account?{" "}
        <Link href={`/login?next=${encodeURIComponent(next)}`} className={linkClass}>
          Log in
        </Link>
      </p>
    </div>
  );
}
