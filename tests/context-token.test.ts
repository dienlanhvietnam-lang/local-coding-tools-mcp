import { describe, it, expect } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { estimateTokens, breakdownByCategory } from "../src/utils/tokenEstimate.js";
import { estimateToolOutput } from "../src/tools/estimateToolOutput.js";
import { summarizeToolHistory } from "../src/tools/summarizeToolHistory.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.resolve(__dirname, "fixtures/sample-project");

describe("tokenEstimate", () => {
  it("estimates ~4 chars per token", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("a".repeat(400))).toBe(100);
  });

  it("breaks payload into sorted categories", () => {
    const cats = breakdownByCategory({ small: "x", big: "y".repeat(1000) });
    expect(cats[0]!.id).toBe("big");
    expect(cats[0]!.estimatedTokens).toBeGreaterThan(cats[1]!.estimatedTokens);
  });
});

describe("estimate_tool_output tool", () => {
  it("estimates read_workspace_file cost", async () => {
    const r = await estimateToolOutput({
      workspacePath: FIXTURE,
      toolName: "read_workspace_file",
      relativePath: "package.json",
    });
    expect(r.status).toBe("PASS");
    expect(r.estimatedTokens).toBeGreaterThan(0);
    expect(r.recommendation).toBeTruthy();
  });

  it("requires relativePath for read_workspace_file", async () => {
    const r = await estimateToolOutput({
      workspacePath: FIXTURE,
      toolName: "read_workspace_file",
    });
    expect(r.status).toBe("FAIL");
  });

  it("returns generic guidance for other tools", async () => {
    const r = await estimateToolOutput({
      workspacePath: FIXTURE,
      toolName: "run_safe_command",
    });
    expect(r.status).toBe("PASS");
    expect(r.estimatedTokens).toBeNull();
  });
});

describe("summarize_tool_history tool", () => {
  it("returns a summary structure", async () => {
    const r = await summarizeToolHistory({ workspacePath: FIXTURE, limit: 5 });
    expect(r.status).toBe("PASS");
    expect(r.byTool).toBeTruthy();
    expect(Array.isArray(r.recent)).toBe(true);
  });
});
