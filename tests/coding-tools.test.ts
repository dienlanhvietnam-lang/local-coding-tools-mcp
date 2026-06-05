import { describe, it, expect, afterAll } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import { readWorkspaceFile } from "../src/tools/readWorkspaceFile.js";
import { writeWorkspaceFile } from "../src/tools/writeWorkspaceFile.js";
import { searchWorkspace } from "../src/tools/searchWorkspace.js";
import { listWorkspaceTree } from "../src/tools/listWorkspaceTree.js";
import { runCodingSession } from "../src/tools/runCodingSession.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.resolve(__dirname, "fixtures/sample-project");
const TMP_FILE = "src/__mcp_test_write.txt";

afterAll(() => {
  try {
    fs.unlinkSync(path.join(FIXTURE, TMP_FILE));
  } catch {
    // ignore
  }
});

describe("readWorkspaceFile", () => {
  it("reads package.json", async () => {
    const r = await readWorkspaceFile({ workspacePath: FIXTURE, relativePath: "package.json" });
    expect(r.status).toBe("PASS");
    expect(r.content).toContain("fixture-test-project");
  });

  it("redacts .env", async () => {
    const r = await readWorkspaceFile({ workspacePath: FIXTURE, relativePath: ".env" });
    expect(r.status).toBe("PASS");
    expect(r.content).toContain("[REDACTED]");
    expect(r.content).not.toContain("should-not-appear-in-output");
  });
});

describe("writeWorkspaceFile", () => {
  it("writes file in workspace", async () => {
    const r = await writeWorkspaceFile({
      workspacePath: FIXTURE,
      relativePath: TMP_FILE,
      content: "mcp test",
    });
    expect(r.status).toBe("PASS");
    expect(fs.existsSync(path.join(FIXTURE, TMP_FILE))).toBe(true);
  });

  it("blocks .env write", async () => {
    const r = await writeWorkspaceFile({
      workspacePath: FIXTURE,
      relativePath: ".env",
      content: "hack=1",
    });
    expect(r.status).toBe("BLOCKED");
  });
});

describe("searchWorkspace", () => {
  it("finds pattern in package.json", async () => {
    const r = await searchWorkspace({
      workspacePath: FIXTURE,
      pattern: "fixture-test-project",
    });
    expect(r.status).toBe("PASS");
    expect(r.count).toBeGreaterThan(0);
  });
});

describe("listWorkspaceTree", () => {
  it("lists entries", async () => {
    const r = await listWorkspaceTree({ workspacePath: FIXTURE, maxDepth: 2 });
    expect(r.status).toBe("PASS");
    expect(r.entries?.some((e) => e.path === "package.json")).toBe(true);
  });
});

describe("runCodingSession", () => {
  it("runs batch workflow", async () => {
    const r = await runCodingSession({
      workspacePath: FIXTURE,
      collectBundle: false,
    });
    expect(["PASS", "PARTIAL"]).toContain(r.status);
    expect(r.steps.check_system).toBeTruthy();
    expect(r.steps.list_scripts).toBeTruthy();
  });
});
