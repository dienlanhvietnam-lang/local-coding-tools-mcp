import { getToolVersion } from "../utils/execSafe.js";
import { pass, partial, fail } from "../utils/result.js";

export interface CheckSystemInput {
  includeWinget?: boolean;
}

export interface ToolCheckResult {
  ok: boolean;
  version?: string;
  error?: string;
}

export interface CheckSystemOutput {
  status: "PASS" | "PARTIAL" | "FAIL";
  tools: Record<string, ToolCheckResult>;
}

export async function checkSystem(input: CheckSystemInput = {}): Promise<CheckSystemOutput> {
  const tools: Record<string, ToolCheckResult> = {};

  const checks: Array<[string, string, string[]?]> = [
    ["node", "node"],
    ["npm", "npm"],
    ["pnpm", "pnpm"],
    ["git", "git"],
  ];

  if (input.includeWinget) {
    checks.push(["winget", "winget"]);
  }

  let okCount = 0;
  for (const [key, cmd, args] of checks) {
    const result = await getToolVersion(cmd, args);
    tools[key] = result;
    if (result.ok) okCount++;
  }

  const total = checks.length;
  if (okCount === total) {
    return pass({ tools }) as CheckSystemOutput;
  }
  if (okCount === 0) {
    return fail("No required tools available", { tools }) as unknown as CheckSystemOutput;
  }
  return partial({ tools }) as CheckSystemOutput;
}
