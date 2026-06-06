import { describe, it, expect } from "vitest";
import { fetchUrl } from "../src/tools/fetchUrl.js";

describe("fetch_url", () => {
  it("rejects invalid URL", async () => {
    const r = await fetchUrl({ url: "not-a-url" });
    expect(r.status).toBe("FAIL");
  });

  it("fetches public URL with body", async () => {
    const r = await fetchUrl({
      url: "https://example.com",
      timeoutMs: 15_000,
      maxBodyChars: 4096,
    });
    expect(r.status).toBe("PASS");
    expect(r.httpStatus).toBe(200);
    expect(r.body).toBeTruthy();
    expect(typeof r.body).toBe("string");
  }, 20_000);
});
