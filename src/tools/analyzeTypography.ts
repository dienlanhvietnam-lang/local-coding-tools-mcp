import path from "node:path";
import fs from "node:fs";
import { validateWorkspacePath } from "../safety/pathGuard.js";
import { pass, fail } from "../utils/result.js";

export interface AnalyzeTypographyInput {
  workspacePath: string;
  sources?: string[];
}

export interface AnalyzeTypographyOutput {
  status: "PASS" | "FAIL";
  workspacePath?: string;
  fontFamilies?: string[];
  fontSizes?: number[];
  lineHeights?: string[];
  scaleRatio?: number;
  suggestion?: string;
  error?: string;
}

function collectFromCss(content: string): {
  families: Set<string>;
  sizes: Set<number>;
  lineHeights: Set<string>;
} {
  const families = new Set<string>();
  const sizes = new Set<number>();
  const lineHeights = new Set<string>();

  const famRe = /font-family\s*:\s*([^;]+);/gi;
  let m: RegExpExecArray | null;
  while ((m = famRe.exec(content)) !== null) {
    families.add(m[1].trim().replace(/['"]/g, ""));
  }

  const sizeRe = /font-size\s*:\s*([\d.]+)(px|rem)/gi;
  while ((m = sizeRe.exec(content)) !== null) {
    const val = parseFloat(m[1]);
    sizes.add(m[2] === "rem" ? val * 16 : val);
  }

  const lhRe = /line-height\s*:\s*([^;]+);/gi;
  while ((m = lhRe.exec(content)) !== null) {
    lineHeights.add(m[1].trim());
  }

  return { families, sizes, lineHeights };
}

export async function analyzeTypography(
  input: AnalyzeTypographyInput
): Promise<AnalyzeTypographyOutput> {
  const validation = validateWorkspacePath(input.workspacePath);
  if (!validation.ok) return fail(validation.error ?? "Invalid workspace");

  const workspacePath = validation.resolvedPath!;
  const families = new Set<string>();
  const sizes = new Set<number>();
  const lineHeights = new Set<string>();

  function walk(dir: string): void {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".css") || entry.name.endsWith(".scss")) {
        const c = collectFromCss(fs.readFileSync(full, "utf8"));
        c.families.forEach((f) => families.add(f));
        c.sizes.forEach((s) => sizes.add(s));
        c.lineHeights.forEach((l) => lineHeights.add(l));
      }
    }
  }
  walk(workspacePath);

  const fontSizes = [...sizes].sort((a, b) => a - b);
  let scaleRatio = 1.25;
  if (fontSizes.length >= 2) {
    const ratios: number[] = [];
    for (let i = 1; i < fontSizes.length; i++) {
      if (fontSizes[i - 1] > 0) ratios.push(fontSizes[i] / fontSizes[i - 1]);
    }
    if (ratios.length > 0) {
      scaleRatio = Math.round((ratios.reduce((a, b) => a + b, 0) / ratios.length) * 100) / 100;
    }
  }

  const suggestion =
    scaleRatio < 1.15
      ? "Consider modular scale 1.125 or 1.25 for clearer hierarchy"
      : scaleRatio > 1.4
        ? "Font scale may be too aggressive — try 1.25 for SaaS UIs"
        : "Typography scale looks balanced";

  return pass({
    workspacePath,
    fontFamilies: [...families],
    fontSizes,
    lineHeights: [...lineHeights],
    scaleRatio,
    suggestion,
  });
}
