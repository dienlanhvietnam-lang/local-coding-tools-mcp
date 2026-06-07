import path from "node:path";
import fs from "node:fs";
import { validateWorkspacePath } from "../safety/pathGuard.js";
import { auditAccessibility } from "./auditAccessibility.js";
import { listUiComponents } from "./listUiComponents.js";
import { pass, fail } from "../utils/result.js";

export interface ScoreUiDevgolInput {
  workspacePath: string;
  screenshotRelativePath?: string;
  url?: string;
  relativePath?: string;
  productType?: string;
  checklistMode?: "quick" | "full";
}

export interface ScoreUiDevgolOutput {
  status: "PASS" | "FAIL";
  workspacePath?: string;
  score?: number;
  belowThreshold?: boolean;
  breakdown?: Record<string, number>;
  recommendations?: string[];
  error?: string;
}

function grepStates(workspacePath: string): { loading: boolean; error: boolean; empty: boolean } {
  const dirs = ["src", "components", "app"];
  let content = "";
  for (const d of dirs) {
    const full = path.join(workspacePath, d);
    if (!fs.existsSync(full)) continue;
    const walk = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.name === "node_modules") continue;
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (/\.(tsx|jsx|vue)$/.test(e.name)) {
          content += fs.readFileSync(p, "utf8") + "\n";
        }
      }
    };
    walk(full);
  }
  return {
    loading: /loading|isLoading|skeleton|spinner/i.test(content),
    error: /error|isError|ErrorState|error-state/i.test(content),
    empty: /empty|isEmpty|EmptyState|no-data/i.test(content),
  };
}

export async function scoreUiDevgol(input: ScoreUiDevgolInput): Promise<ScoreUiDevgolOutput> {
  const validation = validateWorkspacePath(input.workspacePath);
  if (!validation.ok) return fail(validation.error ?? "Invalid workspace");

  const workspacePath = validation.resolvedPath!;
  const breakdown: Record<string, number> = {};
  const recommendations: string[] = [];

  const a11y = await auditAccessibility({
    workspacePath,
    url: input.url,
    relativePath: input.relativePath,
    mode: "lite",
  });
  const a11yScore = a11y.score ?? 70;
  breakdown.accessibility = Math.min(25, Math.round(a11yScore * 0.25));
  if ((a11y.criticalCount ?? 0) > 0) {
    recommendations.push("Fix critical accessibility issues before shipping");
  }

  const states = grepStates(workspacePath);
  breakdown.states = 0;
  if (states.loading) breakdown.states += 8;
  else recommendations.push("Add loading/skeleton states");
  if (states.error) breakdown.states += 8;
  else recommendations.push("Add error states");
  if (states.empty) breakdown.states += 9;
  else recommendations.push("Add empty states");

  const components = await listUiComponents({ workspacePath });
  breakdown.components = Math.min(15, (components.count ?? 0) * 2);
  if ((components.duplicates?.length ?? 0) > 0) {
    recommendations.push(`Resolve duplicate components: ${components.duplicates!.join(", ")}`);
  }

  breakdown.structure = 20;
  if (input.screenshotRelativePath && fs.existsSync(path.join(workspacePath, input.screenshotRelativePath))) {
    breakdown.visual = 23;
  } else {
    breakdown.visual = 10;
    recommendations.push("Run capture_screenshot for visual verification");
  }

  const score = Object.values(breakdown).reduce((a, b) => a + b, 0);
  const belowThreshold = score < 85;

  return pass({
    workspacePath,
    score,
    belowThreshold,
    breakdown,
    recommendations: recommendations.slice(0, 8),
  });
}
