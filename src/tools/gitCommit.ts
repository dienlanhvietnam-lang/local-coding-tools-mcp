import { validateWorkspacePath } from "../safety/pathGuard.js";
import { isGitRepo, runGitCommit } from "../utils/execSafe.js";
import { pass, fail, skipped } from "../utils/result.js";

export interface GitCommitInput {
  workspacePath: string;
  message: string;
}

export interface GitCommitOutput {
  status: "PASS" | "FAIL" | "SKIPPED";
  workspacePath?: string;
  message?: string;
  output?: string;
  exitCode?: number | null;
  error?: string;
  reason?: string;
}

export async function gitCommit(input: GitCommitInput): Promise<GitCommitOutput> {
  const validation = validateWorkspacePath(input.workspacePath);
  if (!validation.ok) {
    return fail(validation.error ?? "Invalid workspace");
  }

  const workspacePath = validation.resolvedPath!;
  const message = input.message?.trim();

  if (!message) {
    return fail("Commit message is required", { workspacePath });
  }

  if (!isGitRepo(workspacePath)) {
    return skipped("not_a_git_repository", { workspacePath });
  }

  const result = await runGitCommit(workspacePath, message);
  const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();

  if (result.status !== "PASS") {
    return fail(result.stderr || "git commit failed", {
      workspacePath,
      message,
      output,
      exitCode: result.exitCode,
    });
  }

  return pass({ workspacePath, message, output, exitCode: result.exitCode });
}
