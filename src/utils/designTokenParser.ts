import fs from "node:fs";
import path from "node:path";

export interface DesignTokens {
  colors: Record<string, string>;
  typography: Record<string, string | number>;
  spacing: Record<string, string>;
  radius: Record<string, string>;
  shadows: Record<string, string>;
  breakpoints: Record<string, string | number>;
  sources: string[];
}

const CSS_VAR_RE = /--([a-zA-Z0-9-_]+)\s*:\s*([^;]+);/g;
const TAILWIND_COLOR_RE = /['"]?([\w-]+)['"]?\s*:\s*['"](#[\da-fA-F]{3,8}|rgb[^'"]+)['"]/g;

export function parseCssVariables(content: string, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  let m: RegExpExecArray | null;
  CSS_VAR_RE.lastIndex = 0;
  while ((m = CSS_VAR_RE.exec(content)) !== null) {
    const key = prefix ? `${prefix}${m[1]}` : m[1];
    out[key] = m[2].trim();
  }
  return out;
}

export function parseTailwindConfig(content: string): Partial<DesignTokens> {
  const colors: Record<string, string> = {};
  const spacing: Record<string, string> = {};
  const radius: Record<string, string> = {};
  const breakpoints: Record<string, string | number> = {};

  const screensMatch = content.match(/screens\s*:\s*\{([^}]+)\}/s);
  if (screensMatch) {
    const screenRe = /['"]?(\w+)['"]?\s*:\s*['"]([^'"]+)['"]/g;
    let sm: RegExpExecArray | null;
    while ((sm = screenRe.exec(screensMatch[1])) !== null) {
      breakpoints[sm[1]] = sm[2];
    }
  }

  const extendColors = content.match(/colors\s*:\s*\{([^}]+)\}/s);
  if (extendColors) {
    let cm: RegExpExecArray | null;
    TAILWIND_COLOR_RE.lastIndex = 0;
    while ((cm = TAILWIND_COLOR_RE.exec(extendColors[1])) !== null) {
      colors[cm[1]] = cm[2];
    }
  }

  const spacingMatch = content.match(/spacing\s*:\s*\{([^}]+)\}/s);
  if (spacingMatch) {
    const spRe = /['"]?([\w.-]+)['"]?\s*:\s*['"]([^'"]+)['"]/g;
    let sp: RegExpExecArray | null;
    while ((sp = spRe.exec(spacingMatch[1])) !== null) {
      spacing[sp[1]] = sp[2];
    }
  }

  const radiusMatch = content.match(/borderRadius\s*:\s*\{([^}]+)\}/s);
  if (radiusMatch) {
    const rRe = /['"]?([\w.-]+)['"]?\s*:\s*['"]([^'"]+)['"]/g;
    let rm: RegExpExecArray | null;
    while ((rm = rRe.exec(radiusMatch[1])) !== null) {
      radius[rm[1]] = rm[2];
    }
  }

  return { colors, spacing, radius, breakpoints };
}

export function parseThemeTs(content: string): Partial<DesignTokens> {
  const colors: Record<string, string> = {};
  const typography: Record<string, string | number> = {};

  const hexRe = /(\w+)\s*:\s*['"](#[\da-fA-F]{3,8})['"]/g;
  let hm: RegExpExecArray | null;
  while ((hm = hexRe.exec(content)) !== null) {
    colors[hm[1]] = hm[2];
  }

  const fontRe = /font(?:Size|Family|Weight)?\s*[=:]\s*['"]([^'"]+)['"]/gi;
  let fm: RegExpExecArray | null;
  let fi = 0;
  while ((fm = fontRe.exec(content)) !== null) {
    typography[`font_${++fi}`] = fm[1];
  }

  return { colors, typography };
}

export function mergeTokens(base: DesignTokens, partial: Partial<DesignTokens>, source: string): DesignTokens {
  return {
    colors: { ...base.colors, ...partial.colors },
    typography: { ...base.typography, ...partial.typography },
    spacing: { ...base.spacing, ...partial.spacing },
    radius: { ...base.radius, ...partial.radius },
    shadows: { ...base.shadows, ...partial.shadows },
    breakpoints: { ...base.breakpoints, ...partial.breakpoints },
    sources: [...base.sources, source],
  };
}

export function emptyTokens(): DesignTokens {
  return {
    colors: {},
    typography: {},
    spacing: {},
    radius: {},
    shadows: {},
    breakpoints: {},
    sources: [],
  };
}

export function parseFileTokens(filePath: string): Partial<DesignTokens> {
  const content = fs.readFileSync(filePath, "utf8");
  const ext = path.extname(filePath).toLowerCase();
  const base = path.basename(filePath).toLowerCase();

  if (ext === ".css" || ext === ".scss") {
    const vars = parseCssVariables(content);
    const colors: Record<string, string> = {};
    const spacing: Record<string, string> = {};
    const radius: Record<string, string> = {};
    const shadows: Record<string, string> = {};
    const typography: Record<string, string | number> = {};

    for (const [k, v] of Object.entries(vars)) {
      if (k.includes("color") || k.startsWith("primary") || k.startsWith("bg")) colors[k] = v;
      else if (k.includes("space") || k.includes("gap") || k.includes("margin") || k.includes("padding"))
        spacing[k] = v;
      else if (k.includes("radius") || k.includes("rounded")) radius[k] = v;
      else if (k.includes("shadow")) shadows[k] = v;
      else if (k.includes("font") || k.includes("line-height")) typography[k] = v;
      else colors[k] = v;
    }
    return { colors, typography, spacing, radius, shadows };
  }

  if (base.includes("tailwind.config")) {
    return parseTailwindConfig(content);
  }

  if (base.includes("theme") && (ext === ".ts" || ext === ".js")) {
    return parseThemeTs(content);
  }

  return parseCssVariables(content) as unknown as Partial<DesignTokens>;
}
