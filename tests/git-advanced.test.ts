import { describe, it, expect, afterAll } from "vitest";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { gitInit } from "../src/tools/gitInit.js";
import { gitAdd } from "../src/tools/gitAdd.js";
import { gitCommit } from "../src/tools/gitCommit.js";
import { gitBranch, gitCheckout, gitMerge, gitPush } from "../src/tools/gitAdvanced.js";
import { writeWorkspaceFile } from "../src/tools/writeWorkspaceFile.js";

describe("git advanced", () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-git-adv-"));

  afterAll(() => {
    try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  async function repoWithCommit(name: string): Promise<string> {
    const ws = path.join(tmpRoot, name);
    fs.mkdirSync(ws, { recursive: true });
    await gitInit({ workspacePath: ws });
    await writeWorkspaceFile({ workspacePath: ws, relativePath: "a.txt", content: "a" });
    await gitAdd({ workspacePath: ws, paths: ["a.txt"] });
    await gitCommit({ workspacePath: ws, message: "init" });
    return ws;
  }

  it("git_branch lists and creates", async () => {
    const ws = await repoWithCommit("branch-test");
    const created = await gitBranch({ workspacePath: ws, create: "feature-x" });
    expect(created.status).toBe("PASS");
    const list = await gitBranch({ workspacePath: ws });
    expect(list.status).toBe("PASS");
    expect((list.branches as string[]).some((b) => b.includes("feature-x"))).toBe(true);
  });

  it("git_checkout creates and switches", async () => {
    const ws = await repoWithCommit("checkout-test");
    const r = await gitCheckout({ workspacePath: ws, branch: "dev", create: true });
    expect(r.status).toBe("PASS");
  });

  it("git_merge same branch is up to date", async () => {
    const ws = await repoWithCommit("merge-test");
    await gitCheckout({ workspacePath: ws, branch: "feature", create: true });
    const r = await gitMerge({ workspacePath: ws, branch: "feature" });
    expect(r.status).toBe("PASS");
  });

  it("git_push SKIPPED when not a repo", async () => {
    const ws = path.join(tmpRoot, "no-repo");
    fs.mkdirSync(ws, { recursive: true });
    const r = await gitPush({ workspacePath: ws });
    expect(r.status).toBe("SKIPPED");
  });

  it("git_branch rejects invalid name", async () => {
    const ws = await repoWithCommit("invalid-branch");
    const r = await gitBranch({ workspacePath: ws, create: "--evil; rm" });
    expect(r.status).toBe("FAIL");
  });
});
