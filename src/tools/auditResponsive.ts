import path from "node:path";
import fs from "node:fs";
import { validateWorkspacePath } from "../safety/pathGuard.js";
import { validateCaptureUrl, targetUrlFromGuard } from "../safety/urlGuard.js";
import { capturePageScreenshot, getPageMetrics } from "../utils/browserCdp.js";
import { pass, fail, skipped } from "../utils/result.js";

export interface AuditResponsiveInput {
  workspacePath: string;
  url: string;
  breakpoints?: number[];
  chromePath?: string;
  allowPublicHosts?: boolean;
  timeoutMs?: number;
}

export interface BreakpointResult {
  width: number;
  overflow: boolean;
  smallTextCount: number;
  screenshotRelativePath?: string;
  domNodeCount?: number;
}

export interface AuditResponsiveOutput {
  status: "PASS" | "FAIL" | "SKIPPED";
  workspacePath?: string;
  results?: BreakpointResult[];
  issueCount?: number;
  reason?: string;
  error?: string;
}

export async function auditResponsive(input: AuditResponsiveInput): Promise<AuditResponsiveOutput> {
  const validation = validateWorkspacePath(input.workspacePath);
  if (!validation.ok) return fail(validation.error ?? "Invalid workspace");

  const workspacePath = validation.resolvedPath!;
  const urlCheck = validateCaptureUrl(input.url.trim(), {
    allowPublicHosts: input.allowPublicHosts,
  });
  if (!urlCheck.ok) return fail(urlCheck.error);
  const targetUrl = targetUrlFromGuard(urlCheck);

  const breakpoints = input.breakpoints ?? [375, 768, 1280, 1440];
  const results: BreakpointResult[] = [];
  let issueCount = 0;

  try {
    for (const width of breakpoints) {
      const userDataDir = path.join(
        workspacePath,
        ".mcp-debug",
        "ui-browser",
        `responsive-${width}-${Date.now()}`
      );
      fs.mkdirSync(userDataDir, { recursive: true });
      const height = Math.round(width * 1.5);
      const screenshotRel = `.mcp-debug/screenshots/responsive-${width}.png`;
      const screenshotPath = path.resolve(workspacePath, screenshotRel);

      await capturePageScreenshot(targetUrl, screenshotPath, {
        chromePath: input.chromePath,
        userDataDir,
        viewport: { width, height, label: "custom" },
        timeoutMs: input.timeoutMs,
      });

      const metrics = await getPageMetrics(targetUrl, {
        chromePath: input.chromePath,
        userDataDir: path.join(workspacePath, ".mcp-debug", "ui-browser", `metrics-${width}`),
        viewport: { width, height, label: "custom" },
        timeoutMs: input.timeoutMs,
      });

      const overflow = metrics.scrollWidth > metrics.clientWidth + 2;
      const hasIssues = overflow || metrics.smallTextCount > 0;
      if (hasIssues) issueCount++;

      results.push({
        width,
        overflow,
        smallTextCount: metrics.smallTextCount,
        screenshotRelativePath: screenshotRel,
        domNodeCount: metrics.domNodeCount,
      });
    }

    return pass({ workspacePath, results, issueCount });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "BROWSER_NOT_FOUND") {
      return skipped("browser_not_found", { workspacePath });
    }
    return fail(message, { workspacePath });
  }
}
