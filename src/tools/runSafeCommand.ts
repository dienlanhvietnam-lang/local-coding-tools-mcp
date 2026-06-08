import path from "node:path";
import { validateWorkspacePath } from "../safety/pathGuard.js";
import { validateSafeCommand } from "../safety/safeCommandAllowlist.js";
import { runCommand } from "../utils/execSafe.js";
import { pass, fail } from "../utils/result.js";
import { saveCommandOutput } from "../utils/commandOutputStore.js";

export interface RunSafeCommandInput {
  workspacePath: string;
  command: string;
  args?: string[];
  timeoutMs?: number;
}

export interface RunSafeCommandOutput {
  status: "PASS" | "FAIL" | "TIMEOUT";
  workspacePath?: string;
  command?: string;
  args?: string[];
  exitCode?: number | null;
  durationMs?: number;
  stdout?: string;
  stderr?: string;
  truncated?: boolean;
  hint?: string;
  error?: string;
  outputId?: string;
  outputPath?: string;
  cacheId?: string;
  cacheUri?: string;
}

export async function runSafeCommand(
  input: RunSafeCommandInput
): Promise<RunSafeCommandOutput> {
  const validation = validateWorkspacePath(input.workspacePath);
  if (!validation.ok) {
    return fail(validation.error ?? "Invalid workspace");
  }

  const workspacePath = validation.resolvedPath!;
  const command = input.command.trim();
  const args = input.args ?? [];
  const check = validateSafeCommand(command, args);

  if (!check.allowed) {
    return fail(check.reason ?? "Command not allowed", { workspacePath, command, args });
  }

  const result = await runCommand(command, args, {
    cwd: path.resolve(workspacePath),
    timeoutMs: input.timeoutMs ?? 120_000,
    workspacePath,
  });

  const fullStdout = result.fullStdout ?? result.stdout;
  const fullStderr = result.fullStderr ?? result.stderr;
  const shouldPersist =
    result.truncated || fullStdout.length + fullStderr.length > 4_000;

  let saved: ReturnType<typeof saveCommandOutput> | undefined;
  if (shouldPersist) {
    try {
      saved = saveCommandOutput({
        workspacePath,
        tool: "run_safe_command",
        command,
        args,
        exitCode: result.exitCode,
        truncated: result.truncated,
        stdout: fullStdout,
        stderr: fullStderr,
      });
    } catch {
      // non-fatal
    }
  }

  const base = {
    workspacePath,
    command,
    args,
    exitCode: result.exitCode,
    durationMs: result.durationMs,
    stdout: result.stdout,
    stderr: result.stderr,
    truncated: result.truncated,
    ...(result.hint ? { hint: result.hint } : {}),
    ...(saved
      ? {
          outputId: saved.id,
          outputPath: saved.relativePath,
          cacheId: saved.cacheId,
          cacheUri: saved.cacheUri,
          hint:
            (result.hint ? `${result.hint} ` : "") +
            `Full output saved — read_command_output source=last or outputId=${saved.id}.`,
        }
      : {}),
  };

  if (result.status === "TIMEOUT") {
    return { status: "TIMEOUT", ...base, error: `Timeout after ${input.timeoutMs ?? 120_000}ms` };
  }

  if (result.status !== "PASS") {
    return fail(result.stderr || `Exit code ${result.exitCode}`, base);
  }

  return { status: "PASS", ...base };
}
