import path from "node:path";
import fs from "node:fs";
import {
  assertWithinWorkspace,
  validateWorkspacePath,
} from "../safety/pathGuard.js";
import { evaluateWritePath } from "../safety/writePathPolicy.js";
import { pass, fail, blocked } from "../utils/result.js";

export interface WriteWorkspaceFileInput {
  workspacePath: string;
  relativePath: string;
  content: string;
  createDirs?: boolean;
}

export interface WriteWorkspaceFileOutput {
  status: "PASS" | "FAIL" | "BLOCKED";
  workspacePath?: string;
  relativePath?: string;
  bytesWritten?: number;
  error?: string;
}

// Re-export policy for tests and docs
export {
  ALLOWLIST_PREFIXES,
  ALLOWLIST_FILES,
  RESTRICTED_PATH_PATTERNS,
  evaluateWritePath,
  isAllowedPath,
  isRestrictedPath,
} from "../safety/writePathPolicy.js";

export async function writeWorkspaceFile(
  input: WriteWorkspaceFileInput
): Promise<WriteWorkspaceFileOutput> {
  const validation = validateWorkspacePath(input.workspacePath);
  if (!validation.ok) {
    return fail(validation.error ?? "Invalid workspace");
  }

  const workspacePath = validation.resolvedPath!;
  const relativePath = input.relativePath.replace(/\\/g, "/");

  const decision = evaluateWritePath(relativePath);
  if (!decision.allowed) {
    if (decision.reason === "sensitive_file") {
      return blocked(
        `Writing to sensitive file is blocked (.env, credentials, keys, tokens)`
      ) as WriteWorkspaceFileOutput;
    }
    return blocked(
      decision.reason === "path_traversal" ? "path_traversal" : "restricted_write_path"
    ) as WriteWorkspaceFileOutput;
  }

  try {
    const fullPath = assertWithinWorkspace(workspacePath, relativePath);
    if (input.createDirs !== false) {
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    }
    fs.writeFileSync(fullPath, input.content, "utf8");

    return pass({
      workspacePath,
      relativePath,
      bytesWritten: Buffer.byteLength(input.content, "utf8"),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return fail(message, { workspacePath, relativePath });
  }
}
