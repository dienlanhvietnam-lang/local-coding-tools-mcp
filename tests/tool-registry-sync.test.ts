import { describe, it, expect } from "vitest";
import { EXPECTED_TOOLS, EXPECTED_TOOL_COUNT } from "../src/toolRegistry.js";
import { EXPECTED_TOOLS as MJS_TOOLS, EXPECTED_TOOL_COUNT as MJS_COUNT } from "../scripts/expected-tools.mjs";

describe("tool registry sync", () => {
  it("toolRegistry.ts matches expected-tools.mjs", () => {
    expect([...EXPECTED_TOOLS]).toEqual([...MJS_TOOLS]);
    expect(EXPECTED_TOOL_COUNT).toBe(MJS_COUNT);
    expect(EXPECTED_TOOL_COUNT).toBe(86);
  });
});
