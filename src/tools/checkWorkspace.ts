import fs from "node:fs";
import {
  validateWorkspacePath,
  isRestrictedSystemPath,
  normalizePath,
} from "../safety/pathGuard.js";
import { pass, fail } from "../utils/result.js";

export interface CheckWorkspaceInput {
  workspacePath: string;
}

export interface CheckWorkspaceOutput {
  status: "PASS" | "FAIL";
  workspacePath?: string;
  exists?: boolean;
  readable?: boolean;
  restricted?: boolean;
  error?: string;
}

export async function checkWorkspace(input: CheckWorkspaceInput): Promise<CheckWorkspaceOutput> {
  const { workspacePath } = input;

  if (isRestrictedSystemPath(workspacePath)) {
    return {
      status: "FAIL",
      error: "Workspace path points to a restricted system location",
      restricted: true,
    };
  }

  const validation = validateWorkspacePath(workspacePath);
  if (!validation.ok) {
    return fail(validation.error ?? "Workspace not found", {
      workspacePath: normalizePath(workspacePath),
      exists: false,
    });
  }

  const resolved = validation.resolvedPath!;
  let readable = false;
  try {
    fs.accessSync(resolved, fs.constants.R_OK);
    readable = true;
  } catch {
    readable = false;
  }

  return pass({
    workspacePath: resolved,
    exists: true,
    readable,
    restricted: false,
  });
}
