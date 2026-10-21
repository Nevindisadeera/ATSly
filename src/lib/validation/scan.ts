import { z } from "zod";

/** Job description length limits — docs/PLANNING.md §7.2 and §22. */
export const JOB_DESCRIPTION_LIMITS = { minChars: 100, maxChars: 15_000 } as const;

const optionalLabel = z
  .string()
  .trim()
  .max(120, "Keep the job title and company under 120 characters.")
  .optional();

export const jobDescriptionSchema = z.strictObject({
  text: z
    .string({ error: "jobDescription.text is required." })
    .trim()
    .min(
      JOB_DESCRIPTION_LIMITS.minChars,
      `Add at least ${JOB_DESCRIPTION_LIMITS.minChars} characters of the job description.`,
    )
    .max(
      JOB_DESCRIPTION_LIMITS.maxChars,
      `Job descriptions can be up to ${JOB_DESCRIPTION_LIMITS.maxChars.toLocaleString("en-US")} characters.`,
    ),
  title: optionalLabel,
  company: optionalLabel,
});

/** Body of POST /api/scans — docs/PLANNING.md §22. */
export const createScanSchema = z.strictObject({
  resumeId: z
    .string({ error: "resumeId is required." })
    .regex(/^[0-9a-f]{24}$/i, "resumeId must be the id of an uploaded resume."),
  jobDescription: jobDescriptionSchema.optional(),
});

export type CreateScanInput = z.infer<typeof createScanSchema>;

/** Largest accepted request body: a 15,000-character job description fits with room to spare. */
export const MAX_SCAN_BODY_BYTES = 64 * 1024;
