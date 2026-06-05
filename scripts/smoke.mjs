#!/usr/bin/env node
/**
 * Smoke test: invoke tool handlers directly (no stdio MCP handshake).
 */
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const FIXTURE = path.join(ROOT, "tests", "fixtures", "sample-project");

async function importDist(modulePath) {
  const url = pathToFileURL(path.join(ROOT, "dist", modulePath)).href;
  return import(url);
}

const { checkSystem } = await importDist("tools/checkSystem.js");
const { checkWorkspace } = await importDist("tools/checkWorkspace.js");
const { readProjectInfo } = await importDist("tools/readProjectInfo.js");
const { listScripts } = await importDist("tools/listScripts.js");
const { runProjectScript } = await importDist("tools/runProjectScript.js");

const checks = [];

async function run(name, fn) {
  try {
    await fn();
    checks.push({ name, ok: true });
    console.log(`✓ ${name}`);
  } catch (err) {
    checks.push({ name, ok: false, error: err instanceof Error ? err.message : String(err) });
    console.error(`✗ ${name}:`, err);
  }
}

await run("check_system", async () => {
  const r = await checkSystem();
  if (!r.tools?.node?.ok) throw new Error("node not available");
});

await run("check_workspace", async () => {
  const r = await checkWorkspace({ workspacePath: FIXTURE });
  if (r.status !== "PASS") throw new Error(JSON.stringify(r));
});

await run("read_project_info", async () => {
  const r = await readProjectInfo({ workspacePath: FIXTURE });
  if (!r.frameworks?.includes("vite")) throw new Error("framework detection failed");
});

await run("list_scripts", async () => {
  const r = await listScripts({ workspacePath: FIXTURE });
  if (!r.scripts?.length) throw new Error("no scripts");
});

await run("run_project_script build", async () => {
  const r = await runProjectScript({ workspacePath: FIXTURE, script: "build", timeoutMs: 15000 });
  if (r.status !== "PASS") throw new Error(JSON.stringify(r));
});

await run("run_project_script blocked", async () => {
  const r = await runProjectScript({ workspacePath: FIXTURE, script: "danger", timeoutMs: 5000 });
  if (r.status !== "BLOCKED") throw new Error("expected BLOCKED");
});

const failed = checks.filter((c) => !c.ok);
if (failed.length) {
  console.error("\nSmoke FAILED:", failed.length, "check(s)");
  process.exit(1);
}
console.log("\nSmoke PASSED:", checks.length, "checks");
