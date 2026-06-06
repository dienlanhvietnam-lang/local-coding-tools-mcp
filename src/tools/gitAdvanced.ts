import { validateWorkspacePath } from "../safety/pathGuard.js";
import {
  isGitRepo,
  runGitPush,
  runGitPull,
  runGitBranchList,
  runGitBranchCreate,
  runGitCheckout,
  runGitMerge,
} from "../utils/execSafe.js";
import { pass, fail, skipped } from "../utils/result.js";

interface BaseOutput {
  status: "PASS" | "FAIL" | "SKIPPED";
  workspacePath?: string;
  output?: string;
  exitCode?: number | null;
  error?: string;
  reason?: string;
  [k: string]: unknown;
}

const REF_RE = /^[A-Za-z0-9._\/-]+$/;

function validRef(ref: string): boolean {
  return REF_RE.test(ref) && !ref.startsWith("-") && !ref.includes("..");
}

function joinOutput(stdout: string, stderr: string): string {
  return [stdout, stderr].filter(Boolean).join("\n").trim();
}

export interface GitPushInput {
  workspacePath: string;
  remote?: string;
  branch?: string;
  force?: boolean;
  setUpstream?: boolean;
}

export async function gitPush(input: GitPushInput): Promise<BaseOutput> {
  const v = validateWorkspacePath(input.workspacePath);
  if (!v.ok) return fail(v.error ?? "Invalid workspace");
  const workspacePath = v.resolvedPath!;
  if (!isGitRepo(workspacePath)) return skipped("not_a_git_repository", { workspacePath });

  if (input.remote && !validRef(input.remote)) return fail("Invalid remote name", { workspacePath });
  if (input.branch && !validRef(input.branch)) return fail("Invalid branch name", { workspacePath });

  const result = await runGitPush(workspacePath, {
    remote: input.remote,
    branch: input.branch,
    force: input.force,
    setUpstream: input.setUpstream,
  });
  const output = joinOutput(result.stdout, result.stderr);
  return result.status === "PASS"
    ? pass({ workspacePath, output, exitCode: result.exitCode, forced: Boolean(input.force) })
    : fail(result.stderr || "git push failed", { workspacePath, output, exitCode: result.exitCode });
}

export interface GitPullInput {
  workspacePath: string;
  remote?: string;
  branch?: string;
}

export async function gitPull(input: GitPullInput): Promise<BaseOutput> {
  const v = validateWorkspacePath(input.workspacePath);
  if (!v.ok) return fail(v.error ?? "Invalid workspace");
  const workspacePath = v.resolvedPath!;
  if (!isGitRepo(workspacePath)) return skipped("not_a_git_repository", { workspacePath });

  if (input.remote && !validRef(input.remote)) return fail("Invalid remote name", { workspacePath });
  if (input.branch && !validRef(input.branch)) return fail("Invalid branch name", { workspacePath });

  const result = await runGitPull(workspacePath, { remote: input.remote, branch: input.branch });
  const output = joinOutput(result.stdout, result.stderr);
  return result.status === "PASS"
    ? pass({ workspacePath, output, exitCode: result.exitCode })
    : fail(result.stderr || "git pull failed", { workspacePath, output, exitCode: result.exitCode });
}

export interface GitBranchInput {
  workspacePath: string;
  create?: string;
}

export async function gitBranch(input: GitBranchInput): Promise<BaseOutput> {
  const v = validateWorkspacePath(input.workspacePath);
  if (!v.ok) return fail(v.error ?? "Invalid workspace");
  const workspacePath = v.resolvedPath!;
  if (!isGitRepo(workspacePath)) return skipped("not_a_git_repository", { workspacePath });

  if (input.create) {
    if (!validRef(input.create)) return fail("Invalid branch name", { workspacePath });
    const result = await runGitBranchCreate(workspacePath, input.create);
    const output = joinOutput(result.stdout, result.stderr);
    return result.status === "PASS"
      ? pass({ workspacePath, output, exitCode: result.exitCode, created: input.create })
      : fail(result.stderr || "git branch failed", { workspacePath, output, exitCode: result.exitCode });
  }

  const result = await runGitBranchList(workspacePath);
  const output = joinOutput(result.stdout, result.stderr);
  const branches = result.stdout
    .split("\n")
    .map((l) => l.replace(/^\*?\s+/, "").trim())
    .filter(Boolean);
  return result.status === "PASS"
    ? pass({ workspacePath, branches, output, exitCode: result.exitCode })
    : fail(result.stderr || "git branch failed", { workspacePath, output, exitCode: result.exitCode });
}

export interface GitCheckoutInput {
  workspacePath: string;
  branch: string;
  create?: boolean;
}

export async function gitCheckout(input: GitCheckoutInput): Promise<BaseOutput> {
  const v = validateWorkspacePath(input.workspacePath);
  if (!v.ok) return fail(v.error ?? "Invalid workspace");
  const workspacePath = v.resolvedPath!;
  if (!isGitRepo(workspacePath)) return skipped("not_a_git_repository", { workspacePath });

  const branch = input.branch?.trim();
  if (!branch || !validRef(branch)) return fail("Invalid or missing branch name", { workspacePath });

  const result = await runGitCheckout(workspacePath, branch, Boolean(input.create));
  const output = joinOutput(result.stdout, result.stderr);
  return result.status === "PASS"
    ? pass({ workspacePath, output, exitCode: result.exitCode, branch })
    : fail(result.stderr || "git checkout failed", { workspacePath, output, exitCode: result.exitCode });
}

export interface GitMergeInput {
  workspacePath: string;
  branch: string;
}

export async function gitMerge(input: GitMergeInput): Promise<BaseOutput> {
  const v = validateWorkspacePath(input.workspacePath);
  if (!v.ok) return fail(v.error ?? "Invalid workspace");
  const workspacePath = v.resolvedPath!;
  if (!isGitRepo(workspacePath)) return skipped("not_a_git_repository", { workspacePath });

  const branch = input.branch?.trim();
  if (!branch || !validRef(branch)) return fail("Invalid or missing branch name", { workspacePath });

  const result = await runGitMerge(workspacePath, branch);
  const output = joinOutput(result.stdout, result.stderr);
  if (result.status === "PASS") {
    return pass({ workspacePath, output, exitCode: result.exitCode, branch });
  }
  const conflict = /conflict/i.test(output);
  return fail(conflict ? `Merge conflict: ${output}` : result.stderr || "git merge failed", {
    workspacePath,
    output,
    exitCode: result.exitCode,
    conflict,
  });
}
