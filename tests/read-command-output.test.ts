import path from "node:path";
import { describe, expect, it } from "vitest";
import { saveCommandOutput } from "../src/utils/commandOutputStore.js";
import { readCommandOutput } from "../src/tools/readCommandOutput.js";
const FIXTURE = path.resolve("tests/fixtures/sample-project");

describe("read_command_output", () => {
  it("reads saved command output by outputId", async () => {
    const longStdout = Array.from({ length: 120 }, (_, i) => `line-${i + 1}`).join("\n");
    const saved = saveCommandOutput({
      workspacePath: FIXTURE,
      tool: "run_project_script",
      script: "test",
      exitCode: 0,
      truncated: true,
      stdout: longStdout,
      stderr: "err-tail",
    });

    const read = await readCommandOutput({
      workspacePath: FIXTURE,
      source: "output",
      outputId: saved.id,
      stream: "stdout",
      startLine: 100,
      lineCount: 20,
      maxChars: 50_000,
    });

    expect(read.status).toBe("PASS");
    expect(read.content).toContain("line-100");
    expect(read.content).toContain("line-119");
    expect(read.outputId).toBe(saved.id);
  });

  it("reads last saved output via source=last", async () => {
    const read = await readCommandOutput({
      workspacePath: FIXTURE,
      source: "last",
      stream: "both",
      maxChars: 50_000,
    });
    expect(read.status).toBe("PASS");
    expect(read.content).toContain("line-");
  });
});
