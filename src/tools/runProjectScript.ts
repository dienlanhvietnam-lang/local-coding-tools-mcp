import path from "node:path";
import { DEFAULT_SCRIPT_TIMEOUT_MS } from "../config.js";
import { validateWorkspacePath } from "../utils/fsSafe.js";
import {
  detectPackageManager,
  runPackageScript,
} from "../utils/execSafe.js";
import { getScriptCommand } from "./listScripts.js";
import { assertWithinWorkspace } from "../safety/pathGuard.js";
import { pass, fail } from "../utils/result.js";
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
    projectSubdir = input.projectSubdir.replace(/\\/g, "/");
    packageDir = assertWithinWorkspace(workspacePath, projectSubdir);
  }

  const scriptLookup = getScriptCommand(packageDir, scriptName);
  if (!scriptLookup.ok) {
    return fail(scriptLookup.error, { workspacePath, script: scriptName, projectSubdir });
  }

  const pm = await detectPackageManager(packageDir);
  const result = await runPackageScript(packageDir, scriptName, timeoutMs, pm);

  const timedOut = result.status === "TIMEOUT";
  const output: RunProjectScriptOutput = {
    status: result.status === "PASS" ? "PASS" : "FAIL",
    workspacePath,
    script: scriptName,
    projectSubdir,
    exitCode: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr,
    timedOut,
    truncated: result.truncated,
  };

  if (timedOut) {
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
          timedOut,
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
