import path from "node:path";
import fs from "node:fs";
import { MAX_OUTPUT_CHARS, SENSITIVE_FILE_PATTERNS } from "../config.js";
import {
  assertWithinWorkspace,
  validateWorkspacePath,
} from "../safety/pathGuard.js";
import { redactEnvContent, redactSecrets } from "../safety/secretRedactor.js";
import { pass, fail } from "../utils/result.js";

export interface ReadWorkspaceFileInput {
  workspacePath: string;
  relativePath: string;
  maxChars?: number;
}

export interface ReadWorkspaceFileOutput {
  status: "PASS" | "FAIL";
  workspacePath?: string;
  relativePath?: string;
  content?: string;
  truncated?: boolean;
  sizeBytes?: number;
  error?: string;
}

function isSensitiveFile(name: string): boolean {
  return SENSITIVE_FILE_PATTERNS.some((p) => p.test(name));
}

export async function readWorkspaceFile(
  input: ReadWorkspaceFileInput
): Promise<ReadWorkspaceFileOutput> {
  const validation = validateWorkspacePath(input.workspacePath);
  if (!validation.ok) {
    return fail(validation.error ?? "Invalid workspace");
  }

  const workspacePath = validation.resolvedPath!;
  const relativePath = input.relativePath.replace(/\\/g, "/");
  const maxChars = input.maxChars ?? MAX_OUTPUT_CHARS;

  try {
    const fullPath = assertWithinWorkspace(workspacePath, relativePath);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      return fail("Path is a directory, not a file", { workspacePath, relativePath });
    }

    const basename = path.basename(fullPath);
    let content = fs.readFileSync(fullPath, "utf8");

    if (basename === ".env" || basename.startsWith(".env.") || isSensitiveFile(basename)) {
      content = redactEnvContent(content);
    } else {
      content = redactSecrets(content);
    }

    const truncated = content.length > maxChars;
    if (truncated) {
      content = content.slice(0, maxChars) + `\n...[truncated]`;
    }

    return pass({
      workspacePath,
      relativePath,
      content,
      truncated,
      sizeBytes: stat.size,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return fail(message, { workspacePath, relativePath });
  }
}
