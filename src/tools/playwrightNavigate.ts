import { validateWorkspacePath } from "../safety/pathGuard.js";
import { validateCaptureUrl, validateWorkspaceHtmlFile, targetUrlFromGuard } from "../safety/urlGuard.js";
import { resolveViewport } from "../utils/browserCdp.js";
import {
  navigatePlaywright,
  PlaywrightNotAvailableError,
  PLAYWRIGHT_INSTALL_HINT,
} from "../utils/playwrightSession.js";
import { pass, fail, skipped } from "../utils/result.js";

export interface PlaywrightNavigateInput {
  workspacePath: string;
  url?: string;
  relativePath?: string;
  viewport?: string;
  width?: number;
  height?: number;
  chromePath?: string;
  allowPublicHosts?: boolean;
  waitUntil?: "load" | "domcontentloaded" | "networkidle";
  timeoutMs?: number;
}

export interface PlaywrightNavigateOutput {
  status: "PASS" | "FAIL" | "SKIPPED";
  workspacePath?: string;
  url?: string;
  title?: string;
  reason?: string;
  installHint?: string;
  error?: string;
}

export async function playwrightNavigate(
  input: PlaywrightNavigateInput
): Promise<PlaywrightNavigateOutput> {
  const validation = validateWorkspacePath(input.workspacePath);
  if (!validation.ok) return fail(validation.error ?? "Invalid workspace");

  const workspacePath = validation.resolvedPath!;
  let targetUrl: string;

  if (input.url?.trim()) {
    const check = validateCaptureUrl(input.url.trim(), {
      allowPublicHosts: input.allowPublicHosts,
    });
    if (!check.ok) return fail(check.error);
    targetUrl = targetUrlFromGuard(check);
  } else if (input.relativePath?.trim()) {
    const check = validateWorkspaceHtmlFile(workspacePath, input.relativePath.trim());
    if (!check.ok) return fail(check.error);
    targetUrl = targetUrlFromGuard(check);
  } else {
    return fail("Provide url or relativePath");
  }

  try {
    const viewport = resolveViewport(input.viewport, input.width, input.height);
    const result = await navigatePlaywright(workspacePath, targetUrl, {
      chromePath: input.chromePath,
      viewport,
      waitUntil: input.waitUntil,
      timeoutMs: input.timeoutMs,
    });
    return pass({ workspacePath, url: result.url, title: result.title });
  } catch (err) {
    if (err instanceof PlaywrightNotAvailableError) {
      return skipped("missing_dependency", {
        workspacePath,
        installHint: PLAYWRIGHT_INSTALL_HINT,
        reason: "playwright-core not installed",
      });
    }
    const message = err instanceof Error ? err.message : String(err);
    return fail(message, { workspacePath, url: targetUrl });
  }
}
