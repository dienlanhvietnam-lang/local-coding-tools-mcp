#!/usr/bin/env node
/**
 * Basic CI workflow validation (no GitHub API required).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const ciPath = path.join(ROOT, ".github", "workflows", "ci.yml");

const REQUIRED_SNIPPETS = [
  "windows-latest",
  'node-version: "24"',
  "npm run build",
  "npm test",
  "npm run smoke",
  "npm run verify",
  "npm run verify:image-core",
  "npm run release:customer",
  "npm run verify:customer-zip",
  "npm run release:gate",
  "actions/upload-artifact",
  "continue-on-error: true",
  "check-image-deps.mjs --profile full-image",
];

let ok = true;

if (!fs.existsSync(ciPath)) {
  console.error("✗ .github/workflows/ci.yml missing");
  process.exit(1);
}

const content = fs.readFileSync(ciPath, "utf8");

for (const snippet of REQUIRED_SNIPPETS) {
  if (content.includes(snippet)) {
    console.log(`✓ contains: ${snippet}`);
  } else {
    console.error(`✗ missing: ${snippet}`);
    ok = false;
  }
}

if (!content.includes("verify:image-full")) {
  console.log("✓ verify:image-full not required in CI");
} else if (/run:\s*npm run verify:image-full/.test(content)) {
  console.error("✗ verify:image-full must not be a required CI step");
  ok = false;
}

if (!ok) {
  console.error("\nvalidate-ci-yaml FAILED");
  process.exit(1);
}

console.log("\nvalidate-ci-yaml PASSED");
