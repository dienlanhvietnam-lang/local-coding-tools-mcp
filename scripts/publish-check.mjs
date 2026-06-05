#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
const checks = [];

function ok(msg) {
  checks.push({ ok: true, msg });
  console.log(`✓ ${msg}`);
}
function fail(msg) {
  checks.push({ ok: false, msg });
  console.error(`✗ ${msg}`);
}

if (fs.existsSync(path.join(ROOT, "dist", "server.js"))) ok("dist/server.js");
else fail("dist/server.js missing — run npm run build");

if (fs.existsSync(path.join(ROOT, "LICENSE"))) ok("LICENSE");
else fail("LICENSE missing");

if (pkg.bin?.["local-coding-tools-mcp"]) ok("bin entry");
else fail("bin entry missing");

if (pkg.files?.includes("dist")) ok("files includes dist");
else fail("files must include dist");

if (pkg.repository?.url) ok("repository.url set");
else fail("repository.url missing");

const npmignore = fs.readFileSync(path.join(ROOT, ".npmignore"), "utf8");
if (npmignore.includes("tests/")) ok(".npmignore excludes tests");
else fail(".npmignore should exclude tests");

const failed = checks.filter((c) => !c.ok);
if (failed.length) {
  console.error("\nPublish check FAILED");
  process.exit(1);
}
console.log("\nPublish check PASSED — ready for: npm publish --access public");
