import { describe, expect, it } from "vitest";

import {
  loginPageError,
  passwordHint,
  registerError,
  signInError,
} from "@/components/auth/auth-messages";

describe("sign-in errors", () => {
  it("says what went wrong without revealing which part", () => {
    expect(signInError("credentials").message).toBe("Email or password is incorrect.");
    expect(signInError("rate_limited").message).toMatch(/^Too many sign-in attempts/);
    expect(signInError(undefined).message).toBe(
      "We couldn't sign you in. Please try again.",
    );
  });

  it("explains errors Auth.js redirects back with", () => {
    expect(loginPageError(undefined, undefined)).toBeNull();
    expect(loginPageError("CredentialsSignin", "credentials")!.message).toBe(
      "Email or password is incorrect.",
    );
    expect(loginPageError("AccessDenied", undefined)!.message).toMatch(/verified email/);
    expect(loginPageError("Configuration", undefined)!.message).toMatch(
      /isn't available/,
    );
    expect(loginPageError("Whatever", undefined)!.message).toMatch(
      /couldn't sign you in/,
    );
  });
});

describe("register errors", () => {
  const failure = { ok: false as const, status: 400 };

  it("offers to log in when the email is taken", () => {
    expect(registerError({ ...failure, code: "EMAIL_TAKEN" }, "/results/abc")).toEqual({
      message: "An account with this email already exists.",
      field: "email",
      link: { href: "/login?next=%2Fresults%2Fabc", label: "Log in instead" },
    });
  });

  it("keeps the server's message and field for invalid input", () => {
    expect(
      registerError(
        {
          ...failure,
          code: "INVALID_INPUT",
          message: "Use at least 8 characters.",
          field: "password",
        },
        "/dashboard",
      ),
    ).toEqual({ message: "Use at least 8 characters.", field: "password" });
    expect(
      registerError({ ...failure, code: "INVALID_INPUT", field: "admin" }, "/dashboard")
        .field,
    ).toBeUndefined();
  });

  it("covers limits, outages and the unexpected", () => {
    expect(registerError({ ...failure, code: "RATE_LIMITED" }, "/").message).toMatch(
      /Too many sign-ups/,
    );
    expect(registerError({ ...failure, code: "NETWORK_ERROR" }, "/").message).toMatch(
      /^Connection lost/,
    );
    expect(
      registerError({ ...failure, code: "INTERNAL", requestId: "req-1" }, "/").message,
    ).toContain("Reference: req-1");
  });
});

describe("passwordHint", () => {
  it("counts toward the minimum, then encourages length", () => {
    expect(passwordHint("")).toBe("At least 8 characters.");
    expect(passwordHint("abcdefg")).toBe("1 more character.");
    expect(passwordHint("abc")).toBe("5 more characters.");
    expect(passwordHint("abcdefgh")).toMatch(/^Long enough/);
    expect(passwordHint("correct horse battery")).toBe("Good length.");
  });
});
