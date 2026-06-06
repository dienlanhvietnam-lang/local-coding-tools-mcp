#!/usr/bin/env node
/**
 * Static check: no unsafe execSync/spawn patterns in src/ (DEP0190 prevention).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "src");

const ALLOWLIST_SHELL_TRUE = new Map([
  // Empty — shell:true not allowed in src/
]);

const patterns = [
  { name: "execSync string call", re: /execSync\s*\(\s*[`'"]/ },
  { name: "exec() string call", re: /\bexec\s*\(\s*[`'"]/ },
  { name: "spawnSync string call", re: /spawnSync\s*\(\s*[`'"]/ },
  { name: "spawn with shell:true", re: /shell\s*:\s*true/ },
];

function walk(dir, files = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, files);
    else if (ent.name.endsWith(".ts")) files.push(full);
  }
  return files;
}

let ok = true;
const files = walk(SRC);

for (const file of files) {
  const rel = path.relative(ROOT, file);
  const content = fs.readFileSync(file, "utf8");
  const lines = content.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) {
      continue;
    }
    for (const p of patterns) {
      if (!p.re.test(line)) continue;
      const key = `${rel}:${i + 1}`;
      if (p.name.includes("shell:true") && ALLOWLIST_SHELL_TRUE.has(key)) {
        console.log(`○ allowlisted ${key}: ${line.trim()}`);
        continue;
      }
      console.error(`✗ ${rel}:${i + 1} — ${p.name}: ${line.trim()}`);
      ok = false;
    }
  }
}

// runCommand must exist in execSafe
const execSafe = fs.readFileSync(path.join(SRC, "utils", "execSafe.ts"), "utf8");
if (!execSafe.includes("export function runCommand")) {
  console.error("✗ execSafe.ts missing runCommand export");
  ok = false;
} else {
  console.log("✓ execSafe.ts exports runCommand");
}

if (!execSafe.includes("shell: false")) {
  console.error("✗ execSafe.ts must use shell: false");
  ok = false;
} else {
  console.log("✓ execSafe.ts uses shell: false");
}

if (!ok) {
  console.error("\ncheck-exec-hardening FAILED");
  process.exit(1);
}
console.log("\ncheck-exec-hardening PASSED");
