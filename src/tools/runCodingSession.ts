import { checkSystem } from "./checkSystem.js";
import { checkWorkspace } from "./checkWorkspace.js";
import { readProjectInfo } from "./readProjectInfo.js";
import { listScripts } from "./listScripts.js";
import { runProjectScript } from "./runProjectScript.js";
import { gitStatus } from "./gitStatus.js";
import { collectDebugBundle } from "./collectDebugBundle.js";

export interface RunCodingSessionInput {
  workspacePath: string;
  runScript?: boolean;
  collectBundle?: boolean;
}

export interface RunCodingSessionOutput {
  status: "PASS" | "PARTIAL" | "FAIL";
  workspacePath: string;
  steps: Record<string, unknown>;
  runProjectScript: "PASS" | "FAIL" | "SKIPPED";
  summary: string[];
}

/**
 * Chạy full workflow coding trong 1 tool call — giảm số lần Cursor hỏi quyền MCP.
 */
export async function runCodingSession(
  input: RunCodingSessionInput
): Promise<RunCodingSessionOutput> {
  const validation = await checkWorkspace({ workspacePath: input.workspacePath });
  if (validation.status !== "PASS") {
    return {
      status: "FAIL",
      workspacePath: input.workspacePath,
      steps: { check_workspace: validation },
      runProjectScript: "SKIPPED",
      summary: ["check_workspace FAIL"],
    };
  }

  const workspacePath = validation.workspacePath!;
  const steps: Record<string, unknown> = {};
  const summary: string[] = [];
  let failCount = 0;

  steps.check_system = await checkSystem();
  summary.push(`check_system: ${(steps.check_system as { status: string }).status}`);

  steps.check_workspace = validation;
  summary.push("check_workspace: PASS");

  steps.read_project_info = await readProjectInfo({ workspacePath });
  summary.push(`read_project_info: ${(steps.read_project_info as { status: string }).status}`);
  if ((steps.read_project_info as { status: string }).status === "FAIL") failCount++;

  steps.list_scripts = await listScripts({ workspacePath });
  summary.push(`list_scripts: ${(steps.list_scripts as { status: string }).status}`);
  if ((steps.list_scripts as { status: string }).status === "FAIL") failCount++;

  let runResult: "PASS" | "FAIL" | "SKIPPED" = "SKIPPED";
  if (input.runScript !== false) {
    const scripts = (steps.list_scripts as { scripts?: Array<{ name: string }> }).scripts ?? [];
    const names = scripts.map((s) => s.name);
    const scriptToRun = names.includes("build")
      ? "build"
      : names.includes("test")
        ? "test"
        : null;

    if (scriptToRun) {
      steps.run_project_script = await runProjectScript({
        workspacePath,
        script: scriptToRun,
      });
      runResult =
        (steps.run_project_script as { status: string }).status === "PASS" ? "PASS" : "FAIL";
      summary.push(`run_project_script (${scriptToRun}): ${runResult}`);
      if (runResult === "FAIL") failCount++;
    } else {
      steps.run_project_script = { status: "SKIPPED", reason: "no build or test script" };
      summary.push("run_project_script: SKIPPED");
    }
  } else {
    steps.run_project_script = { status: "SKIPPED", reason: "runScript=false" };
    summary.push("run_project_script: SKIPPED");
  }

  steps.git_status = await gitStatus({ workspacePath });
  summary.push(`git_status: ${(steps.git_status as { status: string }).status}`);

  if (input.collectBundle !== false) {
    steps.collect_debug_bundle = await collectDebugBundle({ workspacePath });
    summary.push(
      `collect_debug_bundle: ${(steps.collect_debug_bundle as { status: string }).status}`
    );
    if ((steps.collect_debug_bundle as { status: string }).status === "FAIL") failCount++;
  }

  const overallStatus =
    failCount === 0 ? "PASS" : failCount <= 2 ? "PARTIAL" : "FAIL";

  return {
    status: overallStatus,
    workspacePath,
    steps,
    runProjectScript: runResult,
    summary,
  };
}
