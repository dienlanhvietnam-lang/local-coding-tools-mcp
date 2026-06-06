import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { MAX_OUTPUT_CHARS } from "../config.js";
import { logRuntimeEvent, tailText } from "./runtimeLog.js";

const SHELL_METACHAR_RE = /[;&|`$()<>]/;

/**
 * Resolve npm/npx/pnpm to node + cli.js (avoids .cmd + shell on Windows).
 */
function resolveNodeCli(
  command: string,
  args: string[]
): { executable: string; args: string[] } | null {
  const nodeDir = path.dirname(process.execPath);
  const cliMap: Record<string, string> = {
    npm: path.join(nodeDir, "node_modules", "npm", "bin", "npm-cli.js"),
    npx: path.join(nodeDir, "node_modules", "npm", "bin", "npx-cli.js"),
    pnpm: path.join(nodeDir, "node_modules", "pnpm", "bin", "pnpm.cjs"),
  };
  const cli = cliMap[command];
  if (cli && fs.existsSync(cli)) {
    return { executable: process.execPath, args: [cli, ...args] };
  }
  return null;
}

/** Prefer .exe over .cmd/.bat on Windows PATH. */
function resolveWin32Executable(command: string): string {
  if (command.includes(path.sep) || command.includes("/")) return command;
  if (command.includes(".")) return command;

  const paths = (process.env.PATH || "").split(";");
  const extensions = [".exe", ".cmd", ".bat"];

  for (const dir of paths) {
    if (!dir) continue;
    const base = path.join(dir, command);
    for (const ext of extensions) {
      const full = base + ext;
      if (fs.existsSync(full)) return full;
    }
  }
  return command;
}

function winQuote(arg: string): string {
  if (!/[\s"]/.test(arg)) return arg;
  return `"${arg.replace(/"/g, '\\"')}"`;
}

export interface ExecResult {
  status: "PASS" | "FAIL" | "TIMEOUT";
  command: string;
  args: string[];
  exitCode: number | null;
  durationMs: number;
  stdout: string;
  stderr: string;
  truncated: boolean;
}

export interface ExecOptions {
  cwd?: string;
  workspacePath?: string;
  timeoutMs?: number;
  maxOutputChars?: number;
  env?: NodeJS.ProcessEnv;
}

function truncateOutput(
  text: string,
  maxChars: number
): { text: string; truncated: boolean } {
  if (text.length <= maxChars) {
    return { text, truncated: false };
  }
  return {
    text: text.slice(0, maxChars) + `\n...[truncated ${text.length - maxChars} chars]`,
    truncated: true,
  };
}

function resolveSpawnTarget(
  command: string,
  args: string[]
): { executable: string; args: string[]; viaCmd: boolean } {
  const nodeCli = resolveNodeCli(command, args);
  if (nodeCli) {
    return { executable: nodeCli.executable, args: nodeCli.args, viaCmd: false };
  }

  const executable =
    process.platform === "win32" ? resolveWin32Executable(command) : command;

  if (process.platform === "win32" && /\.(cmd|bat)$/i.test(executable)) {
    const inner = [executable, ...args.map(winQuote)].join(" ");
    return {
      executable: process.env.comspec ?? "cmd.exe",
      args: ["/d", "/s", "/c", inner],
      viaCmd: true,
    };
  }

  return { executable, args, viaCmd: false };
}

/**
 * Validate command is a single executable name — never a shell line.
 */
export function assertSafeCommand(command: string): void {
  if (!command || command.trim() !== command) {
    throw new Error("runCommand: command must be a non-empty executable name");
  }
  if (command.includes(" ") || SHELL_METACHAR_RE.test(command)) {
    throw new Error(
      "runCommand: command must not contain spaces or shell metacharacters — use args[]"
    );
  }
}

/**
 * Run a child process with command + args array. Default shell: false (no DEP0190).
 */
export function runCommand(
  command: string,
  args: string[],
  options: ExecOptions = {}
): Promise<ExecResult> {
  assertSafeCommand(command);

  const cwd = options.cwd ? path.resolve(options.cwd) : process.cwd();

  const timeoutMs = options.timeoutMs ?? 120_000;
  const maxOutputChars = options.maxOutputChars ?? MAX_OUTPUT_CHARS;
  const startTime = Date.now();
  const startIso = new Date(startTime).toISOString();
  const target = resolveSpawnTarget(command, args);

  logRuntimeEvent({
    kind: "spawn_start",
    command: target.executable,
    args: target.args,
    cwd,
    shell: "false",
    startTime: startIso,
    timeoutMs,
  });

  return new Promise((resolve) => {
    const child = spawn(target.executable, target.args, {
      cwd,
      env: { ...process.env, ...options.env },
      shell: false,
      windowsHide: true,
      windowsVerbatimArguments: target.viaCmd,
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

    child.on("close", (exitCode, signal) => {
      clearTimeout(timer);
      const durationMs = Date.now() - startTime;
      const out = truncateOutput(stdout, maxOutputChars);
      const err = truncateOutput(stderr, maxOutputChars);
      const status: "PASS" | "FAIL" | "TIMEOUT" = timedOut
        ? "TIMEOUT"
        : exitCode === 0
          ? "PASS"
          : "FAIL";
      logRuntimeEvent({
        kind: timedOut ? "spawn_timeout" : status === "PASS" ? "spawn_pass" : "spawn_fail",
        command: target.executable,
        args: target.args,
        cwd,
        shell: "false",
        startTime: startIso,
        endTime: new Date().toISOString(),
        durationMs,
        exitCode,
        signal,
        status,
        stdoutTail: stdout,
        stderrTail: stderr,
        timeoutMs,
        cancelReason: timedOut ? `timeout after ${timeoutMs}ms` : undefined,
      });
      resolve({
        status,
        command,
        args,
        exitCode,
        durationMs,
        stdout: out.text,
        stderr: err.text,
        truncated: out.truncated || err.truncated,
      });
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      const durationMs = Date.now() - startTime;
      logRuntimeEvent({
        kind: "spawn_error",
        command: target.executable,
        args: target.args,
        cwd,
        shell: "false",
        startTime: startIso,
        endTime: new Date().toISOString(),
        durationMs,
        status: "FAIL",
        error: err.message,
        stdoutTail: tailText(stdout),
        stderrTail: tailText(stderr),
      });
      resolve({
        status: "FAIL",
        command,
        args,
        exitCode: 1,
        durationMs,
        stdout: "",
        stderr: err.message,
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
  const cwd = path.resolve(workspacePath);
  const result = await runCommand(packageManager, ["run", scriptName], {
    cwd,
    timeoutMs,
  });
  return { ...result, workspacePath: cwd };
}

export async function runGitShortStatus(workspacePath: string): Promise<ExecResult> {
  const cwd = path.resolve(workspacePath);
  return runCommand("git", ["status", "--short", "--branch"], {
    cwd,
    timeoutMs: 30_000,
  });
}

export async function detectPackageManager(workspacePath: string): Promise<"npm" | "pnpm"> {
  const cwd = path.resolve(workspacePath);
  try {
    const result = await runCommand("pnpm", ["--version"], { cwd, timeoutMs: 10_000 });
    if (result.status === "PASS") {
      const lock = path.join(cwd, "pnpm-lock.yaml");
      if (fs.existsSync(lock)) return "pnpm";
    }
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
