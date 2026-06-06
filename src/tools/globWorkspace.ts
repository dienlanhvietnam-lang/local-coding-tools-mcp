import path from "node:path";
import { assertWithinWorkspace, validateWorkspacePath } from "../safety/pathGuard.js";
import { globFiles } from "../utils/globMatch.js";
import { pass, fail } from "../utils/result.js";

export interface GlobWorkspaceInput {
  workspacePath: string;
  pattern: string;
  relativeDir?: string;
  maxResults?: number;
  includeDirs?: boolean;
}

export interface GlobWorkspaceOutput {
  status: "PASS" | "FAIL";
  workspacePath?: string;
  pattern?: string;
  matches?: string[];
  count?: number;
  truncated?: boolean;
  error?: string;
}

export async function globWorkspace(
  input: GlobWorkspaceInput
): Promise<GlobWorkspaceOutput> {
  const validation = validateWorkspacePath(input.workspacePath);
  if (!validation.ok) {
    return fail(validation.error ?? "Invalid workspace");
  }

  const workspacePath = validation.resolvedPath!;
  const pattern = input.pattern.trim();
  if (!pattern) {
    return fail("Pattern is required", { workspacePath });
  }

  try {
    const baseDir = input.relativeDir
      ? assertWithinWorkspace(workspacePath, input.relativeDir.replace(/\\/g, "/"))
      : workspacePath;

    const { matches, truncated } = globFiles(pattern, {
      cwd: baseDir,
      maxResults: input.maxResults ?? 1000,
      includeDirs: input.includeDirs ?? false,
    });

    const relMatches = input.relativeDir
      ? matches.map((m) => path.posix.join(input.relativeDir!.replace(/\\/g, "/"), m))
      : matches;

    return pass({
      workspacePath,
      pattern,
      matches: relMatches,
      count: relMatches.length,
      truncated,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return fail(message, { workspacePath, pattern });
  }
}
