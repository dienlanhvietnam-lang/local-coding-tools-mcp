import fs from "node:fs";
import path from "node:path";
import { redactSecrets } from "../../safety/secretRedactor.js";
import { validateWorkspacePath } from "../../safety/pathGuard.js";
import { runCommand } from "../../utils/execSafe.js";
import { fail } from "../../utils/result.js";
import {
  assertOutputDirInWorkspace,
  findLatestVsix,
  redactExecOutput,
  resolveVsceInvocation,
  runVsixPreflight,
  sha256File,
} from "./vsixUtils.js";

export interface VsixPackageInput {
  workspacePath: string;
  outputDir?: string;
  packageManager?: "auto" | "npm" | "pnpm" | "yarn";
  dryRun?: boolean;
}

export async function vsixPackage(input: VsixPackageInput) {
  const validation = validateWorkspacePath(input.workspacePath);
  if (!validation.ok) return fail(validation.error ?? "Invalid workspace");

  const workspacePath = validation.resolvedPath!;
  const outputRel = input.outputDir?.trim() || "release";
  let outputDir: string;
  try {
    outputDir = assertOutputDirInWorkspace(workspacePath, outputRel);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return fail(message, { workspacePath });
  }

  const preflight = await runVsixPreflight(workspacePath);
  if (preflight.status === "FAIL") {
    return fail("vsix_check_marketplace failed — fix errors before packaging", {
      workspacePath,
      errors: preflight.errors,
      checks: preflight.checks,
    });
  }

  const invoke = resolveVsceInvocation(workspacePath, "package", [
    "--out",
    outputDir,
    "--allow-missing-repository",
    "--allow-unused-files-pattern",
  ]);

  if (input.dryRun) {
    return {
      status: "DRY_RUN" as const,
      workspacePath,
      outputDir: path.relative(workspacePath, outputDir).replace(/\\/g, "/"),
      commandUsed: invoke.label,
      warnings: preflight.warnings,
      extensionId: preflight.meta?.extensionId,
      version: preflight.meta?.version,
    };
  }

  fs.mkdirSync(outputDir, { recursive: true });

  const pm = input.packageManager ?? "auto";
  if (pm !== "auto") {
    const installArgs =
      pm === "npm" ? ["install"] : pm === "pnpm" ? ["install"] : ["install"];
    await runCommand(pm, installArgs, { cwd: workspacePath, timeoutMs: 300_000 });
  }

  const exec = await runCommand(invoke.command, invoke.args, {
    cwd: workspacePath,
    timeoutMs: 300_000,
  });

  const redacted = redactExecOutput(exec);

  if (exec.status !== "PASS" || exec.exitCode !== 0) {
    return fail(redactSecrets(exec.stderr || "vsce package failed"), {
      workspacePath,
      commandUsed: invoke.label,
      exitCode: exec.exitCode,
      stderr: redacted.stderr,
      stdout: redacted.stdout,
      warnings: preflight.warnings,
    });
  }

  const latest = findLatestVsix(outputDir) ?? findLatestVsix(workspacePath);
  if (!latest) {
    return fail("vsce completed but no .vsix file found", {
      workspacePath,
      commandUsed: invoke.label,
      warnings: preflight.warnings,
    });
  }

  const stat = fs.statSync(latest.path);
  return {
    status: "PASS" as const,
    workspacePath,
    vsixPath: path.relative(workspacePath, latest.path).replace(/\\/g, "/"),
    filename: latest.filename,
    sizeBytes: stat.size,
    sha256: sha256File(latest.path),
    commandUsed: invoke.label,
    warnings: preflight.warnings,
    extensionId: preflight.meta?.extensionId,
    version: preflight.meta?.version,
  };
}
