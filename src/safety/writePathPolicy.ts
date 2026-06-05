import path from "node:path";
import { SENSITIVE_FILE_PATTERNS } from "../config.js";

/** Directory prefixes where writing is allowed (v0.3 expanded for coding workflows). */
export const ALLOWLIST_PREFIXES = [
  ".mcp-debug/",
  "docs/",
  "tests/",
  "src/",
  "scripts/",
  "examples/",
  ".cursor/",
  ".vscode/",
  ".github/",
  "packages/",
  "apps/",
  "libs/",
  "bin/",
  "public/",
  "assets/",
];

/** Exact root-level files allowed. */
export const ALLOWLIST_FILES = new Set([
  "README.md",
  "CHANGELOG.md",
  "package.json",
  "package-lock.json",
  "pnpm-lock.yaml",
  "tsconfig.json",
  "vitest.config.ts",
  ".gitignore",
  "LICENSE",
  "LICENSE.md",
]);

/** Regex patterns for allowed paths beyond prefix/file rules. */
export const ALLOWLIST_PATH_PATTERNS = [
  /^[^/]+\.md$/i,
  /^[^/]+\.json$/i,
  /^[^/]+\.ya?ml$/i,
  /^packages\/[^/]+\/.+/i,
  /^apps\/[^/]+\/.+/i,
  /^libs\/[^/]+\/.+/i,
];

/** Paths never writable regardless of allowlist. */
export const RESTRICTED_PATH_PATTERNS = [
  /^node_modules\//i,
  /^\.git\//i,
  /^dist\//i,
  /^build\//i,
  /^coverage\//i,
  /^\.env$/i,
  /^\.env\..+$/i,
  /\.pem$/i,
  /\.key$/i,
  /credentials/i,
  /\/tokens?\./i,
  /\/secrets?\./i,
  /\bsecret\b/i,
];

export type WritePathDecision =
  | { allowed: true }
  | { allowed: false; reason: "path_traversal" | "sensitive_file" | "restricted_write_path" };

export function normalizeRelativePath(input: string): string {
  return input.replace(/\\/g, "/").replace(/^\.\//, "");
}

const BLOCKED_BASENAMES = [
  /^credentials/i,
  /^tokens?\.(json|ya?ml|txt)$/i,
  /^secrets?\.(json|ya?ml|txt)$/i,
  /^\.env/i,
  /\.pem$/i,
  /\.key$/i,
];

export function isSensitiveBasename(name: string): boolean {
  if (SENSITIVE_FILE_PATTERNS.some((p) => p.test(name))) return true;
  return BLOCKED_BASENAMES.some((p) => p.test(name));
}

export function isRestrictedPath(relativePath: string): boolean {
  return RESTRICTED_PATH_PATTERNS.some((p) => p.test(relativePath));
}

export function isAllowedPath(relativePath: string): boolean {
  if (ALLOWLIST_FILES.has(relativePath)) return true;
  if (ALLOWLIST_PREFIXES.some((prefix) => relativePath.startsWith(prefix))) return true;
  return ALLOWLIST_PATH_PATTERNS.some((p) => p.test(relativePath));
}

export function evaluateWritePath(relativePathInput: string): WritePathDecision {
  const relativePath = normalizeRelativePath(relativePathInput);

  if (relativePath.includes("..")) {
    return { allowed: false, reason: "path_traversal" };
  }

  const basename = path.basename(relativePath);
  if (isSensitiveBasename(basename)) {
    return { allowed: false, reason: "sensitive_file" };
  }

  if (isRestrictedPath(relativePath)) {
    return { allowed: false, reason: "restricted_write_path" };
  }

  if (!isAllowedPath(relativePath)) {
    return { allowed: false, reason: "restricted_write_path" };
  }

  return { allowed: true };
}
