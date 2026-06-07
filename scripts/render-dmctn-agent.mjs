#!/usr/bin/env node
/** Render DMCTN-MCP.agent.md from expected-tools.mjs + agent body template */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EXPECTED_TOOLS, EXPECTED_TOOL_COUNT } from "./expected-tools.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const toolYaml = EXPECTED_TOOLS.map((n) => `  - local-coding-tools/${n}`).join("\n");

const bodyTemplate = fs.readFileSync(
  path.join(ROOT, "templates/copilot/DMCTN-MCP-agent-body.md"),
  "utf8"
);

const agentBody = bodyTemplate
  .replaceAll("__TOOL_COUNT__", String(EXPECTED_TOOL_COUNT))
  .replace("__TOOL_LIST__", `\`${EXPECTED_TOOLS.join("`, `")}\``);

const body = `---
name: DMCTN-MCP
description: Agent kỹ thuật — ${EXPECTED_TOOL_COUNT} MCP tools, MCP_ONLY, TODO_AUTO, báo cáo Verdict/Evidence.
tools:
${toolYaml}
---

${agentBody}
`;

const targets = [
  path.join(ROOT, "templates/copilot/DMCTN-MCP.agent.md"),
  path.join(ROOT, "..", ".github/agents/DMCTN-MCP.agent.md"),
  path.join(ROOT, "..", "vscode-extension-dmctn-mcp/resources/templates/DMCTN-MCP.agent.md"),
];

for (const dest of targets) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, body, "utf8");
  console.log("wrote", dest);
}
