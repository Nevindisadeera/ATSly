import { describe, expect, it } from "vitest";

import { readJsonBody } from "@/lib/http/body";

describe("readJsonBody", () => {
  const request = (body: string, contentType = "application/json") =>
    new Request("http://localhost/api", {
      method: "POST",
      body,
      headers: { "content-type": contentType },
    });

  it("parses JSON within the limit", async () => {
    await expect(readJsonBody(request('{"a":1}'), 100)).resolves.toEqual({ a: 1 });
    await expect(
      readJsonBody(request("[]", "application/json; charset=utf-8"), 100),
    ).resolves.toEqual([]);
  });

  it("rejects other content types, oversized bodies and invalid JSON", async () => {
    await expect(readJsonBody(request("{}", "text/plain"), 100)).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
    await expect(
      readJsonBody(request(`"${"x".repeat(200)}"`), 100),
    ).rejects.toMatchObject({
      code: "INVALID_INPUT",
      message: "The request body is too large.",
    });
    await expect(readJsonBody(request("{"), 100)).rejects.toMatchObject({
      message: "The request body is not valid JSON.",
    });
  });
});
