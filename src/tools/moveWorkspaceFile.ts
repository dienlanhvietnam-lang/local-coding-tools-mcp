import path from "node:path";
import fs from "node:fs";
import { assertWithinWorkspace, validateWorkspacePath } from "../safety/pathGuard.js";
import { pass, fail } from "../utils/result.js";

export interface MoveWorkspaceFileInput {
  workspacePath: string;
  fromRelativePath: string;
  toRelativePath: string;
  createDirs?: boolean;
}

export interface MoveWorkspaceFileOutput {
  status: "PASS" | "FAIL";
  workspacePath?: string;
  fromRelativePath?: string;
  toRelativePath?: string;
  error?: string;
}

export async function moveWorkspaceFile(
  input: MoveWorkspaceFileInput
): Promise<MoveWorkspaceFileOutput> {
  const validation = validateWorkspacePath(input.workspacePath);
  if (!validation.ok) {
    return fail(validation.error ?? "Invalid workspace");
  }

  const workspacePath = validation.resolvedPath!;
  const fromRelativePath = input.fromRelativePath.replace(/\\/g, "/");
  const toRelativePath = input.toRelativePath.replace(/\\/g, "/");

  try {
    const fromPath = assertWithinWorkspace(workspacePath, fromRelativePath);
    const toPath = assertWithinWorkspace(workspacePath, toRelativePath);

    if (!fs.existsSync(fromPath)) {
      return fail("Source path does not exist", { workspacePath, fromRelativePath, toRelativePath });
    }

    if (input.createDirs !== false) {
      fs.mkdirSync(path.dirname(toPath), { recursive: true });
    }

    fs.renameSync(fromPath, toPath);
    return pass({ workspacePath, fromRelativePath, toRelativePath });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return fail(message, { workspacePath, fromRelativePath, toRelativePath });
  }
}
