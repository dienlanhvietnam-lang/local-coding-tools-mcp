import fs from "node:fs";
import { assertWithinWorkspace, validateWorkspacePath } from "../safety/pathGuard.js";
import { pass, fail } from "../utils/result.js";

const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;

export interface ReadBinaryFileInput {
  workspacePath: string;
  relativePath: string;
  maxBytes?: number;
}

export interface ReadBinaryFileOutput {
  status: "PASS" | "FAIL";
  workspacePath?: string;
  relativePath?: string;
  encoding?: "base64";
  bytes?: number;
  truncated?: boolean;
  data?: string;
  error?: string;
}

export async function readBinaryFile(
  input: ReadBinaryFileInput
): Promise<ReadBinaryFileOutput> {
  const validation = validateWorkspacePath(input.workspacePath);
  if (!validation.ok) {
    return fail(validation.error ?? "Invalid workspace");
  }

  const workspacePath = validation.resolvedPath!;
  const relativePath = input.relativePath.replace(/\\/g, "/");
  const maxBytes = input.maxBytes ?? DEFAULT_MAX_BYTES;

  try {
    const fullPath = assertWithinWorkspace(workspacePath, relativePath);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      return fail("Path is a directory, not a file", { workspacePath, relativePath });
    }

    const truncated = stat.size > maxBytes;
    const buf = truncated
      ? Buffer.alloc(maxBytes)
      : fs.readFileSync(fullPath);

    if (truncated) {
      const fd = fs.openSync(fullPath, "r");
      try {
        fs.readSync(fd, buf, 0, maxBytes, 0);
      } finally {
        fs.closeSync(fd);
      }
    }

    return pass({
      workspacePath,
      relativePath,
      encoding: "base64" as const,
      bytes: truncated ? maxBytes : stat.size,
      truncated,
      data: buf.toString("base64"),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return fail(message, { workspacePath, relativePath });
  }
}
