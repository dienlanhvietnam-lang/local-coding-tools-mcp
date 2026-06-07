import path from "node:path";
import { isPrivateOrLocalHost, parseHttpUrl } from "../utils/httpFetch.js";
import { resolveWorkspacePath } from "./pathGuard.js";

export type UrlGuardResult =
  | { ok: true; url: string; kind: "http" }
  | { ok: true; fileUrl: string; filePath: string; kind: "file" }
  | { ok: false; status: "BLOCKED" | "FAIL"; error: string };

function toFileUrl(filePath: string): string {
  const normalized = path.resolve(filePath).replace(/\\/g, "/");
  if (process.platform === "win32") {
    return `file:///${normalized}`;
  }
  return `file://${normalized}`;
}

/** Validate HTTP(S) URL for UI capture — localhost/private only by default. */
export function validateCaptureUrl(
  url: string,
  options?: { allowPublicHosts?: boolean }
): UrlGuardResult {
  const parsed = parseHttpUrl(url);
  if (!parsed) {
    return { ok: false, status: "FAIL", error: "Invalid URL — only http and https supported" };
  }

  const allowPublic = options?.allowPublicHosts ?? false;
  if (!allowPublic && !isPrivateOrLocalHost(parsed.hostname)) {
    return {
      ok: false,
      status: "BLOCKED",
      error: `Host "${parsed.hostname}" is not localhost/private — set allowPublicHosts or use local dev server`,
    };
  }

  return { ok: true, url: parsed.href, kind: "http" };
}

/** Resolve workspace HTML file to guarded file:// URL. */
export function validateWorkspaceHtmlFile(
  workspacePath: string,
  relativePath: string
): UrlGuardResult {
  const filePath = resolveWorkspacePath(workspacePath, relativePath);
  if (!filePath.toLowerCase().endsWith(".html") && !filePath.toLowerCase().endsWith(".htm")) {
    return { ok: false, status: "FAIL", error: "relativePath must be an .html or .htm file" };
  }

  return { ok: true, fileUrl: toFileUrl(filePath), filePath, kind: "file" };
}

export function targetUrlFromGuard(
  result: Extract<UrlGuardResult, { ok: true }>
): string {
  return result.kind === "http" ? result.url : result.fileUrl;
}
