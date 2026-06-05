import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const CUSTOMER_SCRIPTS = [
  "scripts/install-vscode-mcp.ps1",
  "scripts/install-cursor-mcp.ps1",
  "scripts/test-mcp-install.ps1",
  "scripts/package-customer-zip.ps1",
  "scripts/release-customer-pack.ps1",
  "scripts/verify-customer-zip-clean.mjs",
  "scripts/pilot-stdio.mjs",
];

const CUSTOMER_PACK_PATHS = [
  "tsconfig.json",
  "src/server.ts",
  "tests/fixtures/sample-project/package.json",
];

const CUSTOMER_DOCS = [
  "docs/HUONG-DAN-VSCODE-COPILOT.md",
  "docs/HUONG-DAN-CURSOR.md",
  "docs/TROUBLESHOOTING.md",
  "docs/RELEASE-CHECKLIST.md",
];

const ZIP_FORBIDDEN = [
  /node_modules/i,
  /[/\\]logs[/\\]/i,
  /\.mcp-debug/i,
  /[/\\]\.git[/\\]/i,
  /[/\\][^/\\]*\.env($|\.)/i,
  /[/\\]credentials[/\\]/i,
  /[/\\]credentials\.(json|txt|pem)/i,
  /[/\\]token\.(json|txt|key|pem)/i,
  /[/\\]secrets?[/\\]/i,
  /[/\\]secret\.(json|txt|key|pem)/i,
];

describe("customer install pack R1", () => {
  it("has all customer install scripts", () => {
    for (const rel of CUSTOMER_SCRIPTS) {
      expect(fs.existsSync(path.join(ROOT, rel)), rel).toBe(true);
    }
  });

  it("package script stages rebuild + smoke fixture paths", () => {
    const ps1 = fs.readFileSync(
      path.join(ROOT, "scripts/package-customer-zip.ps1"),
      "utf8",
    );
    expect(ps1).toContain("tsconfig.json");
    expect(ps1).toContain('Join-Path $ProjectRoot "src"');
    expect(ps1).toContain("sample-project");
    for (const rel of CUSTOMER_PACK_PATHS) {
      expect(fs.existsSync(path.join(ROOT, rel)), rel).toBe(true);
    }
  });

  it("has Vietnamese customer docs", () => {
    for (const rel of CUSTOMER_DOCS) {
      const full = path.join(ROOT, rel);
      expect(fs.existsSync(full), rel).toBe(true);
      expect(fs.readFileSync(full, "utf8").length).toBeGreaterThan(100);
    }
  });

  it("examples still match expected IDE schemas", () => {
    const cursor = JSON.parse(
      fs.readFileSync(path.join(ROOT, "examples/cursor-mcp.json"), "utf8"),
    );
    expect(cursor.mcpServers["local-coding-tools"]).toBeDefined();
    expect(cursor.mcpServers["local-coding-tools"].command).toBe("node");

    const vscode = JSON.parse(
      fs.readFileSync(path.join(ROOT, "examples/vscode-mcp.json"), "utf8"),
    );
    expect(vscode.servers["local-coding-tools"]).toBeDefined();
    expect(vscode.servers["local-coding-tools"].type).toBe("stdio");
  });

  it("has release automation npm scripts", () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(ROOT, "package.json"), "utf8"),
    );
    expect(pkg.scripts["release:customer"]).toContain("release-customer-pack.ps1");
    expect(pkg.scripts["release:gate"]).toContain("release-gate.mjs");
    expect(pkg.scripts["verify:customer-zip"]).toContain("verify-customer-zip-clean.mjs");
    expect(pkg.scripts["validate:ci"]).toContain("validate-ci-yaml.mjs");
  });

  it("install-cursor script does not enable allowlist by default", () => {
    const content = fs.readFileSync(
      path.join(ROOT, "scripts/install-cursor-mcp.ps1"),
      "utf8",
    );
    expect(content).toContain("EnableAllowlist");
    expect(content).toMatch(/if\s*\(\s*\$EnableAllowlist\s*\)/);
    expect(content).toContain("Run Everything");
  });

  it("customer ZIP excludes forbidden paths when present", () => {
    const releaseDir = path.join(ROOT, "release");
    if (!fs.existsSync(releaseDir)) return;

    const zips = fs
      .readdirSync(releaseDir)
      .filter((f) => f.endsWith("-customer.zip"));
    if (zips.length === 0) return;

    const zipPath = path.join(releaseDir, zips[zips.length - 1]!);
    const buf = fs.readFileSync(zipPath);
    const text = buf.toString("binary");

    for (const pattern of ZIP_FORBIDDEN) {
      expect(text).not.toMatch(pattern);
    }

    expect(text).toMatch(/dist[/\\]server\.js/);
    expect(text).toMatch(/install-vscode-mcp\.ps1/);
    expect(text).toMatch(/HUONG-DAN-CURSOR\.md/);
    expect(text).toMatch(/verify-full-image-local\.ps1/);
    expect(text).toMatch(/image-deps-smoke\.mjs/);
    expect(text).toMatch(/HUONG-DAN-FULL-IMAGE\.md/);
    expect(text).toMatch(/product-sample-1024\.png/);
  });
});
