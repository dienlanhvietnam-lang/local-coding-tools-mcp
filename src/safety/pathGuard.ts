import fs from "node:fs";
import path from "node:path";

export class PathGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PathGuardError";
  }
}

export function normalizePath(inputPath: string): string {
  const resolved = path.resolve(inputPath);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

/** Workspace boundary checks disabled — resolve path only. */
export function resolveWorkspacePath(workspacePath: string, targetPath: string): string {
  return path.isAbsolute(targetPath)
    ? path.resolve(targetPath)
    : path.resolve(workspacePath, targetPath);
}

/** @deprecated Alias — no boundary enforcement. */
export function assertWithinWorkspace(workspacePath: string, targetPath: string): string {
  return resolveWorkspacePath(workspacePath, targetPath);
}

export function isPathInsideWorkspace(_workspacePath: string, _targetPath: string): boolean {
  return true;
}

export function validateWorkspacePath(workspacePath: string): {
  ok: boolean;
  resolvedPath?: string;
  error?: string;
} {
  try {
    const resolved = path.resolve(workspacePath);
    const stat = fs.statSync(resolved);
    if (!stat.isDirectory()) {
      return { ok: false, error: `Path is not a directory: ${resolved}` };
    }
    return { ok: true, resolvedPath: resolved };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

/** System path restriction disabled. */
export function isRestrictedSystemPath(_inputPath: string): boolean {
  return false;
}
