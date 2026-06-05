import { spawn } from "node:child_process";
import path from "node:path";
import { assertWithinWorkspace } from "../safety/pathGuard.js";
import { redactSecrets } from "../safety/secretRedactor.js";
import { MAX_OUTPUT_CHARS } from "../config.js";

export interface ExecResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  truncated: boolean;
}

export interface ExecOptions {
  cwd: string;
  timeoutMs?: number;
  env?: NodeJS.ProcessEnv;
}

function truncateOutput(text: string, maxChars: number): { text: string; truncated: boolean } {
  if (text.length <= maxChars) {
    return { text, truncated: false };
  }
  return {
    text: text.slice(0, maxChars) + `\n...[truncated ${text.length - maxChars} chars]`,
    truncated: true,
  };
}

export function runCommand(
  command: string,
  args: string[],
  options: ExecOptions
): Promise<ExecResult> {
  const cwd = path.resolve(options.cwd);
  const timeoutMs = options.timeoutMs ?? 120_000;

  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...options.env },
      shell: process.platform === "win32",
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 2000);
    }, timeoutMs);

    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on("close", (exitCode) => {
      clearTimeout(timer);
      const out = truncateOutput(redactSecrets(stdout), MAX_OUTPUT_CHARS);
      const err = truncateOutput(redactSecrets(stderr), MAX_OUTPUT_CHARS);
      resolve({
        exitCode,
        stdout: out.text,
        stderr: err.text,
        timedOut,
        truncated: out.truncated || err.truncated,
      });
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({
        exitCode: 1,
        stdout: "",
        stderr: redactSecrets(err.message),
        timedOut: false,
        truncated: false,
      });
    });
  });
}

/** Run npm/pnpm script via package manager (no free-form shell) */
export async function runPackageScript(
  workspacePath: string,
  scriptName: string,
  timeoutMs: number,
  packageManager: "npm" | "pnpm" = "npm"
): Promise<ExecResult & { workspacePath: string }> {
  const cwd = assertWithinWorkspace(workspacePath, ".");
  const pmArgs = ["run", scriptName];
  const result = await runCommand(packageManager, pmArgs, { cwd, timeoutMs });
  return { ...result, workspacePath: cwd };
}

export async function runGitShortStatus(workspacePath: string): Promise<ExecResult> {
  const cwd = assertWithinWorkspace(workspacePath, ".");
  return runCommand("git", ["status", "--short", "--branch"], { cwd, timeoutMs: 30_000 });
}

export async function detectPackageManager(workspacePath: string): Promise<"npm" | "pnpm"> {
  const cwd = path.resolve(workspacePath);
  try {
    const { execSync } = await import("node:child_process");
    execSync("pnpm --version", { cwd, stdio: "ignore" });
    const lock = path.join(cwd, "pnpm-lock.yaml");
    const fs = await import("node:fs");
    if (fs.existsSync(lock)) return "pnpm";
  } catch {
    // fall through
  }
  return "npm";
}

export async function getToolVersion(
  command: string,
  versionArgs: string[] = ["--version"]
): Promise<{ ok: boolean; version?: string; error?: string }> {
  try {
    const result = await runCommand(command, versionArgs, {
      cwd: process.cwd(),
      timeoutMs: 10_000,
    });
    if (result.exitCode !== 0) {
      return { ok: false, error: result.stderr || `Exit code ${result.exitCode}` };
    }
    const version = (result.stdout || result.stderr).trim().split("\n")[0];
    return { ok: true, version };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
