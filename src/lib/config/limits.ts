/**
 * Upload limits shared by the browser and the server — docs/PLANNING.md §23.
 * 4 MB stays under Vercel's 4.5 MB request body limit.
 */
export const UPLOAD_LIMITS = {
  maxBytes: 4 * 1024 * 1024,
  maxPages: 10,
  extensions: ["pdf", "docx"] as const,
  mimeTypes: {
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
} as const;

export type UploadExtension = (typeof UPLOAD_LIMITS.extensions)[number];

/**
 * Job description length — docs/PLANNING.md §7.2 and §22. Below the minimum the step counts
 * as skipped; above the maximum the server rejects it.
 */
export const JOB_DESCRIPTION_LIMITS = {
  minChars: 100,
  maxChars: 15_000,
  /** From this length the input says the posting looks complete (§5, state 13). */
  completeChars: 600,
} as const;

/** Value for an <input type="file" accept> attribute. */
export const UPLOAD_ACCEPT = [
  ".pdf",
  ".docx",
  UPLOAD_LIMITS.mimeTypes.pdf,
  UPLOAD_LIMITS.mimeTypes.docx,
].join(",");

/**
 * Account limits — docs/PLANNING.md §7.5 and §23. Passwords are capped at 72 bytes, the
 * most bcrypt reads; longer ones would be silently truncated.
 */
export const PASSWORD_LIMITS = { minChars: 8, maxBytes: 72 } as const;

/** Sign-up and sign-in attempts allowed per window — §23. */
export const AUTH_RATE_LIMITS = {
  registerPerIpPerHour: 5,
  loginPerEmailPer15Min: 10,
  loginPerIpPer15Min: 30,
} as const;
