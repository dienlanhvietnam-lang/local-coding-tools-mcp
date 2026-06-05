#!/usr/bin/env node
/**
 * Local release gate CLI — validates customer pack before distribution.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runReleaseGate } from "./release-gate-lib.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function printTable(checks) {
  const maxName = Math.max(8, ...checks.map((c) => c.name.length));
  console.log("\n=== release-gate.mjs ===\n");
  console.log(`${"Check".padEnd(maxName)}  Status  Detail`);
  console.log(`${"-".repeat(maxName)}  ------  ------`);
  for (const c of checks) {
    const mark = c.status === "PASS" ? "PASS" : "FAIL";
    console.log(`${c.name.padEnd(maxName)}  ${mark.padEnd(6)}  ${c.detail}`);
  }
  console.log(`\nOVERALL: ${checks.every((c) => c.status === "PASS") ? "PASS" : "FAIL"}\n`);
}

const args = process.argv.slice(2);
const zipArg = args.find((a) => a.startsWith("--zip="))?.slice(6);
const noJson = args.includes("--no-json");

const result = await runReleaseGate(ROOT, {
  zipPath: zipArg ? path.resolve(zipArg) : undefined,
  writeJson: !noJson,
});

printTable(result.checks);
process.exit(result.overall === "PASS" ? 0 : 1);
