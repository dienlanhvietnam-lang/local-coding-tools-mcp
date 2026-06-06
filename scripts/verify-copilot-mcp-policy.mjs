#!/usr/bin/env node
/**
 * Verify VS Code Copilot MCP force-policy files in a workspace.
 * Usage: node scripts/verify-copilot-mcp-policy.mjs [WorkspaceRoot]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(process.argv[2] ?? process.cwd());

const SECRET_PATTERNS = [
  /(?:api[_-]?key|secret|token|password)\s*[:=]\s*['"]?[a-zA-Z0-9_\-]{16,}/i,
  /sk-[a-zA-Z0-9]{20,}/,
  /ghp_[a-zA-Z0-9]{20,}/,
  /AKIA[0-9A-Z]{16}/,
];

const checks = [];

function add(name, pass, detail = "") {
  checks.push({ name, pass, detail });
  const mark = pass ? "✓" : "✗";
  const suffix = detail ? ` — ${detail}` : "";
  console.log(`${mark} ${name}${suffix}`);
}

function readIfExists(rel) {
  const full = path.join(workspaceRoot, rel);
  if (!fs.existsSync(full)) return { full, text: null };
  const text = fs.readFileSync(full, "utf8").replace(/^\uFEFF/, "");
  return { full, text };
}

const mcp = readIfExists(".vscode/mcp.json");
add(".vscode/mcp.json exists", mcp.text !== null, mcp.full);

if (mcp.text) {
  try {
    const j = JSON.parse(mcp.text);
    add(
      "mcp.json has local-coding-tools server",
      Boolean(j.servers?.["local-coding-tools"]),
    );
  } catch (e) {
    add("mcp.json valid JSON", false, e.message);
  }
}

const agent = readIfExists(".github/agents/DMCTN-MCP.agent.md");
add(".github/agents/DMCTN-MCP.agent.md exists", agent.text !== null, agent.full);

if (agent.text) {
  add(
    "agent has tools: local-coding-tools/*",
    /local-coding-tools\/\*/.test(agent.text),
  );
  add(
    "agent frontmatter name DMCTN-MCP",
    /^---[\s\S]*?name:\s*DMCTN-MCP/m.test(agent.text),
  );
}

const instr = readIfExists(".github/copilot-instructions.md");
add(".github/copilot-instructions.md exists", instr.text !== null, instr.full);

if (instr.text) {
  add(
    "instructions map run_project_script",
    /run_project_script/.test(instr.text),
  );
  add(
    "instructions map run_coding_session",
    /run_coding_session/.test(instr.text),
  );
  add(
    "no Run Everything default",
    !/(?:enable|use|set)\s+.*Run Everything/i.test(instr.text),
  );
}

for (const rel of [
  ".vscode/mcp.json",
  ".github/agents/DMCTN-MCP.agent.md",
  ".github/copilot-instructions.md",
]) {
  const full = path.join(workspaceRoot, rel);
  if (!fs.existsSync(full)) continue;
  const text = fs.readFileSync(full, "utf8");
  const hit = SECRET_PATTERNS.find((p) => p.test(text));
  add(`no token/secret in ${rel}`, !hit, hit ? "pattern matched" : "");
}

const failed = checks.filter((c) => !c.pass);
console.log("");
if (failed.length === 0) {
  console.log(`VERIFY COPILOT MCP POLICY: PASS (${checks.length} checks)`);
  process.exit(0);
}

console.error(`VERIFY COPILOT MCP POLICY: FAIL (${failed.length}/${checks.length})`);
for (const f of failed) {
  console.error(`  - ${f.name}${f.detail ? `: ${f.detail}` : ""}`);
}
process.exit(1);
