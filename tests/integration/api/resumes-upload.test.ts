import { beforeEach, describe, expect, it } from "vitest";

import { POST } from "@/app/api/resumes/route";
import { UPLOAD_LIMITS } from "@/lib/config/limits";
import { uploadRateLimiter } from "@/lib/security/upload-limiter";

import {
  encryptedOfficeContainer,
  minimalDocx,
  minimalPdf,
} from "../../support/documents";

const ENDPOINT = "http://localhost:3000/api/resumes";
const PDF = UPLOAD_LIMITS.mimeTypes.pdf;
const DOCX = UPLOAD_LIMITS.mimeTypes.docx;

function uploadRequest(
  parts: { name: string; type: string; bytes: Buffer }[],
  headers: Record<string, string> = {},
): Request {
  const form = new FormData();
  for (const p of parts) {
    form.append("file", new File([new Uint8Array(p.bytes)], p.name, { type: p.type }));
  }
  return new Request(ENDPOINT, {
    method: "POST",
    body: form,
    headers: { "x-forwarded-for": "203.0.113.10", ...headers },
  });
}

async function call(request: Request) {
  const response = await POST(request);
  return { response, body: await response.json() };
}

beforeEach(() => uploadRateLimiter.reset());

describe("POST /api/resumes — accepted uploads", () => {
  it("accepts a PDF and returns the planned response shape", async () => {
    const { response, body } = await call(
      uploadRequest([{ name: "Jane Doe Resume.pdf", type: PDF, bytes: minimalPdf() }]),
    );
    expect(response.status).toBe(201);
    expect(body.data).toEqual({
      id: expect.stringMatching(/^[0-9a-f]{24}$/),
      fileName: "Jane Doe Resume.pdf",
      extension: "pdf",
      sizeBytes: minimalPdf().length,
      pageCount: null,
      wordCount: null,
      sections: [],
      warnings: [],
    });
  });

  it("accepts a DOCX, including when the browser sends no MIME type", async () => {
    for (const type of [DOCX, ""]) {
      const { response, body } = await call(
        uploadRequest([{ name: "resume.docx", type, bytes: minimalDocx() }]),
      );
      expect(response.status).toBe(201);
      expect(body.data.extension).toBe("docx");
    }
  });

  it("sets a request id and disables caching", async () => {
    const { response } = await call(
      uploadRequest([{ name: "a.pdf", type: PDF, bytes: minimalPdf() }]),
    );
    expect(response.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{36}$/);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("strips path segments and control characters from the file name", async () => {
    const { body } = await call(
      uploadRequest([{ name: "..\\..\\evil\u0007.pdf", type: PDF, bytes: minimalPdf() }]),
    );
    expect(body.data.fileName).toBe("evil.pdf");
  });
});

describe("POST /api/resumes — rejected uploads", () => {
  const cases: {
    title: string;
    part: { name: string; type: string; bytes: Buffer };
    status: number;
    code: string;
  }[] = [
    {
      title: "an unsupported extension",
      part: { name: "resume.txt", type: "text/plain", bytes: Buffer.from("hello") },
      status: 415,
      code: "UNSUPPORTED_TYPE",
    },
    {
      title: "a renamed non-PDF",
      part: { name: "resume.pdf", type: PDF, bytes: Buffer.from("not really a pdf") },
      status: 415,
      code: "UNSUPPORTED_TYPE",
    },
    {
      title: "a ZIP that is not a Word document",
      part: {
        name: "resume.docx",
        type: DOCX,
        bytes: minimalDocx({ withoutDocument: true }),
      },
      status: 415,
      code: "UNSUPPORTED_TYPE",
    },
    {
      title: "a macro-enabled document",
      part: { name: "resume.docx", type: DOCX, bytes: minimalDocx({ macros: true }) },
      status: 415,
      code: "UNSUPPORTED_TYPE",
    },
    {
      title: "a password-protected Word file",
      part: { name: "resume.docx", type: "", bytes: encryptedOfficeContainer() },
      status: 422,
      code: "ENCRYPTED_DOCUMENT",
    },
    {
      title: "a truncated PDF",
      part: { name: "resume.pdf", type: PDF, bytes: minimalPdf({ truncated: true }) },
      status: 422,
      code: "PARSE_FAILED",
    },
    {
      title: "an empty file",
      part: { name: "resume.pdf", type: PDF, bytes: Buffer.alloc(0) },
      status: 422,
      code: "EMPTY_DOCUMENT",
    },
    {
      title: "a file just over the size limit",
      part: {
        name: "resume.pdf",
        type: PDF,
        bytes: Buffer.concat([minimalPdf(), Buffer.alloc(UPLOAD_LIMITS.maxBytes)]),
      },
      status: 413,
      code: "FILE_TOO_LARGE",
    },
  ];

  for (const c of cases) {
    it(`rejects ${c.title} with ${c.status} ${c.code}`, async () => {
      const { response, body } = await call(uploadRequest([c.part]));
      expect(response.status).toBe(c.status);
      expect(body).toEqual({ error: { code: c.code, message: expect.any(String) } });
    });
  }

  it("rejects an oversized body from Content-Length without reading it", async () => {
    const { response, body } = await call(
      new Request(ENDPOINT, {
        method: "POST",
        body: "x",
        headers: {
          "content-type": "multipart/form-data; boundary=x",
          "content-length": String(50 * 1024 * 1024),
        },
      }),
    );
    expect(response.status).toBe(413);
    expect(body.error.code).toBe("FILE_TOO_LARGE");
  });

  it("rejects a body that streams past the limit without a Content-Length", async () => {
    const big = new ReadableStream<Uint8Array>({
      start(controller) {
        const chunk = new Uint8Array(1024 * 1024);
        for (let i = 0; i < 6; i += 1) controller.enqueue(chunk);
        controller.close();
      },
    });
    const { response } = await call(
      new Request(ENDPOINT, {
        method: "POST",
        body: big,
        headers: { "content-type": "multipart/form-data; boundary=x" },
        // @ts-expect-error -- required by Node for streaming request bodies
        duplex: "half",
      }),
    );
    expect(response.status).toBe(413);
  });

  it("rejects a request that is not multipart", async () => {
    const { response, body } = await call(
      new Request(ENDPOINT, {
        method: "POST",
        body: JSON.stringify({ file: "x" }),
        headers: { "content-type": "application/json" },
      }),
    );
    expect(response.status).toBe(400);
    expect(body.error.code).toBe("INVALID_INPUT");
  });

  it("rejects zero files or more than one file", async () => {
    for (const parts of [
      [],
      [
        { name: "a.pdf", type: PDF, bytes: minimalPdf() },
        { name: "b.pdf", type: PDF, bytes: minimalPdf() },
      ],
    ]) {
      const { response, body } = await call(uploadRequest(parts));
      expect(response.status).toBe(400);
      expect(body.error.code).toBe("INVALID_INPUT");
    }
  });

  it("never echoes file contents in error responses", async () => {
    const secret = "SECRET-RESUME-CONTENT-123";
    const { body } = await call(
      uploadRequest([{ name: "resume.pdf", type: PDF, bytes: Buffer.from(secret) }]),
    );
    expect(JSON.stringify(body)).not.toContain(secret);
  });
});

describe("POST /api/resumes — rate limiting", () => {
  it("allows 15 uploads per hour per address, then returns 429 with Retry-After", async () => {
    const part = { name: "a.pdf", type: PDF, bytes: minimalPdf() };
    for (let i = 0; i < 15; i += 1) {
      expect((await POST(uploadRequest([part]))).status).toBe(201);
    }
    const { response, body } = await call(uploadRequest([part]));
    expect(response.status).toBe(429);
    expect(body.error.code).toBe("RATE_LIMITED");
    expect(Number(response.headers.get("retry-after"))).toBeGreaterThan(0);

    // A different address is unaffected.
    const other = await POST(
      uploadRequest([part], { "x-forwarded-for": "198.51.100.99" }),
    );
    expect(other.status).toBe(201);
  });
});
