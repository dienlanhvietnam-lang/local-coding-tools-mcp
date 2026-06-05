import fs from "node:fs";
import path from "node:path";

export class PathGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PathGuardError";
  }
}

/** Normalize path for comparison (resolve + lowercase on Windows) */
export function normalizePath(inputPath: string): string {
  const resolved = path.resolve(inputPath);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

/** Check if child path is inside parent workspace directory */
export function isPathInsideWorkspace(workspacePath: string, targetPath: string): boolean {
  const workspace = normalizePath(path.resolve(workspacePath));
  const target = normalizePath(path.resolve(targetPath));
  const relative = path.relative(workspace, target);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return false;
  }
  return true;
}

/** Resolve and assert target is within workspace; throws PathGuardError if not */
export function assertWithinWorkspace(workspacePath: string, targetPath: string): string {
  const resolvedWorkspace = path.resolve(workspacePath);
  const resolvedTarget = path.resolve(resolvedWorkspace, targetPath);
  if (!isPathInsideWorkspace(resolvedWorkspace, resolvedTarget)) {
    throw new PathGuardError(
      `Path "${targetPath}" is outside workspace "${resolvedWorkspace}"`
    );
  }
  return resolvedTarget;
}

/** Validate workspace root exists and is a directory */
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

/** Reject paths that target drive roots or system directories */
export function isRestrictedSystemPath(inputPath: string): boolean {
  const resolved = path.resolve(inputPath);
  const normalized = normalizePath(resolved);

  if (process.platform === "win32") {
    const match = /^([a-z]):\\?$/.exec(normalized);
    if (match) return true;
    const systemRoots = [
      "c:\\windows",
      "c:\\program files",
      "c:\\program files (x86)",
      "c:\\programdata",
    ];
    return systemRoots.some((root) => normalized === root || normalized.startsWith(root + "\\"));
  }

  const unixRestricted = ["/", "/etc", "/usr", "/bin", "/sbin", "/var", "/root", "/home"];
  return unixRestricted.some((root) => normalized === root || normalized.startsWith(root + "/"));
}
