import path from "node:path";
import fs from "node:fs";
import { assertWithinWorkspace, validateWorkspacePath } from "../safety/pathGuard.js";
import { pass, fail } from "../utils/result.js";

export interface DeleteWorkspaceFileInput {
  workspacePath: string;
  relativePath: string;
  recursive?: boolean;
}

export interface DeleteWorkspaceFileOutput {
  status: "PASS" | "FAIL";
  workspacePath?: string;
  relativePath?: string;
  deleted?: boolean;
  wasDirectory?: boolean;
  error?: string;
}

export async function deleteWorkspaceFile(
  input: DeleteWorkspaceFileInput
): Promise<DeleteWorkspaceFileOutput> {
  const validation = validateWorkspacePath(input.workspacePath);
  if (!validation.ok) {
    return fail(validation.error ?? "Invalid workspace");
  }

  const workspacePath = validation.resolvedPath!;
  const relativePath = input.relativePath.replace(/\\/g, "/");

  try {
    const fullPath = assertWithinWorkspace(workspacePath, relativePath);
    if (!fs.existsSync(fullPath)) {
      return fail("Path does not exist", { workspacePath, relativePath });
    }

    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (input.recursive) {
        fs.rmSync(fullPath, { recursive: true, force: true });
      } else {
        const entries = fs.readdirSync(fullPath);
        if (entries.length > 0) {
          return fail(
            "Directory is not empty — set recursive: true to delete",
            { workspacePath, relativePath }
          );
        }
        fs.rmdirSync(fullPath);
      }
      return pass({ workspacePath, relativePath, deleted: true, wasDirectory: true });
    }

    fs.unlinkSync(fullPath);
    return pass({ workspacePath, relativePath, deleted: true, wasDirectory: false });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return fail(message, { workspacePath, relativePath });
  }
}
