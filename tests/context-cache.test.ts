import { describe, it, expect, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  storeLargeOutput,
  readCache,
  readCacheFromWorkspace,
  parseCacheId,
  CACHE_URI_SCHEME,
} from "../src/cache/outputCache.js";
import { fetchCachedOutput } from "../src/tools/fetchCachedOutput.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.resolve(__dirname, "fixtures/sample-project");

afterAll(() => {
  const cacheDir = path.join(FIXTURE, ".mcp-debug", "cache");
  try {
    fs.rmSync(cacheDir, { recursive: true, force: true });
  } catch {
    // ignore
  }
});

describe("outputCache", () => {
  it("stores a payload and returns a usable reference", () => {
    const payload = JSON.stringify({ big: "x".repeat(5000) });
    const stored = storeLargeOutput(FIXTURE, payload, { toolName: "test" });
    expect(stored.id).toMatch(/[0-9a-fA-F-]{36}/);
    expect(stored.uri.startsWith(`${CACHE_URI_SCHEME}://`)).toBe(true);
    expect(stored.preview.length).toBeLessThan(payload.length);
    expect(stored.originalChars).toBe(payload.length);
  });

  it("reads back from the in-memory registry", () => {
    const stored = storeLargeOutput(FIXTURE, "hello cache", { toolName: "test" });
    const got = readCache(stored.id);
    expect(got?.content).toBe("hello cache");
    expect(got?.meta.toolName).toBe("test");
  });

  it("reads back directly from the workspace cache dir", () => {
    const stored = storeLargeOutput(FIXTURE, "from disk", { toolName: "test" });
    const got = readCacheFromWorkspace(FIXTURE, stored.id);
    expect(got).toBe("from disk");
  });

  it("parses an id from a cache URI", () => {
    expect(parseCacheId(`${CACHE_URI_SCHEME}://abc-123`)).toBe("abc-123");
    expect(parseCacheId("file://x")).toBeNull();
  });
});

describe("fetch_cached_output tool", () => {
  it("returns stored content", async () => {
    const stored = storeLargeOutput(FIXTURE, "tool content here", { toolName: "test" });
    const r = await fetchCachedOutput({ workspacePath: FIXTURE, cacheId: stored.id });
    expect(r.status).toBe("PASS");
    expect(r.content).toContain("tool content here");
  });

  it("fails when cache id is unknown", async () => {
    const r = await fetchCachedOutput({
      workspacePath: FIXTURE,
      cacheId: "00000000-0000-0000-0000-000000000000",
    });
    expect(r.status).toBe("FAIL");
  });
});
