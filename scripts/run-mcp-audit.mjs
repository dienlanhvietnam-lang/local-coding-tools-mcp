#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const WORKSPACE = ROOT;
const SERVER = path.join(ROOT, "dist", "server.js");
const LOG_FILE = path.join(ROOT, "logs", "mcp-tool-calls.jsonl");

function parseToolResult(result) {
  const text = result?.content?.find((c) => c.type === "text")?.text ?? "{}";
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text, parseError: true };
  }
}

function statusPassFail(data) {
  if (!data || data.parseError) return "FAIL";
  const s = data.status;
  if (s === "PASS" || s === "PARTIAL" || s === "SKIPPED") return "PASS";
  if (s === "BLOCKED") return "FAIL";
  return s === "FAIL" ? "FAIL" : "FAIL";
}

async function callTool(client, name, args = {}) {
  const result = await client.callTool({ name, arguments: args });
  return parseToolResult(result);
}

async function main() {
  const report = {
    mcpLoaded: "FAIL",
    check_system: "FAIL",
    check_workspace: "FAIL",
    read_project_info: "FAIL",
    list_scripts: "FAIL",
    run_project_script: "SKIPPED",
    git_status: "FAIL",
    collect_debug_bundle: "FAIL",
    logFile: LOG_FILE,
    debugBundle: null,
    details: {},
  };

  let client;
  try {
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [SERVER],
      cwd: ROOT,
    });

    client = new Client({ name: "mcp-audit", version: "1.0.0" }, { capabilities: {} });
    await client.connect(transport);

    const tools = await client.listTools();
    if (tools.tools?.length >= 8) {
      report.mcpLoaded = "PASS";
      report.details.toolsListed = tools.tools.map((t) => t.name);
    }

    const checkSystem = await callTool(client, "check_system", {});
    report.check_system = statusPassFail(checkSystem);
    report.details.check_system = checkSystem;

    const checkWorkspace = await callTool(client, "check_workspace", { workspacePath: WORKSPACE });
    report.check_workspace = statusPassFail(checkWorkspace);
    report.details.check_workspace = checkWorkspace;

    const readProjectInfo = await callTool(client, "read_project_info", { workspacePath: WORKSPACE });
    report.read_project_info = statusPassFail(readProjectInfo);
    report.details.read_project_info = readProjectInfo;

    const listScripts = await callTool(client, "list_scripts", { workspacePath: WORKSPACE });
    report.list_scripts = statusPassFail(listScripts);
    report.details.list_scripts = listScripts;

    const scriptNames = (listScripts.scripts ?? []).map((s) => s.name);
    let scriptToRun = null;
    if (scriptNames.includes("build")) scriptToRun = "build";
    else if (scriptNames.includes("test")) scriptToRun = "test";

    if (scriptToRun) {
      const runResult = await callTool(client, "run_project_script", {
        workspacePath: WORKSPACE,
        script: scriptToRun,
        timeoutMs: 120000,
      });
      report.run_project_script = runResult.status === "PASS" ? "PASS" : "FAIL";
      report.details.run_project_script = { script: scriptToRun, ...runResult };
    } else {
      report.run_project_script = "SKIPPED";
      report.details.run_project_script = { reason: "no build or test script" };
    }

    const gitStatus = await callTool(client, "git_status", { workspacePath: WORKSPACE });
    report.git_status = statusPassFail(gitStatus);
    report.details.git_status = gitStatus;

    const debugBundle = await callTool(client, "collect_debug_bundle", { workspacePath: WORKSPACE });
    report.collect_debug_bundle = statusPassFail(debugBundle);
    report.details.collect_debug_bundle = debugBundle;
    if (debugBundle.bundlePath) report.debugBundle = debugBundle.bundlePath;

    await client.close();
  } catch (err) {
    report.details.error = err instanceof Error ? err.message : String(err);
  }

  console.log(JSON.stringify(report, null, 2));
}

main();
