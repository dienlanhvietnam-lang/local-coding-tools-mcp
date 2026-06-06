#!/usr/bin/env node
/**
 * Smoke: image dependency scripts exist + exit codes for profiles.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runCli } from "./run-cli.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const requiredFiles = [
  "scripts/check-image-deps.ps1",
  "scripts/check-image-deps.mjs",
  "scripts/install-image-deps.ps1",
  "scripts/verify-full-image-local.ps1",
  "scripts/verify-image-profile.mjs",
  "docs/HUONG-DAN-FULL-IMAGE.md",
];

let ok = true;

for (const rel of requiredFiles) {
  const full = path.join(ROOT, rel);
  if (fs.existsSync(full)) {
    console.log(`✓ ${rel}`);
  } else {
    console.error(`✗ missing ${rel}`);
    ok = false;
  }
}

const installPs1 = fs.readFileSync(path.join(ROOT, "scripts/install-image-deps.ps1"), "utf8");
if (!installPs1.includes("CheckOnly") || !installPs1.includes("-Yes")) {
  console.error("✗ install-image-deps.ps1 missing CheckOnly/Yes");
  ok = false;
} else {
  console.log("✓ install-image-deps.ps1 CheckOnly + Yes");
}

const verifyPs1 = fs.readFileSync(path.join(ROOT, "scripts/verify-full-image-local.ps1"), "utf8");
if (!verifyPs1.includes("RequireFullImage") || !verifyPs1.includes("Usage:")) {
  console.error("✗ verify-full-image-local.ps1 missing RequireFullImage/help");
  ok = false;
} else {
  console.log("✓ verify-full-image-local.ps1 RequireFullImage + usage");
}

function runMjs(profile) {
  const mjs = path.join(ROOT, "scripts/check-image-deps.mjs");
  const result = runCli("node", [mjs, "--profile", profile, "--json"], { cwd: ROOT });
  return result.exitCode ?? 1;
}

const coreExit = runMjs("image-core");
if (coreExit === 0) {
  console.log("✓ check-image-deps.mjs image-core exit 0");
} else {
  console.error(`✗ check-image-deps.mjs image-core exit ${coreExit} (expected 0)`);
  ok = false;
}

const fullExit = runMjs("full-image");
if (fullExit === 1) {
  console.log("✓ check-image-deps.mjs full-image exit 1 (missing deps OK)");
} else if (fullExit === 0) {
  console.log("○ check-image-deps.mjs full-image exit 0 (all deps present on machine)");
} else {
  console.error(`✗ check-image-deps.mjs full-image unexpected exit ${fullExit}`);
  ok = false;
}

if (!ok) {
  console.error("\nimage-deps-smoke FAILED");
  process.exit(1);
}
console.log("\nimage-deps-smoke PASSED");
