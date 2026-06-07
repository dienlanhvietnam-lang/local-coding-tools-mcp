import path from "node:path";
import fs from "node:fs";
import { validateWorkspacePath } from "../safety/pathGuard.js";
import { pass, fail, blocked } from "../utils/result.js";

export type IconLibrary = "lucide" | "heroicons" | "phosphor";

export interface FetchIconSvgInput {
  workspacePath: string;
  library: IconLibrary;
  iconName: string;
  outputRelativePath?: string;
}

export interface FetchIconSvgOutput {
  status: "PASS" | "FAIL" | "BLOCKED";
  workspacePath?: string;
  outputRelativePath?: string;
  library?: string;
  iconName?: string;
  error?: string;
}

const CDN: Record<IconLibrary, (name: string) => string> = {
  lucide: (n) => `https://cdn.jsdelivr.net/npm/lucide-static@latest/icons/${n}.svg`,
  heroicons: (n) =>
    `https://cdn.jsdelivr.net/npm/heroicons@2.1.5/24/outline/${n}.svg`,
  phosphor: (n) =>
    `https://cdn.jsdelivr.net/npm/@phosphor-icons/core@2.1.1/assets/regular/${n}-regular.svg`,
};

function sanitizeSvg(svg: string): string {
  return svg
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "");
}

export async function fetchIconSvg(input: FetchIconSvgInput): Promise<FetchIconSvgOutput> {
  const validation = validateWorkspacePath(input.workspacePath);
  if (!validation.ok) return fail(validation.error ?? "Invalid workspace");

  const workspacePath = validation.resolvedPath!;
  const iconName = input.iconName.trim().replace(/[^a-zA-Z0-9-_]/g, "");
  if (!iconName) return fail("Invalid iconName");

  const library = input.library;
  const url = CDN[library]?.(iconName);
  if (!url) return fail(`Unknown library: ${library}`);

  const outputRelativePath =
    input.outputRelativePath?.trim() ||
    `assets/icons/${library}/${iconName}.svg`;
  const outputPath = path.resolve(workspacePath, outputRelativePath);

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "local-coding-tools-mcp/0.14" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      return fail(`Icon not found: ${library}/${iconName} (HTTP ${res.status})`);
    }
    const raw = await res.text();
    if (!raw.includes("<svg")) {
      return fail("Response is not valid SVG");
    }
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, sanitizeSvg(raw), "utf8");

    return pass({
      workspacePath,
      outputRelativePath: path.relative(workspacePath, outputPath).replace(/\\/g, "/"),
      library,
      iconName,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("abort") || message.includes("timeout")) {
      return blocked("Network timeout fetching icon");
    }
    return fail(message);
  }
}
