import fs from "node:fs";
import { assertWithinWorkspace, validateWorkspacePath } from "../safety/pathGuard.js";
import { pass, fail } from "../utils/result.js";

export interface FileStatsInput {
  workspacePath: string;
  relativePath: string;
}

export interface FileStatsOutput {
  status: "PASS" | "FAIL";
  workspacePath?: string;
  relativePath?: string;
  exists?: boolean;
  isFile?: boolean;
  isDirectory?: boolean;
  sizeBytes?: number;
  mode?: string;
  createdAt?: string;
  modifiedAt?: string;
  error?: string;
}

export async function fileStats(input: FileStatsInput): Promise<FileStatsOutput> {
  const validation = validateWorkspacePath(input.workspacePath);
  if (!validation.ok) {
    return fail(validation.error ?? "Invalid workspace");
  }

  const workspacePath = validation.resolvedPath!;
  const relativePath = input.relativePath.replace(/\\/g, "/");

  try {
    const fullPath = assertWithinWorkspace(workspacePath, relativePath);
    if (!fs.existsSync(fullPath)) {
      return pass({ workspacePath, relativePath, exists: false });
    }
    const stat = fs.statSync(fullPath);
    return pass({
      workspacePath,
      relativePath,
      exists: true,
      isFile: stat.isFile(),
      isDirectory: stat.isDirectory(),
      sizeBytes: stat.size,
      mode: (stat.mode & 0o777).toString(8),
      createdAt: stat.birthtime.toISOString(),
      modifiedAt: stat.mtime.toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return fail(message, { workspacePath, relativePath });
  }
}
