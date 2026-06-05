import { validateWorkspacePath } from "../utils/fsSafe.js";
import { runGitShortStatus } from "../utils/execSafe.js";
import { pass, fail, skipped } from "../utils/result.js";

export interface GitStatusInput {
  workspacePath: string;
}

export interface GitStatusOutput {
  status: "PASS" | "FAIL" | "SKIPPED";
  workspacePath?: string;
  isRepo?: boolean;
  output?: string;
  exitCode?: number | null;
  error?: string;
}

export async function gitStatus(input: GitStatusInput): Promise<GitStatusOutput> {
  const validation = validateWorkspacePath(input.workspacePath);
  if (!validation.ok) {
    return fail(validation.error ?? "Invalid workspace");
  }

  const workspacePath = validation.resolvedPath!;
  const result = await runGitShortStatus(workspacePath);

  if (result.stderr.includes("not a git repository")) {
    return skipped("not_a_git_repository", {
      workspacePath,
      isRepo: false,
      exitCode: result.exitCode,
    });
  }

  const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();

  return pass({
    workspacePath,
    isRepo: true,
    output,
    exitCode: result.exitCode,
  });
}
