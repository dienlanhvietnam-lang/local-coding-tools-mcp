import path from "node:path";
import fs from "node:fs";
import { validateWorkspacePath } from "../safety/pathGuard.js";
import { isGitRepo, runGitInit } from "../utils/execSafe.js";
import { pass, fail, skipped } from "../utils/result.js";

export interface GitInitInput {
  workspacePath: string;
}

export interface GitInitOutput {
  status: "PASS" | "FAIL" | "SKIPPED";
  workspacePath?: string;
  isRepo?: boolean;
  output?: string;
  exitCode?: number | null;
  error?: string;
  reason?: string;
}

export async function gitInit(input: GitInitInput): Promise<GitInitOutput> {
  const validation = validateWorkspacePath(input.workspacePath);
  if (!validation.ok) {
    return fail(validation.error ?? "Invalid workspace");
  }

  const workspacePath = validation.resolvedPath!;

  if (isGitRepo(workspacePath)) {
    return skipped("already_a_git_repository", {
      workspacePath,
      isRepo: true,
    });
  }

  const result = await runGitInit(workspacePath);
  const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();

  if (result.status !== "PASS") {
    return fail(result.stderr || "git init failed", {
      workspacePath,
      output,
      exitCode: result.exitCode,
    });
  }

  return pass({
    workspacePath,
    isRepo: fs.existsSync(path.join(workspacePath, ".git")),
    output,
    exitCode: result.exitCode,
  });
}
