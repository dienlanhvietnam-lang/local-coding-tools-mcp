import { validateWorkspacePath } from "../safety/pathGuard.js";
import { isGitRepo, runGitAdd } from "../utils/execSafe.js";
import { pass, fail, skipped } from "../utils/result.js";

export interface GitAddInput {
  workspacePath: string;
  paths?: string[];
}

export interface GitAddOutput {
  status: "PASS" | "FAIL" | "SKIPPED";
  workspacePath?: string;
  paths?: string[];
  output?: string;
  exitCode?: number | null;
  error?: string;
  reason?: string;
}

export async function gitAdd(input: GitAddInput): Promise<GitAddOutput> {
  const validation = validateWorkspacePath(input.workspacePath);
  if (!validation.ok) {
    return fail(validation.error ?? "Invalid workspace");
  }

  const workspacePath = validation.resolvedPath!;
  const paths = (input.paths?.length ? input.paths : ["."]).map((p) =>
    p.replace(/\\/g, "/")
  );

  if (!isGitRepo(workspacePath)) {
    return skipped("not_a_git_repository", { workspacePath });
  }

  for (const p of paths) {
    if (p.includes("..") || p.startsWith("-")) {
      return fail("Invalid path — cannot use '..' or flags starting with '-'", {
        workspacePath,
        paths,
      });
    }
  }

  const result = await runGitAdd(workspacePath, paths);
  const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();

  if (result.status !== "PASS") {
    return fail(result.stderr || "git add failed", {
      workspacePath,
      paths,
      output,
      exitCode: result.exitCode,
    });
  }

  return pass({ workspacePath, paths, output, exitCode: result.exitCode });
}
