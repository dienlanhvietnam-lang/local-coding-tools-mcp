import fs from "node:fs";
import { assertWithinWorkspace, validateWorkspacePath } from "../safety/pathGuard.js";
import { pass, fail } from "../utils/result.js";

export interface CreateDirectoryInput {
  workspacePath: string;
  relativePath: string;
}

export interface CreateDirectoryOutput {
  status: "PASS" | "FAIL";
  workspacePath?: string;
  relativePath?: string;
  created?: boolean;
  alreadyExisted?: boolean;
  error?: string;
}

export async function createDirectory(
  input: CreateDirectoryInput
): Promise<CreateDirectoryOutput> {
  const validation = validateWorkspacePath(input.workspacePath);
  if (!validation.ok) {
    return fail(validation.error ?? "Invalid workspace");
  }

  const workspacePath = validation.resolvedPath!;
  const relativePath = input.relativePath.replace(/\\/g, "/");

  try {
    const fullPath = assertWithinWorkspace(workspacePath, relativePath);
    const alreadyExisted = fs.existsSync(fullPath);
    if (alreadyExisted && !fs.statSync(fullPath).isDirectory()) {
      return fail("Path exists and is not a directory", { workspacePath, relativePath });
    }
    fs.mkdirSync(fullPath, { recursive: true });
    return pass({
      workspacePath,
      relativePath,
      created: !alreadyExisted,
      alreadyExisted,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return fail(message, { workspacePath, relativePath });
  }
}
