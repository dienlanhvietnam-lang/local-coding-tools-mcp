import path from "node:path";
import fs from "node:fs";
import { validateWorkspacePath } from "../safety/pathGuard.js";
import { resolveViewport } from "../utils/browserCdp.js";
import {
  getActivePage,
  getPlaywrightSession,
  navigatePlaywright,
  PlaywrightNotAvailableError,
  PLAYWRIGHT_INSTALL_HINT,
} from "../utils/playwrightSession.js";
import { validateCaptureUrl, validateWorkspaceHtmlFile, targetUrlFromGuard } from "../safety/urlGuard.js";
import { pass, fail, skipped } from "../utils/result.js";

export interface PlaywrightScreenshotInput {
  workspacePath: string;
  url?: string;
  relativePath?: string;
  outputRelativePath?: string;
  fullPage?: boolean;
  viewport?: string;
  width?: number;
  height?: number;
  chromePath?: string;
  allowPublicHosts?: boolean;
  timeoutMs?: number;
}

export interface PlaywrightScreenshotOutput {
  status: "PASS" | "FAIL" | "SKIPPED";
  workspacePath?: string;
  outputRelativePath?: string;
  url?: string;
  reason?: string;
  installHint?: string;
  error?: string;
}

export async function playwrightScreenshot(
  input: PlaywrightScreenshotInput
): Promise<PlaywrightScreenshotOutput> {
  const validation = validateWorkspacePath(input.workspacePath);
  if (!validation.ok) return fail(validation.error ?? "Invalid workspace");

  const workspacePath = validation.resolvedPath!;
  const outputRelativePath =
    input.outputRelativePath?.trim() ||
    `.mcp-debug/playwright/screenshot-${Date.now()}.png`;
  const outputPath = path.resolve(workspacePath, outputRelativePath);

  try {
    const viewport = resolveViewport(input.viewport, input.width, input.height);

    if (input.url?.trim() || input.relativePath?.trim()) {
      let targetUrl: string;
      if (input.url?.trim()) {
        const check = validateCaptureUrl(input.url.trim(), {
          allowPublicHosts: input.allowPublicHosts,
        });
        if (!check.ok) return fail(check.error);
        targetUrl = targetUrlFromGuard(check);
      } else {
        const check = validateWorkspaceHtmlFile(workspacePath, input.relativePath!.trim());
        if (!check.ok) return fail(check.error);
        targetUrl = targetUrlFromGuard(check);
      }
      await navigatePlaywright(workspacePath, targetUrl, {
        chromePath: input.chromePath,
        viewport,
        timeoutMs: input.timeoutMs,
      });
    } else {
      await getPlaywrightSession(workspacePath, { chromePath: input.chromePath, viewport });
    }

    const page = getActivePage(workspacePath);
    if (!page) return fail("No active Playwright page — call playwright_navigate first");

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    await page.screenshot({
      path: outputPath,
      fullPage: input.fullPage ?? false,
      type: "png",
    });

    return pass({
      workspacePath,
      outputRelativePath: path.relative(workspacePath, outputPath).replace(/\\/g, "/"),
      url: page.url(),
    });
  } catch (err) {
    if (err instanceof PlaywrightNotAvailableError) {
      return skipped("missing_dependency", {
        workspacePath,
        installHint: PLAYWRIGHT_INSTALL_HINT,
      });
    }
    const message = err instanceof Error ? err.message : String(err);
    return fail(message, { workspacePath });
  }
}
