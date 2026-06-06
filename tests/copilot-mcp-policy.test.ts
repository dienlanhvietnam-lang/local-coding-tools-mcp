import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function runPowerShell(
  script: string,
  params: Record<string, string | boolean>,
): void {
  const parts = ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script];
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "boolean") {
      if (value) parts.push(`-${key}`);
    } else {
      parts.push(`-${key}`, value);
    }
  }
  const result = spawnSync(parts[0]!, parts.slice(1), {
    cwd: ROOT,
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.status !== 0) {
    throw new Error(
      (result.stderr || result.stdout || "PowerShell failed").trim(),
    );
  }
}

describe("copilot MCP force policy installer R1", () => {
  it("install-vscode-mcp.ps1 exposes InstallCopilotAgent and ForceMcpPolicy", () => {
    const ps1 = fs.readFileSync(
      path.join(ROOT, "scripts/install-vscode-mcp.ps1"),
      "utf8",
    );
    expect(ps1).toContain("InstallCopilotAgent");
    expect(ps1).toContain("ForceMcpPolicy");
    expect(ps1).toContain("BackupExistingAgent");
    expect(ps1).toContain("DMCTN-MCP.agent.md");
  });

  it("templates have required policy content", () => {
    const agent = fs.readFileSync(
      path.join(ROOT, "templates/copilot/DMCTN-MCP.agent.md"),
      "utf8",
    );
    expect(agent).toMatch(/name:\s*DMCTN-MCP/);
    expect(agent).toContain("local-coding-tools/check_system");
    expect(agent).toContain("local-coding-tools/fetch_cached_output");
    expect(agent).toContain("run_project_script");
    expect(agent).toContain("MCP_NOT_AVAILABLE");
    expect(agent).toMatch(/MCP_ONLY|BẮT BUỘC/);
    expect(agent).toContain("TODO_AUTO");
    expect(agent).toContain("RESPONSE_STYLE");

    const instr = fs.readFileSync(
      path.join(ROOT, "templates/copilot/copilot-instructions.md"),
      "utf8",
    );
    expect(instr).toContain("run_project_script");
    expect(instr).toContain("run_coding_session");
    expect(instr).toMatch(/MCP_ONLY|BẮT BUỘC/);
    expect(instr).not.toMatch(/Run Everything.*default/i);
  });

  it("install script creates agent and instructions in workspace fixture", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "dmctn-copilot-policy-"));
    try {
      runPowerShell(path.join(ROOT, "scripts/install-vscode-mcp.ps1"), {
        WorkspaceRoot: tmp,
        ServerRoot: ROOT,
        InstallCopilotAgent: true,
        ForceMcpPolicy: true,
        Yes: true,
      });

      const agentPath = path.join(tmp, ".github/agents/DMCTN-MCP.agent.md");
      const instrPath = path.join(tmp, ".github/copilot-instructions.md");
      const mcpPath = path.join(tmp, ".vscode/mcp.json");

      expect(fs.existsSync(agentPath)).toBe(true);
      expect(fs.existsSync(instrPath)).toBe(true);
      expect(fs.existsSync(mcpPath)).toBe(true);

      const agentText = fs.readFileSync(agentPath, "utf8");
      expect(agentText).toContain("local-coding-tools/check_system");

      execSync(`node scripts/verify-copilot-mcp-policy.mjs "${tmp}"`, {
        cwd: ROOT,
        stdio: "pipe",
        encoding: "utf8",
      });
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("bootstrap-customer-install.ps1 references DMCTN-MCP for vscode", () => {
    const ps1 = fs.readFileSync(
      path.join(ROOT, "scripts/bootstrap-customer-install.ps1"),
      "utf8",
    );
    expect(ps1).toContain("DMCTN-MCP");
    expect(ps1).toContain("InstallCopilotAgent");
    expect(ps1).toContain("ForceMcpPolicy");
  });

  it("customer pack includes policy templates or install script", () => {
    const releaseDir = path.join(ROOT, "release");
    if (!fs.existsSync(releaseDir)) return;

    const zips = fs
      .readdirSync(releaseDir)
      .filter((f) => f.endsWith("-customer.zip"));
    if (zips.length === 0) return;

    const zipPath = path.join(releaseDir, zips[zips.length - 1]!);
    const text = fs.readFileSync(zipPath).toString("binary");

    expect(text).toMatch(/DMCTN-MCP\.agent\.md/);
    expect(text).toMatch(/verify-copilot-mcp-policy\.mjs/);
    expect(text).toMatch(/bootstrap-customer-install\.ps1/);
    expect(text).toMatch(/CAI-MCP\.bat/);
  });
});
