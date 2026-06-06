import { describe, it, expect } from "vitest";
import { fetchUrl } from "../src/tools/fetchUrl.js";
import { DEFAULT_FETCH_MAX_BODY } from "../src/config.js";

describe("fetch_url", () => {
  it("rejects invalid URL", async () => {
    const r = await fetchUrl({ url: "not-a-url" });
    expect(r.status).toBe("FAIL");
  });

  it("default max body is 256KB", () => {
    expect(DEFAULT_FETCH_MAX_BODY).toBe(262_144);
  });

  it("fetches public URL with body, headers, privateHost", async () => {
    const r = await fetchUrl({
      url: "https://example.com",
      timeoutMs: 15_000,
      maxBodyChars: 4096,
    });
    expect(r.status).toBe("PASS");
    expect(r.httpStatus).toBe(200);
    expect(r.body).toBeTruthy();
    expect(typeof r.body).toBe("string");
    expect(r.headers).toBeTruthy();
    expect(r.privateHost).toBe(false);
  }, 20_000);
});
