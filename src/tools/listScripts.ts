import { readJsonInWorkspace, validateWorkspacePath } from "../utils/fsSafe.js";
import { pass, fail } from "../utils/result.js";

export interface ListScriptsInput {
  workspacePath: string;
}

export interface ScriptEntry {
  name: string;
  command: string;
}

export interface ListScriptsOutput {
  status: "PASS" | "FAIL";
  workspacePath?: string;
  scripts?: ScriptEntry[];
  count?: number;
  error?: string;
}

export async function listScripts(input: ListScriptsInput): Promise<ListScriptsOutput> {
  const validation = validateWorkspacePath(input.workspacePath);
  if (!validation.ok) {
    return fail(validation.error ?? "Invalid workspace");
  }

  const workspacePath = validation.resolvedPath!;
  const pkg = readJsonInWorkspace<{ scripts?: Record<string, string> }>(
    workspacePath,
    "package.json"
  );

  if (!pkg) {
    return fail("package.json not found or invalid", { workspacePath });
  }

  const scriptsObj = pkg.scripts ?? {};
  const scripts: ScriptEntry[] = Object.entries(scriptsObj).map(([name, command]) => ({
    name,
    command,
  }));

  return pass({
    workspacePath,
    scripts,
    count: scripts.length,
  });
}

/** Resolve script command string from package.json — used by run_project_script guard */
export function getScriptCommand(
  workspacePath: string,
  scriptName: string
): { ok: true; command: string } | { ok: false; error: string } {
  const pkg = readJsonInWorkspace<{ scripts?: Record<string, string> }>(
    workspacePath,
    "package.json"
  );
  if (!pkg?.scripts) {
    return { ok: false, error: "No scripts in package.json" };
  }
  const command = pkg.scripts[scriptName];
  if (!command) {
    return { ok: false, error: `Script "${scriptName}" not found in package.json` };
  }
  return { ok: true, command };
}
