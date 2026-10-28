import { z } from "zod";

import { PASSWORD_LIMITS } from "@/lib/config/limits";

/** Account input — docs/PLANNING.md §7.5 and §22. Shared by the forms and the server. */

const email = z
  .string({ error: "Enter your email address." })
  .trim()
  .toLowerCase()
  .max(254, "That email address is too long.")
  .pipe(z.email("Enter a valid email address."));

const utf8Bytes = (value: string) => new TextEncoder().encode(value).length;

const newPassword = z
  .string({ error: "Enter a password." })
  .min(PASSWORD_LIMITS.minChars, `Use at least ${PASSWORD_LIMITS.minChars} characters.`)
  .refine((value) => utf8Bytes(value) <= PASSWORD_LIMITS.maxBytes, {
    message: "That password is too long. Use 72 characters or fewer.",
  });

export const registerSchema = z.strictObject({
  name: z
    .string({ error: "Enter your name." })
    .trim()
    .min(1, "Enter your name.")
    .max(80, "Keep your name under 80 characters."),
  email,
  password: newPassword,
});

export type RegisterInput = z.infer<typeof registerSchema>;

/** Sign-in input. Any password length is accepted here; a wrong one just doesn't match. */
export const credentialsSchema = z.object({
  email,
  password: z.string().min(1).max(1_000),
});

/** Largest accepted register request body. */
export const MAX_REGISTER_BODY_BYTES = 4 * 1024;
