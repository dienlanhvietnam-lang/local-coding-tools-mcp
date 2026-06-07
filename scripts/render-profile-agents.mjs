#!/usr/bin/env node
/** Render DMCTN-MCP-Safe/Dev/Admin.agent.md with profile tool lists */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EXPECTED_TOOLS } from "./expected-tools.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const VSIX_TOOLS = [
  "vsix_check_marketplace",
  "vsix_package",
  "vsix_publish_marketplace",
  "vsix_verify_publish",
];

const VSIX_DEV_TOOLS = [
  "vsix_check_marketplace",
  "vsix_package",
  "vsix_verify_publish",
];

const VSIX_SET = new Set(VSIX_TOOLS);
const SAFE_TOOLS = EXPECTED_TOOLS.filter((t) => !VSIX_SET.has(t));
const DEV_TOOLS = [...SAFE_TOOLS, ...VSIX_DEV_TOOLS];
const ADMIN_TOOLS = [...EXPECTED_TOOLS];

function toolYaml(names) {
  return names.map((n) => `  - local-coding-tools/${n}`).join("\n");
}

function renderAgent(templatePath, tools, destPaths) {
  const raw = fs.readFileSync(templatePath, "utf8");
  const updated = raw.replace(/^tools:\s*\[\]\s*$/m, `tools:\n${toolYaml(tools)}`);
  if (!updated.includes("local-coding-tools/")) {
    throw new Error(`Failed to inject tools into ${templatePath}`);
  }
  for (const dest of destPaths) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, updated, "utf8");
    console.log("wrote", dest, `(${tools.length} tools)`);
  }
}

const profiles = [
  {
    template: "DMCTN-MCP-Safe.agent.md",
    tools: SAFE_TOOLS,
    dests: [
      path.join(ROOT, "templates/copilot/DMCTN-MCP-Safe.agent.md"),
      path.join(ROOT, "..", ".github/agents/DMCTN-MCP-Safe.agent.md"),
    ],
  },
  {
    template: "DMCTN-MCP-Dev.agent.md",
    tools: DEV_TOOLS,
    dests: [
      path.join(ROOT, "templates/copilot/DMCTN-MCP-Dev.agent.md"),
      path.join(ROOT, "..", ".github/agents/DMCTN-MCP-Dev.agent.md"),
    ],
  },
  {
    template: "DMCTN-MCP-Admin.agent.md",
    tools: ADMIN_TOOLS,
    dests: [
      path.join(ROOT, "templates/copilot/DMCTN-MCP-Admin.agent.md"),
      path.join(ROOT, "..", ".github/agents/DMCTN-MCP-Admin.agent.md"),
    ],
  },
];

for (const p of profiles) {
  const templatePath = path.join(ROOT, "templates/copilot", p.template);
  renderAgent(templatePath, p.tools, p.dests);
}

console.log(`Safe: ${SAFE_TOOLS.length}, Dev: ${DEV_TOOLS.length}, Admin: ${ADMIN_TOOLS.length}`);
