import { describe, it, expect } from "vitest";
import { checkUrl } from "../src/tools/checkUrl.js";
import { httpUserAgent, SERVER_VERSION } from "../src/config.js";

describe("check_url", () => {
  it("rejects invalid URL", async () => {
    const r = await checkUrl({ url: "not-a-url" });
    expect(r.status).toBe("FAIL");
  });

  it("probes public URL with status, headers, finalUrl", async () => {
    const r = await checkUrl({ url: "https://example.com", timeoutMs: 15_000 });
    expect(r.status).toBe("PASS");
    expect(r.httpStatus).toBe(200);
    expect(r.finalUrl).toContain("example.com");
    expect(r.headers).toBeTruthy();
    expect(r.contentType).toBeTruthy();
    expect(r.privateHost).toBe(false);
    expect(typeof r.durationMs).toBe("number");
  }, 20_000);

  it("httpUserAgent uses SERVER_VERSION", () => {
    expect(httpUserAgent()).toBe(`local-coding-tools-mcp/${SERVER_VERSION}`);
    expect(SERVER_VERSION).toBe("0.11.2");
  });
});
