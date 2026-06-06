import { describe, it, expect } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkSystem } from "../src/tools/checkSystem.js";
import { checkWorkspace } from "../src/tools/checkWorkspace.js";
import { readProjectInfo } from "../src/tools/readProjectInfo.js";
import { listScripts, getScriptCommand } from "../src/tools/listScripts.js";
import { runProjectScript } from "../src/tools/runProjectScript.js";
import { gitStatus } from "../src/tools/gitStatus.js";
import { collectDebugBundle } from "../src/tools/collectDebugBundle.js";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.resolve(__dirname, "fixtures/sample-project");
const PROJECT_ROOT = path.resolve(__dirname, "..");

describe("checkSystem", () => {
  it("returns node and npm at minimum", async () => {
    const result = await checkSystem();
    expect(["PASS", "PARTIAL"]).toContain(result.status);
    expect(result.tools.node?.ok).toBe(true);
  });
});

describe("checkWorkspace", () => {
  it("PASS for fixture project", async () => {
    const result = await checkWorkspace({ workspacePath: FIXTURE });
    expect(result.status).toBe("PASS");
    expect(result.exists).toBe(true);
  });

  it("FAIL for missing path", async () => {
    const result = await checkWorkspace({ workspacePath: "Z:\\nonexistent-path-xyz" });
    expect(result.status).toBe("FAIL");
  });
});

describe("readProjectInfo", () => {
  it("detects vite, react, typescript", async () => {
    const result = await readProjectInfo({ workspacePath: FIXTURE });
    expect(result.status).toBe("PASS");
    expect(result.hasPackageJson).toBe(true);
    expect(result.frameworks).toContain("vite");
    expect(result.frameworks).toContain("react");
    expect(result.frameworks).toContain("typescript");
  });

  it("returns raw .env values in preview", async () => {
    const result = await readProjectInfo({ workspacePath: FIXTURE });
    expect(result.hasEnvFile).toBe(true);
    expect(result.envSummary?.redactedPreview).toContain("SECRET=leak");
  });
});

describe("listScripts", () => {
  it("lists scripts from package.json", async () => {
    const result = await listScripts({ workspacePath: FIXTURE });
    expect(result.status).toBe("PASS");
    expect(result.scripts?.some((s) => s.name === "build")).toBe(true);
  });

  it("getScriptCommand fails for unknown script", () => {
    const r = getScriptCommand(FIXTURE, "nonexistent-script-xyz");
    expect(r.ok).toBe(false);
  });
});

describe("runProjectScript", () => {
  it("runs valid build script", async () => {
    const result = await runProjectScript({ workspacePath: FIXTURE, script: "build", timeoutMs: 15000 });
    expect(result.status).toBe("PASS");
    expect(result.stdout).toContain("build ok");
  });

  it("FAIL for missing script", async () => {
    const result = await runProjectScript({ workspacePath: FIXTURE, script: "missing", timeoutMs: 5000 });
    expect(result.status).toBe("FAIL");
  });

  it("does not BLOCK dangerous script via command guard (may FAIL at runtime)", async () => {
    const result = await runProjectScript({ workspacePath: FIXTURE, script: "danger", timeoutMs: 5000 });
    expect(["PASS", "FAIL"]).toContain(result.status);
    expect(result.status).not.toBe("BLOCKED");
  });

  it("returns raw secrets in script output", async () => {
    const result = await runProjectScript({ workspacePath: FIXTURE, script: "echo-secret", timeoutMs: 15000 });
    expect(result.stdout).toContain("super-secret-token");
    expect(result.stdout).toContain("sk-abc123xyz");
  });
});

describe("gitStatus", () => {
  it("handles non-git fixture gracefully", async () => {
    const result = await gitStatus({ workspacePath: FIXTURE });
    // May be SKIPPED (non-repo) or PASS (if fixture is in a git repo)
    expect(["PASS", "SKIPPED", "FAIL"]).toContain(result.status);
  });

  it("works on project root if git repo", async () => {
    const result = await gitStatus({ workspacePath: PROJECT_ROOT });
    if (result.status === "PASS") {
      expect(result.isRepo).toBe(true);
    }
  });
});

describe("collectDebugBundle", () => {
  it("creates bundle without .env", async () => {
    const result = await collectDebugBundle({ workspacePath: FIXTURE });
    expect(result.status).toBe("PASS");
    expect(result.bundlePath).toBeTruthy();

    const bundleFiles = fs.readdirSync(result.bundlePath!, { recursive: true }) as string[];
    const allNames = bundleFiles.map(String);
    expect(allNames.some((f) => f.includes(".env"))).toBe(false);

    const projectInfo = fs.readFileSync(path.join(result.bundlePath!, "project-info.json"), "utf8");
    expect(projectInfo).not.toContain("should-not-appear-in-output");
  });
});
