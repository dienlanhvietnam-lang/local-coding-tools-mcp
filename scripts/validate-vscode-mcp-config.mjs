#!/usr/bin/env node
/**
 * Validate VS Code workspace MCP config for local-coding-tools.
 * No internet. No npx.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");
const WORKSPACE_ROOT = path.resolve(PROJECT_ROOT, "..");
const MCP_FILE = path.join(WORKSPACE_ROOT, ".vscode", "mcp.json");
const SERVER_JS = path.join(PROJECT_ROOT, "dist", "server.js");
const EXPECTED_CWD = PROJECT_ROOT;

const FORBIDDEN_CMD = /\bnpx(\.cmd|\.ps1)?\b/i;
const SECRET_RE = /\b(api[_-]?key|token|password|secret)\b/i;

const checks = [];

function add(name, pass, detail = "") {
  checks.push({ name, status: pass ? "PASS" : "FAIL", detail });
}

function readJsonSafe(filePath) {
  try {
    return { ok: true, data: JSON.parse(fs.readFileSync(filePath, "utf8")) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// 1. Workspace mcp.json exists
add("workspace mcp.json exists", fs.existsSync(MCP_FILE), MCP_FILE);

let cfg = null;
if (fs.existsSync(MCP_FILE)) {
  const parsed = readJsonSafe(MCP_FILE);
  add("JSON parse", parsed.ok, parsed.ok ? "" : parsed.error);
  if (parsed.ok) cfg = parsed.data;
}

if (cfg) {
  const server = cfg.servers?.["local-coding-tools"];
  add("servers.local-coding-tools exists", !!server);
  if (server) {
    add("type = stdio", server.type === "stdio", String(server.type ?? ""));
    add("command = node", server.command === "node", String(server.command ?? ""));
    const argsJoined = (server.args ?? []).join(" ");
    const argsNorm = argsJoined.replace(/\\/g, "/").toLowerCase();
    add(
      "args contains dist/server.js",
      argsNorm.includes("dist/server.js"),
      argsJoined
    );
    add("dist/server.js exists", fs.existsSync(SERVER_JS), SERVER_JS);
    const cwdNorm = path.resolve(server.cwd ?? "").replace(/\\/g, "/").toLowerCase();
    const expectedNorm = EXPECTED_CWD.replace(/\\/g, "/").toLowerCase();
    add("cwd correct", cwdNorm === expectedNorm, `${server.cwd}`);
    const raw = JSON.stringify(cfg);
    add("no npx in config", !FORBIDDEN_CMD.test(raw));
    add("no secrets in config", !SECRET_RE.test(raw));
  }
}

// Duplicate scan (audit paths only)
const auditPaths = [
  MCP_FILE,
  path.join(PROJECT_ROOT, ".vscode", "mcp.json"),
  path.join(process.env.APPDATA ?? "", "Code", "User", "mcp.json"),
];

const duplicates = [];
for (const p of auditPaths) {
  if (!fs.existsSync(p)) continue;
  const parsed = readJsonSafe(p);
  if (parsed.ok && parsed.data.servers?.["local-coding-tools"]) {
    duplicates.push(p);
  }
}

if (duplicates.length === 1 && duplicates[0] === MCP_FILE) {
  add("no duplicate local-coding-tools configs", true, "only workspace active");
} else if (duplicates.length <= 1) {
  add("no duplicate local-coding-tools configs", true, duplicates.join("; ") || "none");
} else {
  add("no duplicate local-coding-tools configs", false, duplicates.join("; "));
}

// Nested disabled check
const nestedDir = path.join(PROJECT_ROOT, ".vscode");
if (fs.existsSync(nestedDir)) {
  const activeNested = fs.existsSync(path.join(nestedDir, "mcp.json"));
  add("nested project mcp.json disabled", !activeNested, activeNested ? "still active" : "disabled or absent");
}

// User disabled check
const userMcp = path.join(process.env.APPDATA ?? "", "Code", "User", "mcp.json");
add("user-level mcp.json removed/disabled", !fs.existsSync(userMcp), userMcp);

const report = {
  time: new Date().toISOString(),
  mcpFile: MCP_FILE,
  checks,
  allPass: checks.every((c) => c.status === "PASS"),
};

console.log(JSON.stringify(report, null, 2));
process.exit(report.allPass ? 0 : 1);
