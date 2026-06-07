import path from "node:path";
import fs from "node:fs";
import { validateWorkspacePath } from "../safety/pathGuard.js";
import {
  emptyTokens,
  mergeTokens,
  parseFileTokens,
  type DesignTokens,
} from "../utils/designTokenParser.js";
import { pass, fail } from "../utils/result.js";

export interface ExtractDesignTokensInput {
  workspacePath: string;
  sources?: string[];
}

export interface ExtractDesignTokensOutput {
  status: "PASS" | "FAIL";
  workspacePath?: string;
  tokens?: DesignTokens;
  fileCount?: number;
  error?: string;
}

function expandSources(workspacePath: string, patterns: string[]): string[] {
  const files: string[] = [];
  const defaults = [
    "**/*.css",
    "tailwind.config.ts",
    "tailwind.config.js",
    "src/theme.ts",
    "src/theme/index.ts",
    "src/styles/**/*.css",
  ];
  const globs = patterns.length > 0 ? patterns : defaults;

  function walk(dir: string, pattern: string): void {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      if (entry.isDirectory()) {
        if (pattern.includes("**")) walk(full, pattern);
        continue;
      }
      const rel = path.relative(workspacePath, full).replace(/\\/g, "/");
      if (pattern.includes("**")) {
        const suffix = pattern.split("**").pop() ?? "";
        if (rel.endsWith(suffix.replace(/^\//, "")) || pattern === "**/*.css" && rel.endsWith(".css")) {
          files.push(full);
        }
      } else if (rel === pattern || rel.endsWith(pattern)) {
        files.push(full);
      }
    }
  }

  for (const g of globs) {
    if (g.includes("**")) {
      walk(workspacePath, g);
    } else {
      const full = path.resolve(workspacePath, g);
      if (fs.existsSync(full) && fs.statSync(full).isFile()) files.push(full);
    }
  }

  return [...new Set(files)];
}

export async function extractDesignTokens(
  input: ExtractDesignTokensInput
): Promise<ExtractDesignTokensOutput> {
  const validation = validateWorkspacePath(input.workspacePath);
  if (!validation.ok) return fail(validation.error ?? "Invalid workspace");

  const workspacePath = validation.resolvedPath!;
  const sourceFiles = expandSources(workspacePath, input.sources ?? []);

  if (sourceFiles.length === 0) {
    return pass({
      workspacePath,
      tokens: emptyTokens(),
      fileCount: 0,
    });
  }

  let tokens = emptyTokens();
  for (const file of sourceFiles) {
    try {
      const partial = parseFileTokens(file);
      const rel = path.relative(workspacePath, file).replace(/\\/g, "/");
      tokens = mergeTokens(tokens, partial, rel);
    } catch {
      // skip unreadable
    }
  }

  return pass({
    workspacePath,
    tokens,
    fileCount: sourceFiles.length,
  });
}
