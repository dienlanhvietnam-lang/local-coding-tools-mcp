import path from "node:path";
import fs from "node:fs";
import { validateWorkspacePath } from "../safety/pathGuard.js";
import { validateCaptureUrl, targetUrlFromGuard } from "../safety/urlGuard.js";
import { getPageMetrics } from "../utils/browserCdp.js";
import { auditAccessibility } from "./auditAccessibility.js";
import { probeLighthouseCli, PLAYWRIGHT_INSTALL_HINT, probePlaywrightCore } from "../utils/uiDesignDependencies.js";
import { runCommand } from "../utils/execSafe.js";
import { pass, fail, skipped } from "../utils/result.js";

export interface PageAuditInput {
  workspacePath: string;
  url: string;
  mode?: "lite" | "full";
  categories?: string[];
  chromePath?: string;
  allowPublicHosts?: boolean;
  timeoutMs?: number;
}

export interface PageAuditOutput {
  status: "PASS" | "FAIL" | "SKIPPED" | "PARTIAL";
  workspacePath?: string;
  mode?: string;
  categories?: string[];
  metrics?: Record<string, number>;
  accessibilityScore?: number;
  lighthouseScore?: number | null;
  summary?: string;
  reason?: string;
  installHint?: string;
  error?: string;
}

export async function pageAudit(input: PageAuditInput): Promise<PageAuditOutput> {
  const validation = validateWorkspacePath(input.workspacePath);
  if (!validation.ok) return fail(validation.error ?? "Invalid workspace");

  const workspacePath = validation.resolvedPath!;
  const mode = input.mode ?? "lite";
  const categories = input.categories ?? ["performance", "accessibility", "best-practices"];

  const urlCheck = validateCaptureUrl(input.url.trim(), {
    allowPublicHosts: input.allowPublicHosts,
  });
  if (!urlCheck.ok) return fail(urlCheck.error);
  const targetUrl = targetUrlFromGuard(urlCheck);

  const userDataDir = path.join(workspacePath, ".mcp-debug", "ui-browser", `page-audit-${Date.now()}`);
  fs.mkdirSync(userDataDir, { recursive: true });

  try {
    const metrics = await getPageMetrics(targetUrl, {
      chromePath: input.chromePath,
      userDataDir,
      viewport: { width: 1280, height: 800, label: "desktop" },
      timeoutMs: input.timeoutMs,
    });

    const a11y = await auditAccessibility({
      workspacePath,
      url: input.url,
      mode: mode === "full" ? "full" : "lite",
      chromePath: input.chromePath,
      allowPublicHosts: input.allowPublicHosts,
      timeoutMs: input.timeoutMs,
    });

    if (a11y.status === "SKIPPED" && mode === "full") {
      return skipped("missing_dependency", {
        workspacePath,
        installHint: PLAYWRIGHT_INSTALL_HINT,
        reason: a11y.reason,
      });
    }

    let lighthouseScore: number | null = null;
    if (mode === "full" && categories.includes("performance")) {
      const hasLh = await probeLighthouseCli();
      if (hasLh) {
        const outPath = path.join(workspacePath, ".mcp-debug", `lighthouse-${Date.now()}.json`);
        const result = await runCommand(
          "lighthouse",
          [targetUrl, "--output=json", `--output-path=${outPath}`, "--chrome-flags=--headless"],
          { timeoutMs: 120000 }
        );
        if (result.status === "PASS" && fs.existsSync(outPath)) {
          try {
            const report = JSON.parse(fs.readFileSync(outPath, "utf8")) as {
              categories?: { performance?: { score?: number } };
            };
            lighthouseScore = Math.round((report.categories?.performance?.score ?? 0) * 100);
          } catch {
            lighthouseScore = null;
          }
        }
      }
    }

    const perfScore = Math.max(
      0,
      100 - Math.floor(metrics.domNodeCount / 50) - metrics.smallTextCount * 2
    );
    const accessibilityScore = a11y.score ?? 100;
    const summary = `DOM nodes: ${metrics.domNodeCount}, a11y score: ${accessibilityScore}, perf estimate: ${perfScore}`;

    return pass({
      workspacePath,
      mode,
      categories,
      metrics: {
        domNodeCount: metrics.domNodeCount,
        documentHeight: metrics.documentHeight,
        scrollWidth: metrics.scrollWidth,
        clientWidth: metrics.clientWidth,
        smallTextCount: metrics.smallTextCount,
        performanceEstimate: perfScore,
      },
      accessibilityScore,
      lighthouseScore,
      summary,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "BROWSER_NOT_FOUND") {
      return skipped("browser_not_found", { workspacePath });
    }
    if (mode === "full" && !(await probePlaywrightCore())) {
      return skipped("missing_dependency", { workspacePath, installHint: PLAYWRIGHT_INSTALL_HINT });
    }
    return fail(message, { workspacePath });
  }
}
