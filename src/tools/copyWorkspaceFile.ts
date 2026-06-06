import path from "node:path";
import fs from "node:fs";
import { assertWithinWorkspace, validateWorkspacePath } from "../safety/pathGuard.js";
import { pass, fail } from "../utils/result.js";

export interface CopyWorkspaceFileInput {
  workspacePath: string;
  fromRelativePath: string;
  toRelativePath: string;
  overwrite?: boolean;
}

export interface CopyWorkspaceFileOutput {
  status: "PASS" | "FAIL";
  workspacePath?: string;
  fromRelativePath?: string;
  toRelativePath?: string;
  wasDirectory?: boolean;
  error?: string;
}

export async function copyWorkspaceFile(
  input: CopyWorkspaceFileInput
): Promise<CopyWorkspaceFileOutput> {
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
      return fail("Source does not exist", { workspacePath, fromRelativePath, toRelativePath });
    }
    if (fs.existsSync(toPath) && input.overwrite === false) {
      return fail("Destination exists — set overwrite: true", { workspacePath, fromRelativePath, toRelativePath });
    }

    const stat = fs.statSync(fromPath);
    fs.mkdirSync(path.dirname(toPath), { recursive: true });
    fs.cpSync(fromPath, toPath, {
      recursive: stat.isDirectory(),
      force: input.overwrite !== false,
    });

    return pass({
      workspacePath,
      fromRelativePath,
      toRelativePath,
      wasDirectory: stat.isDirectory(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return fail(message, { workspacePath, fromRelativePath, toRelativePath });
  }
}
