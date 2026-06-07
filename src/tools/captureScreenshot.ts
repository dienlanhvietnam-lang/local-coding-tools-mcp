import path from "node:path";
import fs from "node:fs";
import { validateWorkspacePath } from "../safety/pathGuard.js";
import {
  validateCaptureUrl,
  validateWorkspaceHtmlFile,
  targetUrlFromGuard,
} from "../safety/urlGuard.js";
import { capturePageScreenshot, resolveViewport } from "../utils/browserCdp.js";
import { pass, fail, skipped, blocked } from "../utils/result.js";

export interface CaptureScreenshotInput {
  workspacePath: string;
  url?: string;
  relativePath?: string;
  viewport?: string;
  width?: number;
  height?: number;
  outputRelativePath?: string;
  chromePath?: string;
  allowPublicHosts?: boolean;
  timeoutMs?: number;
}

export interface CaptureScreenshotOutput {
  status: "PASS" | "FAIL" | "SKIPPED" | "BLOCKED";
  workspacePath?: string;
  outputRelativePath?: string;
  width?: number;
  height?: number;
  browserPath?: string;
  targetUrl?: string;
  reason?: string;
  error?: string;
}

export async function captureScreenshot(
  input: CaptureScreenshotInput
): Promise<CaptureScreenshotOutput> {
  const validation = validateWorkspacePath(input.workspacePath);
  if (!validation.ok) return fail(validation.error ?? "Invalid workspace");

  const workspacePath = validation.resolvedPath!;
  let targetUrl: string;

  if (input.url?.trim()) {
    const urlCheck = validateCaptureUrl(input.url.trim(), {
      allowPublicHosts: input.allowPublicHosts,
    });
    if (!urlCheck.ok) {
      return urlCheck.status === "BLOCKED"
        ? (blocked(urlCheck.error) as CaptureScreenshotOutput)
        : fail(urlCheck.error);
    }
    targetUrl = targetUrlFromGuard(urlCheck);
  } else if (input.relativePath?.trim()) {
    const fileCheck = validateWorkspaceHtmlFile(workspacePath, input.relativePath.trim());
    if (!fileCheck.ok) {
      return fileCheck.status === "BLOCKED"
        ? (blocked(fileCheck.error) as CaptureScreenshotOutput)
        : fail(fileCheck.error);
    }
    targetUrl = targetUrlFromGuard(fileCheck);
  } else {
    return fail("Provide url or relativePath");
  }

  const viewport = resolveViewport(input.viewport, input.width, input.height);
  const outputRelativePath =
    input.outputRelativePath?.trim() ||
    `.mcp-debug/screenshots/capture-${Date.now()}.png`;
  const outputPath = path.resolve(workspacePath, outputRelativePath);

  const userDataDir = path.join(workspacePath, ".mcp-debug", "ui-browser", `run-${Date.now()}`);
  fs.mkdirSync(userDataDir, { recursive: true });

  try {
    const result = await capturePageScreenshot(targetUrl, outputPath, {
      chromePath: input.chromePath,
      userDataDir,
      viewport,
      timeoutMs: input.timeoutMs,
    });
    return pass({
      workspacePath,
      outputRelativePath: path.relative(workspacePath, result.outputPath).replace(/\\/g, "/"),
      width: result.width,
      height: result.height,
      browserPath: result.browserPath,
      targetUrl,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "BROWSER_NOT_FOUND") {
      return skipped("browser_not_found", {
        workspacePath,
        reason: "Chrome/Edge not found — install browser or set chromePath",
      });
    }
    return fail(message, { workspacePath, targetUrl });
  }
}
