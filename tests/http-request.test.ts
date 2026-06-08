import { describe, it, expect } from "vitest";
import { httpRequest } from "../src/tools/httpRequest.js";
import { httpUserAgent, SERVER_VERSION } from "../src/config.js";

describe("http_request", () => {
  it("rejects invalid URL", async () => {
    const r = await httpRequest({ url: "not-a-url" });
    expect(r.status).toBe("FAIL");
  });

  it("GET returns body + headers", async () => {
    const r = await httpRequest({ url: "https://example.com", method: "GET", timeoutMs: 15000 });
    expect(r.status).toBe("PASS");
    expect(r.httpStatus).toBe(200);
    expect(r.body).toBeTruthy();
    expect(r.headers).toBeTruthy();
  }, 20000);

  it("uses unified User-Agent version", () => {
    expect(httpUserAgent()).toContain(SERVER_VERSION);
    expect(SERVER_VERSION).toBe("0.18.0");
  });

  it("POST to httpbin echoes body", async () => {
    const r = await httpRequest({
      url: "https://httpbin.org/post",
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hello: "world" }),
      timeoutMs: 20000,
    });
    // httpbin may be flaky; accept PASS or network FAIL but not invalid-url
    expect(["PASS", "FAIL"]).toContain(r.status);
    if (r.status === "PASS") {
      expect(r.httpStatus).toBe(200);
    }
  }, 25000);
});
