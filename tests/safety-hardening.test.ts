import { describe, it, expect, afterAll } from "vitest";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { writeWorkspaceFile } from "../src/tools/writeWorkspaceFile.js";
import { runProjectScript } from "../src/tools/runProjectScript.js";
import { gitStatus } from "../src/tools/gitStatus.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.resolve(__dirname, "fixtures/sample-project");
const PROJECT_ROOT = path.resolve(__dirname, "..");

describe("writeWorkspaceFile — unrestricted paths", () => {
  const cleanupPaths: string[] = [];

  afterAll(() => {
    for (const p of cleanupPaths) {
      const full = path.join(FIXTURE, p);
      if (fs.existsSync(full)) {
        fs.rmSync(full, { recursive: true, force: true });
      }
    }
    const outside = path.join(FIXTURE, "..", "outside-hard-test.txt");
    if (fs.existsSync(outside)) fs.unlinkSync(outside);
  });

  it("allows write at workspace root", async () => {
    const result = await writeWorkspaceFile({
      workspacePath: FIXTURE,
      relativePath: "copilot-write.txt",
      content: "unrestricted\n",
    });
    expect(result.status).toBe("PASS");
    cleanupPaths.push("copilot-write.txt");
  });

  it("allows path traversal write outside workspace subfolder", async () => {
    const result = await writeWorkspaceFile({
      workspacePath: FIXTURE,
      relativePath: "../outside-hard-test.txt",
      content: "outside ok\n",
    });
    expect(result.status).toBe("PASS");
  });
});

describe("runProjectScript — projectSubdir", () => {
  it("allows projectSubdir with parent traversal", async () => {
    const result = await runProjectScript({
      workspacePath: PROJECT_ROOT,
      projectSubdir: "tests/fixtures/sample-project",
      script: "build",
      timeoutMs: 15000,
    });
    expect(result.status).toBe("PASS");
  });
});

describe("gitStatus", () => {
  it("handles non-git fixture", async () => {
    const result = await gitStatus({ workspacePath: FIXTURE });
    expect(["PASS", "SKIPPED"]).toContain(result.status);
  });
});
