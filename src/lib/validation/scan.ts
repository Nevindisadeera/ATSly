import { z } from "zod";

/**
 * Body of POST /api/scans — docs/PLANNING.md §22. Job descriptions are accepted from
 * Phase 9a; until then any field other than resumeId is rejected.
 */
export const createScanSchema = z.strictObject({
  resumeId: z
    .string({ error: "resumeId is required." })
    .regex(/^[0-9a-f]{24}$/i, "resumeId must be the id of an uploaded resume."),
});

export type CreateScanInput = z.infer<typeof createScanSchema>;

/** Largest accepted request body; a job description (Phase 9a) is at most 15,000 characters. */
export const MAX_SCAN_BODY_BYTES = 64 * 1024;
