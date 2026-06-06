import { describe, it, expect, vi, afterEach } from "vitest";
import { truncateStructured } from "../src/utils/truncateStructured.js";
import { stripContextBlocks } from "../src/utils/contextStrip.js";

describe("truncateStructured", () => {
  it("returns text unchanged when under the limit", () => {
    const r = truncateStructured("hello", 100);
    expect(r.truncated).toBe(false);
    expect(r.text).toBe("hello");
    expect(r.originalChars).toBe(5);
    expect(r.returnedChars).toBe(5);
    expect(r.hint).toBeUndefined();
  });

  it("head mode keeps the beginning and marks truncation", () => {
    const input = "a".repeat(500);
    const r = truncateStructured(input, 100, { mode: "head" });
    expect(r.truncated).toBe(true);
    expect(r.text.startsWith("a".repeat(100))).toBe(true);
    expect(r.text).toContain("truncated 400 chars");
    expect(r.hint).toBeTruthy();
  });

  it("head_tail mode keeps both ends", () => {
    const input = "HEAD" + "x".repeat(1000) + "TAIL";
    const r = truncateStructured(input, 300, { mode: "head_tail" });
    expect(r.truncated).toBe(true);
    expect(r.text.startsWith("HEAD")).toBe(true);
    expect(r.text.endsWith("TAIL")).toBe(true);
    expect(r.text).toContain("truncated");
  });

  it("uses a custom hint when provided", () => {
    const r = truncateStructured("z".repeat(50), 10, { hint: "custom hint" });
    expect(r.hint).toBe("custom hint");
  });

  it("treats maxChars <= 0 as no truncation", () => {
    const r = truncateStructured("data", 0);
    expect(r.truncated).toBe(false);
    expect(r.text).toBe("data");
  });
});

describe("stripContextBlocks", () => {
  it("removes known context blocks", () => {
    const input =
      "keep this\n<git_status>lots of noise</git_status>\n<user_rules>more</user_rules>\nkeep too";
    const out = stripContextBlocks(input);
    expect(out).toContain("keep this");
    expect(out).toContain("keep too");
    expect(out).not.toContain("git_status");
    expect(out).not.toContain("user_rules");
  });

  it("leaves text without context blocks unchanged in substance", () => {
    const input = "function foo() { return 1; }";
    expect(stripContextBlocks(input)).toBe(input);
  });

  it("collapses excessive blank lines after stripping", () => {
    const input = "a\n<rules>x</rules>\n\n\n\nb";
    const out = stripContextBlocks(input);
    expect(out).not.toMatch(/\n{3,}/);
  });
});

describe("config env overrides", () => {
  afterEach(() => {
    delete process.env.MCP_MAX_OUTPUT_CHARS;
    delete process.env.MCP_READ_DEFAULT_LINES;
    vi.resetModules();
  });

  it("MCP_MAX_OUTPUT_CHARS overrides the default", async () => {
    process.env.MCP_MAX_OUTPUT_CHARS = "1234";
    vi.resetModules();
    const mod = await import("../src/config.js");
    expect(mod.MAX_OUTPUT_CHARS).toBe(1234);
  });

  it("invalid env value falls back to default", async () => {
    process.env.MCP_READ_DEFAULT_LINES = "not-a-number";
    vi.resetModules();
    const mod = await import("../src/config.js");
    expect(mod.READ_DEFAULT_LINES).toBe(80);
  });
});
