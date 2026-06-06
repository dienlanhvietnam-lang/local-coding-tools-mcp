/**
 * Release gate library — shared scan/probe helpers.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { EXPECTED_TOOL_COUNT as REGISTRY_TOOL_COUNT } from "./expected-tools.mjs";

export const EXPECTED_TOOL_COUNT = REGISTRY_TOOL_COUNT;

export const FORBIDDEN_PATTERNS = [
  [/node_modules/i, "node_modules"],
  [/[/\\]logs[/\\]/i, "logs/"],
  [/\.mcp-debug/i, ".mcp-debug"],
  [/[/\\]\.git[/\\]/i, ".git/"],
  [/[/\\][^/\\]*\.env($|\.)/i, ".env"],
  [/[/\\]credentials[/\\]/i, "credentials/"],
  [/[/\\]credentials\.(json|txt|pem)/i, "credentials file"],
  [/[/\\]token\.(json|txt|key|pem)/i, "token file"],
  [/[/\\]secrets?[/\\]/i, "secrets/"],
  [/[/\\]secret\.(json|txt|key|pem)/i, "secret file"],
];

export const REQUIRED_ZIP_MARKERS = [
  "dist/server.js",
  "src/server.ts",
  "tsconfig.json",
  "package.json",
  "README.md",
  "docs/HUONG-DAN-FULL-IMAGE.md",
  "scripts/install-vscode-mcp.ps1",
  "scripts/verify-copilot-mcp-policy.mjs",
  "scripts/bootstrap-customer-install.ps1",
  "templates/copilot/DMCTN-MCP.agent.md",
  "scripts/install-cursor-mcp.ps1",
  "scripts/check-image-deps.ps1",
  "scripts/install-image-deps.ps1",
  "scripts/verify-image-profile.mjs",
  "scripts/verify-full-image-local.ps1",
  "tests/fixtures/images/product-sample-1024.png",
];

function sha256File(filePath) {
  const buf = fs.readFileSync(filePath);
  return createHash("sha256").update(buf).digest("hex").toUpperCase();
}

export function zipForbiddenScan(buf) {
  const text = buf.toString("binary");
  return FORBIDDEN_PATTERNS.filter(([re]) => re.test(text)).map(([, name]) => name);
}

export function zipRequiredScan(buf) {
  const text = buf.toString("binary");
  const missing = [];
  for (const marker of REQUIRED_ZIP_MARKERS) {
    const win = marker.replace(/\//g, "\\");
    if (!text.includes(marker) && !text.includes(win)) {
      missing.push(marker);
    }
  }
  return missing;
}

export function parseSha256Sums(content, zipBaseName) {
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const m = trimmed.match(/^([A-Fa-f0-9]{64})\s+(\S+)/);
    if (m && m[2] === zipBaseName) {
      return m[1].toUpperCase();
    }
  }
  return null;
}

export async function probeToolCount(projectRoot) {
  const server = path.join(projectRoot, "dist", "server.js");
  if (!fs.existsSync(server)) {
    return { ok: false, count: 0, error: "dist/server.js missing" };
  }

  let client;
  try {
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [server],
      cwd: projectRoot,
    });
    client = new Client({ name: "release-gate", version: "1.0.0" }, { capabilities: {} });
    await client.connect(transport);
    const tools = await client.listTools();
    const count = tools.tools?.length ?? 0;
    return { ok: count === EXPECTED_TOOL_COUNT, count, toolNames: tools.tools?.map((t) => t.name) };
  } catch (err) {
    return {
      ok: false,
      count: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    if (client) await client.close().catch(() => {});
  }
}

/**
 * @param {string} projectRoot
 * @param {{ zipPath?: string, writeJson?: boolean }} [options]
 */
export async function runReleaseGate(projectRoot, options = {}) {
  const writeJson = options.writeJson !== false;
  const checks = [];
  let overall = "PASS";

  function add(name, pass, detail = "") {
    checks.push({ name, status: pass ? "PASS" : "FAIL", detail });
    if (!pass) overall = "FAIL";
  }

  const pkgPath = path.join(projectRoot, "package.json");
  let version = "";
  if (!fs.existsSync(pkgPath)) {
    add("package.json version", false, "package.json missing");
  } else {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    version = pkg.version ?? "";
    add("package.json version", Boolean(version), version || "empty");
  }

  const distServer = path.join(projectRoot, "dist", "server.js");
  add("dist/server.js exists", fs.existsSync(distServer), distServer);

  const toolProbe = await probeToolCount(projectRoot);
  add(
    `tools/list count = ${EXPECTED_TOOL_COUNT}`,
    toolProbe.ok,
    toolProbe.ok ? String(toolProbe.count) : (toolProbe.error ?? `got ${toolProbe.count}`),
  );

  const zipName = version
    ? `local-coding-tools-mcp-v${version}-customer.zip`
    : "local-coding-tools-mcp-v0.7.0-customer.zip";
  const zipPath = options.zipPath ?? path.join(projectRoot, "release", zipName);
  const zipExists = fs.existsSync(zipPath);
  add("customer ZIP exists", zipExists, zipPath);

  const sumsPath = path.join(projectRoot, "release", "SHA256SUMS.txt");
  add("SHA256SUMS.txt exists", fs.existsSync(sumsPath), sumsPath);

  let zipHash = "";

  if (zipExists) {
    const buf = fs.readFileSync(zipPath);
    const forbidden = zipForbiddenScan(buf);
    add("ZIP forbidden paths", forbidden.length === 0, forbidden.length ? forbidden.join(", ") : "clean");

    const missingRequired = zipRequiredScan(buf);
    add(
      "ZIP required paths",
      missingRequired.length === 0,
      missingRequired.length ? `missing: ${missingRequired.join(", ")}` : "all present",
    );

    zipHash = sha256File(zipPath);

    if (fs.existsSync(sumsPath)) {
      const recorded = parseSha256Sums(fs.readFileSync(sumsPath, "utf8"), path.basename(zipPath));
      const match = recorded === zipHash;
      add("SHA256 matches ZIP", match, match ? zipHash : `sums=${recorded ?? "none"} zip=${zipHash}`);
    } else {
      add("SHA256 matches ZIP", false, "SHA256SUMS.txt missing");
    }
  } else {
    add("ZIP forbidden paths", false, "ZIP missing");
    add("ZIP required paths", false, "ZIP missing");
    add("SHA256 matches ZIP", false, "ZIP missing");
  }

  const result = {
    overall,
    version,
    zipPath: zipExists ? zipPath : null,
    sha256: zipHash || null,
    expectedToolCount: EXPECTED_TOOL_COUNT,
    actualToolCount: toolProbe.count ?? 0,
    checks,
    timestamp: new Date().toISOString(),
  };

  if (writeJson) {
    const releaseDir = path.join(projectRoot, "release");
    fs.mkdirSync(releaseDir, { recursive: true });
    fs.writeFileSync(
      path.join(releaseDir, "release-gate-result.json"),
      JSON.stringify(result, null, 2),
      "utf8",
    );
  }

  return result;
}
