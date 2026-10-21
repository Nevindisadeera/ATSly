import { describe, expect, it } from "vitest";

import { runAtsEngine } from "@/lib/ats";
import type { Owner } from "@/lib/auth/owner";
import { resumeRepository } from "@/lib/db/repositories/resume-repository";
import { acceptResumeUpload } from "@/lib/services/resume-service";
import { runScanPipeline } from "@/lib/services/scan-pipeline";
import { createScan, getScanForOwner } from "@/lib/services/scan-service";

import { FIXTURES } from "../../fixtures/resumes/fixtures";
import { setupTestDatabase } from "../../support/database";

/**
 * Phase 7b acceptance: the scan pipeline completes on every fixture that parses, and the
 * stored report is exactly what the engine produces for the stored resume.
 */

setupTestDatabase();

const MIME = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

describe.each(FIXTURES.filter((f) => !f.expect.error))("$name ($format)", (fixture) => {
  it("completes a scan with the engine's report", async () => {
    const owner: Owner = { type: "guest", id: crypto.randomUUID() };
    const context = { requestId: "test", owner };
    const upload = await acceptResumeUpload(
      {
        name: `${fixture.name}.${fixture.format}`,
        type: MIME[fixture.format],
        bytes: fixture.load(),
      },
      context,
    );

    const { scanId } = await createScan({ resumeId: upload.id }, context);
    await runScanPipeline(scanId);
    const scan = await getScanForOwner(owner, scanId);

    expect(scan).toMatchObject({ status: "complete", stage: null, error: null });
    const resume = (await resumeRepository.findForOwner(owner, upload.id))!;
    const expected = runAtsEngine({
      parsed: resume.parsed,
      layout: resume.extraction.layout,
      format: resume.file.extension,
      text: resume.extraction.text,
    });
    expect(scan.ats).toEqual(expected);
    expect(scan.summary?.atsScore).toBe(expected.score);
    // Recorded and within the plan's p95 budget (§1: under 25 s); the first scan also loads
    // pdf.js, which is slow on a busy machine, so this isn't a tight performance check.
    expect(scan.durationMs).toBeGreaterThanOrEqual(0);
    expect(scan.durationMs).toBeLessThan(25_000);
  });
});
