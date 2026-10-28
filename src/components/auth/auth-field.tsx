"use client";

import { useState, type Ref } from "react";
import Link from "next/link";
import { CircleAlert, Eye, EyeOff } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import type { AuthError } from "./auth-messages";

type AuthFieldProps = {
  id: string;
  label: string;
  type?: "text" | "email" | "password";
  autoComplete: string;
  value: string;
  onChange: (value: string) => void;
  /** Muted guidance under the input, e.g. the password length hint. */
  hint?: string;
  /** The field has the current error; the summary above describes it. */
  invalid?: boolean;
  /** Id of the error summary, so a screen reader hears the error with the field. */
  errorId?: string;
  disabled?: boolean;
  ref?: Ref<HTMLInputElement>;
};

/** A labelled input with an optional hint. Passwords get a show/hide toggle. */
export function AuthField({
  id,
  label,
  type = "text",
  autoComplete,
  value,
  onChange,
  hint,
  invalid,
  errorId,
  disabled,
  ref,
}: AuthFieldProps) {
  const [visible, setVisible] = useState(false);
  const isPassword = type === "password";
  const describedBy = [invalid ? errorId : null, hint ? `${id}-hint` : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          ref={ref}
          id={id}
          name={id}
          type={isPassword && visible ? "text" : type}
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy || undefined}
          disabled={disabled}
          spellCheck={false}
          className={isPassword ? "pr-12" : undefined}
        />
        {isPassword ? (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-pressed={visible}
            aria-label="Show password"
            disabled={disabled}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            {visible ? (
              <EyeOff aria-hidden="true" className="size-4" />
            ) : (
              <Eye aria-hidden="true" className="size-4" />
            )}
          </button>
        ) : null}
      </div>
      {hint ? (
        <p id={`${id}-hint`} className="text-xs leading-5 text-subtle">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** The error summary above the fields — §7.5. Announced when it appears. */
export function AuthErrorSummary({ id, error }: { id: string; error: AuthError | null }) {
  return (
    <div role="alert" id={id} className={error ? undefined : "sr-only"}>
      {error ? (
        <div className="flex gap-2.5 rounded-md border border-danger/30 bg-danger-soft px-4 py-3 text-sm leading-6">
          <CircleAlert aria-hidden="true" className="mt-1 size-4 shrink-0 text-danger" />
          <p className="text-danger-strong">
            {error.message}
            {error.link ? (
              <>
                {" "}
                <Link
                  href={error.link.href}
                  className="rounded-sm font-medium text-foreground underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {error.link.label}
                </Link>
              </>
            ) : null}
          </p>
        </div>
      ) : null}
    </div>
  );
}
