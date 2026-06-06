import fs from "node:fs";
import path from "node:path";
import { MAX_IMAGE_BYTES } from "../config.js";
import { assertWithinWorkspace, validateWorkspacePath } from "./pathGuard.js";
import { blocked, fail } from "../utils/result.js";

export const ALLOWED_IMAGE_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".avif",
  ".tiff",
  ".tif",
]);

export const ALLOWED_OUTPUT_FORMATS = ["png", "jpeg", "webp", "avif"] as const;
export type OutputImageFormat = (typeof ALLOWED_OUTPUT_FORMATS)[number];

export function isImageExtension(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return ALLOWED_IMAGE_EXTENSIONS.has(ext);
}

export interface ResolvedImagePath {
  workspacePath: string;
  relativePath: string;
  fullPath: string;
  sizeBytes: number;
}

export function resolveImageInput(
  workspacePath: string,
  relativePath: string
): { ok: true; resolved: ResolvedImagePath } | { ok: false; error: string; status?: "FAIL" | "BLOCKED" } {
  const validation = validateWorkspacePath(workspacePath);
  if (!validation.ok) {
    return { ok: false, error: validation.error ?? "Invalid workspace", status: "FAIL" };
  }

  const rel = relativePath.replace(/\\/g, "/");

  if (!isImageExtension(rel)) {
    return {
      ok: false,
      error: `Unsupported image extension. Allowed: ${[...ALLOWED_IMAGE_EXTENSIONS].join(", ")}`,
      status: "FAIL",
    };
  }

  try {
    const fullPath = assertWithinWorkspace(validation.resolvedPath!, rel);
    if (!fs.existsSync(fullPath)) {
      return { ok: false, error: `Image not found: ${rel}`, status: "FAIL" };
    }
    const stat = fs.statSync(fullPath);
    if (!stat.isFile()) {
      return { ok: false, error: "Path is not a file", status: "FAIL" };
    }
    if (stat.size > MAX_IMAGE_BYTES) {
      return {
        ok: false,
        error: `Image exceeds max size (${MAX_IMAGE_BYTES} bytes)`,
        status: "FAIL",
      };
    }
    return {
      ok: true,
      resolved: {
        workspacePath: validation.resolvedPath!,
        relativePath: rel,
        fullPath,
        sizeBytes: stat.size,
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      status: "FAIL",
    };
  }
}

export function resolveImageOutput(
  workspacePath: string,
  relativePath: string
): { ok: true; resolved: Omit<ResolvedImagePath, "sizeBytes"> } | { ok: false; error: string; status: "FAIL" | "BLOCKED" } {
  const validation = validateWorkspacePath(workspacePath);
  if (!validation.ok) {
    return { ok: false, error: validation.error ?? "Invalid workspace", status: "FAIL" };
  }

  const rel = relativePath.replace(/\\/g, "/");

  if (!isImageExtension(rel)) {
    return {
      ok: false,
      error: `Output must be an image extension: ${[...ALLOWED_IMAGE_EXTENSIONS].join(", ")}`,
      status: "FAIL",
    };
  }

  try {
    const fullPath = assertWithinWorkspace(validation.resolvedPath!, rel);
    return {
      ok: true,
      resolved: {
        workspacePath: validation.resolvedPath!,
        relativePath: rel,
        fullPath,
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      status: "FAIL",
    };
  }
}

export function guardFail<T extends Record<string, unknown>>(
  message: string,
  status: "FAIL" | "BLOCKED" = "FAIL",
  extra?: T
) {
  return status === "BLOCKED"
    ? (blocked(message) as { status: "BLOCKED"; error: string } & T)
    : fail(message, extra);
}
