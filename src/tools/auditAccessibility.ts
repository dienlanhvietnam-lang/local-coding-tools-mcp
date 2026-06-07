import path from "node:path";
import fs from "node:fs";
import { validateWorkspacePath } from "../safety/pathGuard.js";
import {
  validateCaptureUrl,
  validateWorkspaceHtmlFile,
  targetUrlFromGuard,
} from "../safety/urlGuard.js";
import { runA11yLiteAudit, runPlaywrightAxeAudit, resolveViewport } from "../utils/browserCdp.js";
import {
  PLAYWRIGHT_INSTALL_HINT,
  probePlaywrightCore,
  probeAxePlaywright,
} from "../utils/uiDesignDependencies.js";
import { pass, fail, skipped } from "../utils/result.js";

export interface AuditAccessibilityInput {
  workspacePath: string;
  url?: string;
  relativePath?: string;
  mode?: "lite" | "full";
  viewport?: string;
  chromePath?: string;
  allowPublicHosts?: boolean;
  timeoutMs?: number;
}

export interface A11yIssue {
  id: number;
  severity: string;
  rule: string;
  selector: string;
  message: string;
  fixHint: string;
}

export interface AuditAccessibilityOutput {
  status: "PASS" | "FAIL" | "SKIPPED";
  workspacePath?: string;
  mode?: string;
  score?: number;
  issueCount?: number;
  issues?: A11yIssue[];
  criticalCount?: number;
  reason?: string;
  installHint?: string;
  error?: string;
}

export async function auditAccessibility(
  input: AuditAccessibilityInput
): Promise<AuditAccessibilityOutput> {
  const validation = validateWorkspacePath(input.workspacePath);
  if (!validation.ok) return fail(validation.error ?? "Invalid workspace");

  const workspacePath = validation.resolvedPath!;
  const mode = input.mode ?? "lite";
  let targetUrl: string;

  if (input.url?.trim()) {
    const urlCheck = validateCaptureUrl(input.url.trim(), {
      allowPublicHosts: input.allowPublicHosts,
    });
    if (!urlCheck.ok) return fail(urlCheck.error);
    targetUrl = targetUrlFromGuard(urlCheck);
  } else if (input.relativePath?.trim()) {
    const fileCheck = validateWorkspaceHtmlFile(workspacePath, input.relativePath.trim());
    if (!fileCheck.ok) return fail(fileCheck.error);
    targetUrl = targetUrlFromGuard(fileCheck);
  } else {
    return fail("Provide url or relativePath");
  }

  const viewport = resolveViewport(input.viewport);
  const userDataDir = path.join(workspacePath, ".mcp-debug", "ui-browser", `a11y-${Date.now()}`);
  fs.mkdirSync(userDataDir, { recursive: true });

  try {
    let result;
    if (mode === "full") {
      const [pw, axe] = await Promise.all([probePlaywrightCore(), probeAxePlaywright()]);
      if (!pw || !axe) {
        return skipped("missing_dependency", {
          workspacePath,
          mode,
          installHint: PLAYWRIGHT_INSTALL_HINT,
          reason: "Playwright or @axe-core/playwright not installed",
        });
      }
      result = await runPlaywrightAxeAudit(targetUrl, {
        chromePath: input.chromePath,
        userDataDir,
        viewport,
        timeoutMs: input.timeoutMs,
      });
    } else {
      result = await runA11yLiteAudit(targetUrl, {
        chromePath: input.chromePath,
        userDataDir,
        viewport,
        timeoutMs: input.timeoutMs,
      });
    }

    const criticalCount = result.issues.filter(
      (i) => i.severity === "critical" || i.severity === "serious"
    ).length;

    return pass({
      workspacePath,
      mode,
      score: result.score,
      issueCount: result.issueCount,
      issues: result.issues.slice(0, 50),
      criticalCount,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "BROWSER_NOT_FOUND") {
      return skipped("browser_not_found", { workspacePath, reason: "Chrome/Edge not found" });
    }
    return fail(message, { workspacePath });
  }
}
