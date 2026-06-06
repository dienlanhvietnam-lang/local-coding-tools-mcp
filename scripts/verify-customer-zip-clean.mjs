#!/usr/bin/env node
/**
 * Clean ZIP verification: extract → npm install → build → smoke → verify → pilot-stdio.
 * Uses spawnSync with shell:false (no DEP0190).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runCli } from "./run-cli.mjs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { EXPECTED_TOOL_COUNT } from "./expected-tools.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const args = process.argv.slice(2);
const keep = args.includes("--keep");
const zipArg = args.find((a) => !a.startsWith("--"));

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
const defaultZip = path.join(
  ROOT,
  "release",
  `local-coding-tools-mcp-v${pkg.version}-customer.zip`,
);
const zipPath = zipArg ? path.resolve(zipArg) : defaultZip;

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const extractDir = path.join(ROOT, "release", `verify-clean-${stamp}`);

const report = {
  zipPath,
  extractDir,
  steps: {},
  toolsList: { status: "FAIL", count: 0 },
  run_coding_session: { status: "FAIL" },
  overall: "FAIL",
};

function run(command, args, cwd, label) {
  const result = runCli(command, args, { cwd });
  if (result.status === "PASS") {
    report.steps[label] = { status: "PASS" };
    return true;
  }
  report.steps[label] = {
    status: "FAIL",
    exitCode: result.exitCode,
    stderr: (result.stderr || result.error || "").slice(0, 500),
  };
  return false;
}

function parseToolResult(result) {
  const text = result?.content?.find((c) => c.type === "text")?.text ?? "{}";
  try {
    return JSON.parse(text);
  } catch {
    return { status: "FAIL" };
  }
}

function zipForbiddenScan(buf) {
  const text = buf.toString("binary");
  const patterns = [
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
  return patterns.filter(([re]) => re.test(text)).map(([, name]) => name);
}

let ok = true;

console.log("\n=== verify-customer-zip-clean.mjs ===");
console.log("ZIP:", zipPath);

if (!fs.existsSync(zipPath)) {
  report.steps.zipExists = { status: "FAIL", error: "ZIP not found" };
  ok = false;
} else {
  report.steps.zipExists = { status: "PASS" };
  const forbidden = zipForbiddenScan(fs.readFileSync(zipPath));
  report.steps.zipForbiddenScan = {
    status: forbidden.length === 0 ? "PASS" : "FAIL",
    found: forbidden,
  };
  if (forbidden.length) ok = false;

  fs.mkdirSync(extractDir, { recursive: true });
  let extractOk = false;
  if (process.platform === "win32") {
    const ps = runCli("powershell", [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      `Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${extractDir.replace(/'/g, "''")}' -Force`,
    ]);
    extractOk = ps.status === "PASS";
  } else {
    const uz = runCli("unzip", ["-q", "-o", zipPath, "-d", extractDir]);
    extractOk = uz.status === "PASS";
  }
  report.steps.extract = extractOk
    ? { status: "PASS", path: extractDir }
    : { status: "FAIL", path: extractDir };
  if (!extractOk) ok = false;

  ok = run("npm", ["install"], extractDir, "npm install") && ok;
  ok = run("npm", ["run", "build"], extractDir, "npm run build") && ok;
  ok = run("npm", ["run", "smoke"], extractDir, "npm run smoke") && ok;
  ok = run("npm", ["run", "verify"], extractDir, "npm run verify") && ok;

  const pilotScript = path.join(extractDir, "scripts", "pilot-stdio.mjs");
  const workspacePath = path.join(extractDir, "tests", "fixtures", "sample-project");
  const pilotWorkspace = fs.existsSync(workspacePath) ? workspacePath : extractDir;

  if (fs.existsSync(pilotScript)) {
    try {
      const pilotResult = runCli("node", [pilotScript, pilotWorkspace], { cwd: extractDir });
      const out = pilotResult.stdout;
      if (pilotResult.status !== "PASS" && !out) {
        throw new Error(pilotResult.error || pilotResult.stderr || "pilot-stdio failed");
      }
      const pilot = JSON.parse(out);
      report.steps.pilotStdio = {
        status:
          pilot.initialize === "PASS" &&
          pilot.toolsList === "PASS" &&
          pilot.check_system === "PASS" &&
          pilot.run_coding_session === "PASS"
            ? "PASS"
            : "FAIL",
        detail: pilot,
      };
      report.toolsList = { status: pilot.toolsList, count: pilot.toolCount };
      report.run_coding_session = {
        status: pilot.run_coding_session,
        workspace: pilotWorkspace,
      };
      if (report.steps.pilotStdio.status !== "PASS") ok = false;
    } catch (err) {
      const e = err;
      report.steps.pilotStdio = {
        status: "FAIL",
        stderr: (e.stderr || e.message || "").slice(0, 500),
      };
      ok = false;
    }
  } else {
    // Fallback: direct stdio client
    try {
      const server = path.join(extractDir, "dist", "server.js");
      const transport = new StdioClientTransport({
        command: process.execPath,
        args: [server],
        cwd: extractDir,
      });
      const client = new Client({ name: "verify-clean", version: "1.0" }, { capabilities: {} });
      await client.connect(transport);
      const tools = await client.listTools();
      const count = tools.tools?.length ?? 0;
      report.toolsList = { status: count === EXPECTED_TOOL_COUNT ? "PASS" : "FAIL", count };
      const rs = parseToolResult(
        await client.callTool({
          name: "run_coding_session",
          arguments: { workspacePath: pilotWorkspace, runScript: true, collectBundle: false },
        }),
      );
      report.run_coding_session = {
        status: rs.status === "PASS" || rs.status === "PARTIAL" ? "PASS" : "FAIL",
        workspace: pilotWorkspace,
      };
      report.steps.pilotStdio = {
        status:
          count === EXPECTED_TOOL_COUNT && report.run_coding_session.status === "PASS"
            ? "PASS"
            : "FAIL",
      };
      await client.close();
      if (report.steps.pilotStdio.status !== "PASS") ok = false;
    } catch (err) {
      report.steps.pilotStdio = {
        status: "FAIL",
        error: err instanceof Error ? err.message : String(err),
      };
      ok = false;
    }
  }

  if (!keep) {
    try {
      fs.rmSync(extractDir, { recursive: true, force: true });
      report.steps.cleanup = { status: "PASS", kept: false };
    } catch (err) {
      report.steps.cleanup = {
        status: "FAIL",
        error: err instanceof Error ? err.message : String(err),
      };
    }
  } else {
    report.steps.cleanup = { status: "PASS", kept: true, path: extractDir };
  }
}

report.overall = ok ? "PASS" : "FAIL";

console.log("\n--- TEXT SUMMARY ---");
for (const [name, step] of Object.entries(report.steps)) {
  const st = step.status ?? "FAIL";
  const color = st === "PASS" ? "\x1b[32m" : "\x1b[31m";
  console.log(`${color}${st}\x1b[0m  ${name}`);
}
console.log(`tools/list: ${report.toolsList.count} tools — ${report.toolsList.status}`);
console.log(`run_coding_session: ${report.run_coding_session.status}`);
console.log(`\nOVERALL: ${report.overall}`);

console.log("\n--- JSON REPORT ---");
console.log(JSON.stringify(report, null, 2));

process.exit(ok ? 0 : 1);
