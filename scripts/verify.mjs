#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const baseRequired = [
  "dist/server.js",
  "dist/config.js",
  "dist/tools/checkSystem.js",
  "dist/tools/readLints.js",
  "dist/tools/applyPatch.js",
  "dist/tools/imageInfo.js",
  "dist/tools/imageCrop.js",
  "dist/tools/imageResize.js",
  "dist/tools/imageRemoveBackground.js",
  "dist/tools/imageAdjust.js",
  "dist/tools/imageComposite.js",
  "dist/tools/imageBatch.js",
  "dist/tools/imageText.js",
  "dist/tools/imageRounded.js",
  "dist/tools/imageUpscale.js",
  "dist/tools/imageUpscaleAi.js",
  "dist/utils/aiUpscale.js",
  "LICENSE",
  "docs/PUBLISH.md",
  "docs/HUONG-DAN-VSCODE-COPILOT.md",
  "docs/HUONG-DAN-CURSOR.md",
  "docs/TROUBLESHOOTING.md",
  "scripts/install-vscode-mcp.ps1",
  "scripts/install-cursor-mcp.ps1",
  "scripts/bootstrap-customer-install.ps1",
  "scripts/verify-copilot-mcp-policy.mjs",
  "scripts/test-mcp-install.ps1",
  "templates/copilot/DMCTN-MCP.agent.md",
  "templates/copilot/copilot-instructions.md",
  "CAI-MCP.bat",
  "docs/HUONG-DAN-CAI-BANG-BAT.md",
  "pilot-kit/CHECKLIST-VSCODE-COPILOT.md",
  "scripts/package-customer-zip.ps1",
  "scripts/pilot-stdio.mjs",
  "scripts/check-image-deps.ps1",
  "scripts/check-image-deps.mjs",
  "scripts/install-image-deps.ps1",
  "scripts/verify-full-image-local.ps1",
  "scripts/verify-image-profile.mjs",
  "scripts/image-deps-smoke.mjs",
  "scripts/run-cli.mjs",
  "scripts/check-exec-hardening.mjs",
  "scripts/release-gate.mjs",
  "scripts/release-gate-lib.mjs",
  "docs/HUONG-DAN-FULL-IMAGE.md",
  "docs/RELEASE-CHECKLIST.md",
  "tests/fixtures/images/product-sample-1024.png",
  "dist/safety/imageGuard.js",
  "dist/safety/commandGuard.js",
  "dist/safety/writePathPolicy.js",
  "examples/cursor-mcp.json",
  "examples/vscode-mcp.json",
  "examples/IDE-SETUP.md",
  "README.md",
  "tsconfig.json",
  "src/server.ts",
  "tests/fixtures/sample-project/package.json",
];

const devOnlyRequired = [
  "installer/winget/DevGOL.LocalCodingToolsMcp.yaml",
  ".github/workflows/ci.yml",
  "scripts/validate-ci-yaml.mjs",
  "scripts/release-customer-pack.ps1",
  "scripts/verify-customer-zip-clean.mjs",
];

const isCustomerPack =
  !fs.existsSync(path.join(ROOT, ".github/workflows/ci.yml")) &&
  !fs.existsSync(path.join(ROOT, "installer/winget/DevGOL.LocalCodingToolsMcp.yaml"));

const required = isCustomerPack ? baseRequired : [...baseRequired, ...devOnlyRequired];

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

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));

let ok = true;
for (const rel of required) {
  const full = path.join(ROOT, rel);
  if (fs.existsSync(full)) {
    console.log(`✓ ${rel}`);
  } else {
    console.error(`✗ missing: ${rel}`);
    ok = false;
  }
}

if (pkg.version !== "0.10.0") {
  console.error(`✗ expected version 0.10.0, got ${pkg.version}`);
  ok = false;
} else {
  console.log(`✓ package.json version ${pkg.version}`);
}

// Customer install script content checks
const cursorInstall = fs.readFileSync(
  path.join(ROOT, "scripts/install-cursor-mcp.ps1"),
  "utf8",
);
if (!cursorInstall.includes("mcpAllowlist") || !cursorInstall.includes("Run Everything")) {
  console.error("✗ install-cursor-mcp.ps1 missing allowlist / Run Everything warning");
  ok = false;
} else {
  console.log("✓ install-cursor-mcp.ps1 allowlist opt-in + warning");
}

