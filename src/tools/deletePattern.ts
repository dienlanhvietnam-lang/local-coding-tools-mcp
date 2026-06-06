import path from "node:path";
import fs from "node:fs";
import { assertWithinWorkspace, validateWorkspacePath } from "../safety/pathGuard.js";
import { globFiles } from "../utils/globMatch.js";
import { pass, fail } from "../utils/result.js";

export interface DeletePatternInput {
  workspacePath: string;
  pattern: string;
  relativeDir?: string;
  dryRun?: boolean;
  maxDelete?: number;
}

export interface DeletePatternOutput {
  status: "PASS" | "FAIL";
  workspacePath?: string;
  pattern?: string;
  dryRun?: boolean;
  matched?: string[];
  deleted?: string[];
  count?: number;
  error?: string;
}

export async function deletePattern(
  input: DeletePatternInput
): Promise<DeletePatternOutput> {
  const validation = validateWorkspacePath(input.workspacePath);
  if (!validation.ok) {
    return fail(validation.error ?? "Invalid workspace");
  }

  const workspacePath = validation.resolvedPath!;
  const pattern = input.pattern.trim();
  if (!pattern) {
    return fail("Pattern is required", { workspacePath });
  }

  // dryRun defaults to TRUE for safety
  const dryRun = input.dryRun !== false;
  const maxDelete = input.maxDelete ?? 500;

  try {
    const baseDir = input.relativeDir
      ? assertWithinWorkspace(workspacePath, input.relativeDir.replace(/\\/g, "/"))
      : workspacePath;

    const { matches } = globFiles(pattern, { cwd: baseDir, maxResults: maxDelete + 1 });

    if (matches.length > maxDelete) {
      return fail(`Matched ${matches.length} files exceeds maxDelete ${maxDelete} — refine pattern or raise maxDelete`, {
        workspacePath,
        pattern,
        matched: matches.slice(0, 50),
        count: matches.length,
      });
    }

    if (dryRun) {
      return pass({
        workspacePath,
        pattern,
        dryRun: true,
        matched: matches,
        count: matches.length,
      });
    }

    const deleted: string[] = [];
    for (const rel of matches) {
      const abs = path.join(baseDir, rel);
      try {
        fs.rmSync(abs, { force: true });
        deleted.push(rel);
      } catch {
        // skip individual failures
      }
    }

    return pass({
      workspacePath,
      pattern,
      dryRun: false,
      deleted,
      count: deleted.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return fail(message, { workspacePath, pattern });
  }
}
