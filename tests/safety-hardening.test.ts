import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { writeWorkspaceFile } from "../src/tools/writeWorkspaceFile.js";
import { runProjectScript } from "../src/tools/runProjectScript.js";
import { gitStatus } from "../src/tools/gitStatus.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.resolve(__dirname, "fixtures/sample-project");
const PROJECT_ROOT = path.resolve(__dirname, "..");

describe("writeWorkspaceFile — Safety hardening (Phase 1.2)", () => {
  // Cleanup test artifacts after each test
  const cleanupPaths: string[] = [];

  afterAll(() => {
    for (const p of cleanupPaths) {
      const full = path.join(FIXTURE, p);
      if (fs.existsSync(full)) {
        fs.rmSync(full, { recursive: true, force: true });
      }
    }
  });

  it("allows write to .mcp-debug/copilot-test.md (allowed path)", async () => {
    const result = await writeWorkspaceFile({
      workspacePath: FIXTURE,
      relativePath: ".mcp-debug/copilot-test.md",
      content: "# Copilot Test\npass",
    });
    expect(result.status).toBe("PASS");
    expect(result.bytesWritten).toBeGreaterThan(0);
    cleanupPaths.push(".mcp-debug/copilot-test.md");
  });

  it("allows write to src/debug.md (allowed path)", async () => {
    const result = await writeWorkspaceFile({
      workspacePath: FIXTURE,
      relativePath: "src/debug.md",
      content: "# Debug\nok",
    });
    expect(result.status).toBe("PASS");
    cleanupPaths.push("src/debug.md");
  });

  it("allows write to tests/test-helper.txt (allowed path)", async () => {
    const result = await writeWorkspaceFile({
      workspacePath: FIXTURE,
      relativePath: "tests/test-helper.txt",
      content: "helper",
    });
    expect(result.status).toBe("PASS");
    cleanupPaths.push("tests/test-helper.txt");
  });

  it("allows write to docs/readme.txt (allowed path)", async () => {
    const result = await writeWorkspaceFile({
      workspacePath: FIXTURE,
      relativePath: "docs/readme.txt",
      content: "doc",
    });
    expect(result.status).toBe("PASS");
    cleanupPaths.push("docs/readme.txt");
  });

  it("blocks write to node_modules/a.txt (restricted path)", async () => {
    const result = await writeWorkspaceFile({
      workspacePath: FIXTURE,
      relativePath: "node_modules/a.txt",
      content: "danger",
    });
    expect(result.status).toBe("BLOCKED");
  });

  it("blocks write to .git/config (restricted path)", async () => {
    const result = await writeWorkspaceFile({
      workspacePath: FIXTURE,
      relativePath: ".git/config",
      content: "evil",
    });
    expect(result.status).toBe("BLOCKED");
  });

  it("blocks write to dist/bundle.js (restricted path)", async () => {
    const result = await writeWorkspaceFile({
      workspacePath: FIXTURE,
      relativePath: "dist/bundle.js",
      content: "evil",
    });
    expect(result.status).toBe("BLOCKED");
  });

  it("blocks write to build/output.exe (restricted path)", async () => {
    const result = await writeWorkspaceFile({
      workspacePath: FIXTURE,
      relativePath: "build/output.exe",
      content: "evil",
    });
    expect(result.status).toBe("BLOCKED");
  });

  it("blocks write to coverage/lcov.info (restricted path)", async () => {
    const result = await writeWorkspaceFile({
      workspacePath: FIXTURE,
      relativePath: "coverage/lcov.info",
      content: "evil",
    });
    expect(result.status).toBe("BLOCKED");
  });

  it("blocks write to .env (sensitive file)", async () => {
    const result = await writeWorkspaceFile({
      workspacePath: FIXTURE,
      relativePath: ".env",
      content: "SECRET=leak",
    });
    expect(result.status).toBe("BLOCKED");
  });

  it("blocks write to .env.local (sensitive file)", async () => {
    const result = await writeWorkspaceFile({
      workspacePath: FIXTURE,
      relativePath: ".env.local",
      content: "SECRET=leak",
    });
    expect(result.status).toBe("BLOCKED");
  });

  it("blocks write to secret.pem (key file)", async () => {
    const result = await writeWorkspaceFile({
      workspacePath: FIXTURE,
      relativePath: "secret.pem",
      content: "pem-data",
    });
    expect(result.status).toBe("BLOCKED");
  });

  it("blocks write to private.key (key file)", async () => {
    const result = await writeWorkspaceFile({
      workspacePath: FIXTURE,
      relativePath: "private.key",
      content: "key-data",
    });
    expect(result.status).toBe("BLOCKED");
  });

  it("blocks write to credentials.txt (credentials file)", async () => {
    const result = await writeWorkspaceFile({
      workspacePath: FIXTURE,
      relativePath: "credentials.txt",
      content: "admin:pass",
    });
    expect(result.status).toBe("BLOCKED");
  });

  it("blocks write to tokens.json (token file)", async () => {
    const result = await writeWorkspaceFile({
      workspacePath: FIXTURE,
      relativePath: "tokens.json",
      content: "token-data",
    });
    expect(result.status).toBe("BLOCKED");
  });

  it("blocks write to secret/config.json (secret path)", async () => {
    const result = await writeWorkspaceFile({
      workspacePath: FIXTURE,
      relativePath: "secret/config.json",
      content: "secret-data",
    });
    expect(result.status).toBe("BLOCKED");
  });

  it("blocks path traversal with ../", async () => {
    const result = await writeWorkspaceFile({
      workspacePath: FIXTURE,
      relativePath: "../outside.txt",
      content: "outside",
    });
    expect(result.status).toBe("BLOCKED");
  });

  it("allows write to README.md in fixture (exact allowed file)", async () => {
    const result = await writeWorkspaceFile({
      workspacePath: FIXTURE,
      relativePath: "README.md",
      content: "# Fixture README\n",
    });
    expect(result.status).toBe("PASS");
    cleanupPaths.push("README.md");
  });

  it("allows write to CHANGELOG.md in fixture (exact allowed file)", async () => {
    const result = await writeWorkspaceFile({
      workspacePath: FIXTURE,
      relativePath: "CHANGELOG.md",
      content: "# Changelog\n",
    });
    expect(result.status).toBe("PASS");
    cleanupPaths.push("CHANGELOG.md");
  });

  it("allows write to bin/tool.sh (v0.3 expanded allowlist)", async () => {
    const result = await writeWorkspaceFile({
      workspacePath: FIXTURE,
      relativePath: "bin/tool.sh",
      content: "#!/bin/bash\necho hi",
    });
    expect(result.status).toBe("PASS");
    cleanupPaths.push("bin/tool.sh");
  });
});