const vscodeInstall = fs.readFileSync(
  path.join(ROOT, "scripts/install-vscode-mcp.ps1"),
  "utf8",
);
if (!vscodeInstall.includes('"servers"') || vscodeInstall.includes("mcpServers")) {
  console.error("✗ install-vscode-mcp.ps1 schema check failed");
  ok = false;
} else {
  console.log("✓ install-vscode-mcp.ps1 VS Code servers schema");
}

if (
  !vscodeInstall.includes("InstallCopilotAgent") ||
  !vscodeInstall.includes("ForceMcpPolicy") ||
  !vscodeInstall.includes("DMCTN-MCP.agent.md")
) {
  console.error("✗ install-vscode-mcp.ps1 missing Copilot policy installer params");
  ok = false;
} else {
  console.log("✓ install-vscode-mcp.ps1 Copilot policy installer");
}

const agentTpl = fs.readFileSync(
  path.join(ROOT, "templates/copilot/DMCTN-MCP.agent.md"),
  "utf8",
);
if (!agentTpl.includes("local-coding-tools/*")) {
  console.error("✗ DMCTN-MCP.agent.md template missing tools wildcard");
  ok = false;
} else {
  console.log("✓ templates/copilot/DMCTN-MCP.agent.md tools wildcard");
}

const instrTpl = fs.readFileSync(
  path.join(ROOT, "templates/copilot/copilot-instructions.md"),
  "utf8",
);
if (
  !instrTpl.includes("run_project_script") ||
  /(?:enable|use|set)\s+.*Run Everything/i.test(instrTpl)
) {
  console.error("✗ copilot-instructions template check failed");
  ok = false;
} else {
  console.log("✓ templates/copilot/copilot-instructions.md mapping");
}

// Examples schema
try {
  const cursor = JSON.parse(
    fs.readFileSync(path.join(ROOT, "examples/cursor-mcp.json"), "utf8"),
  );
  const vscode = JSON.parse(
    fs.readFileSync(path.join(ROOT, "examples/vscode-mcp.json"), "utf8"),
  );
  if (!cursor.mcpServers?.["local-coding-tools"]) throw new Error("cursor example");
  if (!vscode.servers?.["local-coding-tools"]) throw new Error("vscode example");
  console.log("✓ examples/cursor-mcp.json + vscode-mcp.json schemas");
} catch (e) {
  console.error(`✗ examples schema: ${e.message}`);
  ok = false;
}

// Customer ZIP validation (if built)
const releaseDir = path.join(ROOT, "release");
const zipName = `local-coding-tools-mcp-v${pkg.version}-customer.zip`;
const zipPath = path.join(releaseDir, zipName);
if (fs.existsSync(zipPath)) {
  const buf = fs.readFileSync(zipPath);
  const text = buf.toString("binary");
  let zipOk = true;
  for (const pattern of ZIP_FORBIDDEN) {
    if (pattern.test(text)) {
      console.error(`✗ customer ZIP contains forbidden pattern: ${pattern}`);
      zipOk = false;
    }
  }
  if (!text.includes("dist/server.js") && !text.includes("dist\\server.js")) {
    console.error("✗ customer ZIP missing dist/server.js");
    zipOk = false;
  }
  if (zipOk) {
    console.log(`✓ ${zipName} (no forbidden paths)`);
  } else {
    ok = false;
  }
} else {
  console.log(`○ ${zipName} not found (run package-customer-zip.ps1)`);
}

// Image deps installer smoke (+ CI yaml validation in dev repo only)
try {
  const { spawnSync } = await import("node:child_process");
  function runScript(rel) {
    const r = spawnSync(process.execPath, [path.join(ROOT, rel)], {
      cwd: ROOT,
      stdio: "inherit",
      shell: false,
    });
    if (r.status !== 0) throw new Error(`${rel} exit ${r.status}`);
  }
  runScript("scripts/image-deps-smoke.mjs");
  if (!isCustomerPack) {
    runScript("scripts/validate-ci-yaml.mjs");
    runScript("scripts/check-exec-hardening.mjs");
  } else {
    console.log("○ validate-ci-yaml.mjs skipped (customer pack)");
    console.log("○ check-exec-hardening.mjs skipped (customer pack)");
  }
} catch (e) {
  console.error("✗ script smoke failed:", e?.message ?? e);
  ok = false;
}

if (!ok) {
  console.error("\nVerify FAILED");
  process.exit(1);
}
const label = isCustomerPack
  ? "Verify PASSED (customer pack)"
  : "Verify PASSED (v0.10.0 + customer install pack)";
console.log(`\n${label}`);
