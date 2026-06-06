import { describe, it, expect, afterAll } from "vitest";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { gitInit } from "../src/tools/gitInit.js";
import { gitAdd } from "../src/tools/gitAdd.js";
import { gitCommit } from "../src/tools/gitCommit.js";
import { writeWorkspaceFile } from "../src/tools/writeWorkspaceFile.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("git write ops", () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-git-write-"));

  afterAll(() => {
    try {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it("git_init creates repository", async () => {
    const ws = path.join(tmpRoot, "init-test");
    fs.mkdirSync(ws, { recursive: true });

    const r = await gitInit({ workspacePath: ws });
    expect(r.status).toBe("PASS");
    expect(fs.existsSync(path.join(ws, ".git"))).toBe(true);
  });

  it("git_init skips existing repo", async () => {
    const ws = path.join(tmpRoot, "init-skip");
    fs.mkdirSync(ws, { recursive: true });
    await gitInit({ workspacePath: ws });

    const r = await gitInit({ workspacePath: ws });
    expect(r.status).toBe("SKIPPED");
  });

  it("git_add and git_commit work", async () => {
    const ws = path.join(tmpRoot, "commit-test");
    fs.mkdirSync(ws, { recursive: true });
    await gitInit({ workspacePath: ws });

    await writeWorkspaceFile({
      workspacePath: ws,
      relativePath: "hello.txt",
      content: "hello git",
    });

    const add = await gitAdd({ workspacePath: ws, paths: ["hello.txt"] });
    expect(add.status).toBe("PASS");

    const commit = await gitCommit({
      workspacePath: ws,
      message: "test commit from mcp",
    });
    expect(commit.status).toBe("PASS");
  });
});
