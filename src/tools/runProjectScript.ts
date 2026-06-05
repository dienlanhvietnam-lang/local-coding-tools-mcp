import path from "node:path";
import { DEFAULT_SCRIPT_TIMEOUT_MS } from "../config.js";
import { isDangerousCommand, hasSuspiciousAbsolutePath } from "../safety/commandGuard.js";
import { validateWorkspacePath } from "../utils/fsSafe.js";
import {
  detectPackageManager,
  runPackageScript,
} from "../utils/execSafe.js";
import { getScriptCommand } from "./listScripts.js";
import { assertWithinWorkspace } from "../safety/pathGuard.js";
import { blocked, pass, fail } from "../utils/result.js";
import { writeFileInWorkspace } from "../utils/fsSafe.js";

export interface RunProjectScriptInput {
  workspacePath: string;
  script: string;
  projectSubdir?: string;
  timeoutMs?: number;
}

export interface RunProjectScriptOutput {
  status: "PASS" | "FAIL" | "BLOCKED";
  workspacePath?: string;
  script?: string;
  projectSubdir?: string;
  exitCode?: number | null;
  stdout?: string;
  stderr?: string;
  timedOut?: boolean;
  truncated?: boolean;
  error?: string;
}

export async function runProjectScript(
  input: RunProjectScriptInput
): Promise<RunProjectScriptOutput> {
  const validation = validateWorkspacePath(input.workspacePath);
  if (!validation.ok) {
    return fail(validation.error ?? "Invalid workspace");
  }

  const workspacePath = validation.resolvedPath!;
  const scriptName = input.script.trim();
  const timeoutMs = input.timeoutMs ?? DEFAULT_SCRIPT_TIMEOUT_MS;

  // Determine package directory — supports subdirectory (monorepo/scoped)
  let packageDir = workspacePath;
  let projectSubdir: string | undefined;

  if (input.projectSubdir) {
    // Block path traversal
    const normalized = input.projectSubdir.replace(/\\/g, "/");
    if (normalized.includes("..")) {
      return fail("projectSubdir must not contain path traversal (..)", {
        workspacePath,
        script: scriptName,
      });
    }
    // Ensure subdir is within workspace
    projectSubdir = normalized;
    packageDir = assertWithinWorkspace(workspacePath, normalized);
  }

  const scriptLookup = getScriptCommand(packageDir, scriptName);
  if (!scriptLookup.ok) {
    return fail(scriptLookup.error, { workspacePath, script: scriptName, projectSubdir });
  }

  const command = scriptLookup.command;
  const danger = isDangerousCommand(command);
  if (!danger.allowed) {
    return blocked(danger.reason ?? "Dangerous script blocked") as RunProjectScriptOutput;
  }

  if (hasSuspiciousAbsolutePath(command)) {
    return blocked(
      "Script contains suspicious absolute path invocation"
    ) as RunProjectScriptOutput;
  }

  const pm = await detectPackageManager(packageDir);
  const result = await runPackageScript(packageDir, scriptName, timeoutMs, pm);

  const output: RunProjectScriptOutput = {
    status: result.exitCode === 0 && !result.timedOut ? "PASS" : "FAIL",
    workspacePath,
    script: scriptName,
    projectSubdir,
    exitCode: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr,
    timedOut: result.timedOut,
    truncated: result.truncated,
  };

  if (result.timedOut) {
    output.error = `Script timed out after ${timeoutMs}ms`;
  }

  try {
    writeFileInWorkspace(
      workspacePath,
      ".mcp-debug/last-command-result.json",
      JSON.stringify(
        {
          script: scriptName,
          projectSubdir,
          exitCode: result.exitCode,
          timedOut: result.timedOut,
          truncated: result.truncated,
          recordedAt: new Date().toISOString(),
        },
        null,
        2
      )
    );
  } catch {
    // non-fatal
  }

  return output;
}