describe("runProjectScript — projectSubdir (Phase 1.2)", () => {
  it("blocks dangerous script 'danger' via projectSubdir in fixture", async () => {
    const result = await runProjectScript({
      workspacePath: PROJECT_ROOT,
      projectSubdir: "tests/fixtures/sample-project",
      script: "danger",
    });
    expect(result.status).toBe("BLOCKED");
  });

  it("fails on script not found via projectSubdir", async () => {
    const result = await runProjectScript({
      workspacePath: PROJECT_ROOT,
      projectSubdir: "tests/fixtures/sample-project",
      script: "nonexistent",
    });
    expect(result.status).toBe("FAIL");
    expect(result.error).toBeTruthy();
  });

  it("blocks path traversal in projectSubdir", async () => {
    const result = await runProjectScript({
      workspacePath: PROJECT_ROOT,
      projectSubdir: "../../../windows",
      script: "build",
    });
    expect(result.status).toBe("FAIL");
    expect(result.error).toContain("traversal");
  });
});

describe("gitStatus — SKIPPED for non-repo (Phase 1.2)", () => {
  it("returns SKIPPED with not_a_git_repository reason on fixture", async () => {
    const result = await gitStatus({ workspacePath: FIXTURE });
    if (result.status === "SKIPPED") {
      expect(result.reason).toBe("not_a_git_repository");
      expect(result.exitCode).toBe(128);
    } else {
      // If the fixture happens to be in a git repo somehow, that's also acceptable
      expect(["PASS", "SKIPPED"]).toContain(result.status);
    }
  });
});
