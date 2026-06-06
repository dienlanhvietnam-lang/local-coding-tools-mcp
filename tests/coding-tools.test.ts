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
    expect(r.totalLines).toBeGreaterThan(0);
  });

  it("returns raw .env content", async () => {
    const r = await readWorkspaceFile({ workspacePath: FIXTURE, relativePath: ".env" });
    expect(r.status).toBe("PASS");
    expect(r.content).toContain("SECRET=leak");
  });

  it("reads a line range with startLine + lineCount", async () => {
    const r = await readWorkspaceFile({
      workspacePath: FIXTURE,
      relativePath: "package.json",
      startLine: 1,
      lineCount: 3,
    });
    expect(r.status).toBe("PASS");
    expect(r.startLine).toBe(1);
    expect(r.endLine).toBe(3);
    expect(r.content!.split("\n").length).toBe(3);
  });

  it("fails clearly when startLine exceeds file length", async () => {
    const r = await readWorkspaceFile({
      workspacePath: FIXTURE,
      relativePath: "package.json",
      startLine: 100000,
      lineCount: 5,
    });
    expect(r.status).toBe("FAIL");
    expect(r.error).toContain("exceeds file length");
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

  it("allows .env write (no path policy)", async () => {
    const envPath = path.join(FIXTURE, ".env");
    const original = fs.readFileSync(envPath, "utf8");
    const r = await writeWorkspaceFile({
      workspacePath: FIXTURE,
      relativePath: ".env",
      content: original,
    });
    expect(r.status).toBe("PASS");
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

  it("attaches a readHint to each match", async () => {
    const r = await searchWorkspace({
      workspacePath: FIXTURE,
      pattern: "fixture-test-project",
    });
    expect(r.status).toBe("PASS");
    expect(r.matches![0]!.readHint).toContain("read_workspace_file startLine=");
    expect(r.matches![0]!.contextLines).toBeTruthy();
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
