import fs from "node:fs";
import path from "node:path";
import { assertWithinWorkspace, validateWorkspacePath } from "../safety/pathGuard.js";

export function readFileInWorkspace(
  workspacePath: string,
  relativePath: string,
  encoding: BufferEncoding = "utf8"
): string {
  const fullPath = assertWithinWorkspace(workspacePath, relativePath);
  return fs.readFileSync(fullPath, encoding);
}

export function fileExistsInWorkspace(workspacePath: string, relativePath: string): boolean {
  try {
    const fullPath = assertWithinWorkspace(workspacePath, relativePath);
    return fs.existsSync(fullPath);
  } catch {
    return false;
  }
}

export function readJsonInWorkspace<T = unknown>(
  workspacePath: string,
  relativePath: string
): T | null {
  try {
    const content = readFileInWorkspace(workspacePath, relativePath);
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

export function ensureDirInWorkspace(workspacePath: string, relativeDir: string): string {
  const fullPath = assertWithinWorkspace(workspacePath, relativeDir);
  fs.mkdirSync(fullPath, { recursive: true });
  return fullPath;
}

export function writeFileInWorkspace(
  workspacePath: string,
  relativePath: string,
  content: string
): string {
  const fullPath = assertWithinWorkspace(workspacePath, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, "utf8");
  return fullPath;
}

export function listDirInWorkspace(
  workspacePath: string,
  relativeDir = "."
): string[] {
  const fullPath = assertWithinWorkspace(workspacePath, relativeDir);
  return fs.readdirSync(fullPath);
}

export { validateWorkspacePath };
