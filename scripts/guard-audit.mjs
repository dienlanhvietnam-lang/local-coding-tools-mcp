#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SERVER = path.join(ROOT, "dist", "server.js");
const MAIN_WS = ROOT;
const FIXTURE_WS = path.join(ROOT, "tests", "fixtures", "sample-project");

async function importGuard() {
  const url = pathToFileURL(path.join(ROOT, "dist", "safety", "commandGuard.js")).href;
  return import(url);
}

function parseToolResult(result) {
  const text = result?.content?.find((c) => c.type === "text")?.text ?? "{}";
  return JSON.parse(text);
}

async function callTool(client, name, args) {
  const result = await client.callTool({ name, arguments: args });
  return parseToolResult(result);
}

async function main() {
  const { isDangerousCommand } = await importGuard();

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [SERVER],
    cwd: ROOT,
  });
  const client = new Client({ name: "guard-audit", version: "1.0.0" }, { capabilities: {} });
  await client.connect(transport);

  const report = {
    workspace: MAIN_WS,
    nonExistentScript: null,
    dangerousScriptsInMainProject: [],
    dangerousScriptRunResults: [],
  };

  // 1. run_project_script với script không tồn tại
  report.nonExistentScript = await callTool(client, "run_project_script", {
    workspacePath: MAIN_WS,
    script: "dangerous-delete",
    timeoutMs: 5000,
  });

  // 2. Quét scripts hiện có trong package.json chính
  const listMain = await callTool(client, "list_scripts", { workspacePath: MAIN_WS });
  for (const s of listMain.scripts ?? []) {
    const guard = isDangerousCommand(s.command);
    if (!guard.allowed) {
      report.dangerousScriptsInMainProject.push({
        name: s.name,
        command: s.command,
        guard,
      });
      const runResult = await callTool(client, "run_project_script", {
        workspacePath: MAIN_WS,
        script: s.name,
        timeoutMs: 5000,
      });
      report.dangerousScriptRunResults.push({ workspace: MAIN_WS, script: s.name, runResult });
    }
  }

  // 3. Fixture đã có script "danger" sẵn — không tạo mới, chỉ kiểm tra guard
  const listFixture = await callTool(client, "list_scripts", { workspacePath: FIXTURE_WS });
  for (const s of listFixture.scripts ?? []) {
    const guard = isDangerousCommand(s.command);
    if (!guard.allowed) {
      const runResult = await callTool(client, "run_project_script", {
        workspacePath: FIXTURE_WS,
        script: s.name,
        timeoutMs: 5000,
      });
      report.dangerousScriptRunResults.push({
        workspace: FIXTURE_WS,
        script: s.name,
        command: s.command,
        guard,
        runResult,
      });
    }
  }

  await client.close();
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
