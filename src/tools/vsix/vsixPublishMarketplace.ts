import path from "node:path";
import { validateWorkspacePath } from "../../safety/pathGuard.js";
import { redactSecrets } from "../../safety/secretRedactor.js";
import { runCommand } from "../../utils/execSafe.js";
import { fail } from "../../utils/result.js";
import { vsixPackage } from "./vsixPackage.js";
import {
  assertVsixInWorkspace,
  hasVscePat,
  marketplaceUrl,
  redactExecOutput,
  resolveExtensionMeta,
  resolveVsceInvocation,
  runVsixPreflight,
  vscePatConfigured,
} from "./vsixUtils.js";

export interface VsixPublishMarketplaceInput {
  workspacePath: string;
  vsixPath?: string;
  confirmPublish?: boolean;
  dryRun?: boolean;
}

export async function vsixPublishMarketplace(input: VsixPublishMarketplaceInput) {
  const validation = validateWorkspacePath(input.workspacePath);
  if (!validation.ok) return fail(validation.error ?? "Invalid workspace");

  const workspacePath = validation.resolvedPath!;

  if (input.confirmPublish !== true) {
    return {
      status: "BLOCKED" as const,
      reason: "confirm_required",
      workspacePath,
      hint: "Set confirmPublish=true only after explicit user approval",
    };
  }

  const metaResult = resolveExtensionMeta(workspacePath);
  const extensionId = metaResult.meta?.extensionId;
  const version = metaResult.meta?.version;
  const mktUrl =
    metaResult.meta != null
      ? marketplaceUrl(metaResult.meta.publisher, metaResult.meta.name)
      : undefined;

  if (input.dryRun) {
    const pat = vscePatConfigured();
    const invoke = resolveVsceInvocation(workspacePath, "publish", [
      "--packagePath",
      input.vsixPath ?? "<vsix-after-package>",
    ]);
    return {
      status: "DRY_RUN" as const,
      workspacePath,
      extensionId,
      version,
      marketplaceUrl: mktUrl,
      vscePat: pat,
      commandSummary: redactSecrets(`${invoke.label} --packagePath <vsix> (VSCE_PAT via env)`),
      reason: "dry_run",
    };
  }

  if (!hasVscePat()) {
    return {
      status: "BLOCKED" as const,
      reason: "missing_vsce_pat",
      workspacePath,
      hint: "Set VSCE_PAT environment variable — never paste PAT into chat or workspace files",
    };
  }

  const preflight = await runVsixPreflight(workspacePath);
  if (preflight.status === "FAIL") {
    return fail("vsix_check_marketplace FAIL — cannot publish", {
      workspacePath,
      errors: preflight.errors,
    });
  }

  let resolvedVsix: string;
  if (input.vsixPath?.trim()) {
    try {
      resolvedVsix = assertVsixInWorkspace(workspacePath, input.vsixPath.trim());
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return fail(message, { workspacePath });
    }
  } else {
    const packaged = await vsixPackage({ workspacePath, dryRun: false });
    if (packaged.status !== "PASS" || !("vsixPath" in packaged)) {
      return fail("Auto-package failed before publish", {
        workspacePath,
        packageStatus: packaged.status,
        ...( "error" in packaged ? { error: packaged.error } : {}),
      });
    }
    resolvedVsix = assertVsixInWorkspace(workspacePath, packaged.vsixPath as string);
  }

  const invoke = resolveVsceInvocation(workspacePath, "publish", [
    "--packagePath",
    resolvedVsix,
  ]);

  const exec = await runCommand(invoke.command, invoke.args, {
    cwd: workspacePath,
    timeoutMs: 300_000,
    env: {
      ...process.env,
      VSCE_PAT: process.env.VSCE_PAT,
    },
  });

  const redacted = redactExecOutput(exec);
  const meta = metaResult.meta ?? resolveExtensionMeta(workspacePath).meta;

  if (exec.status !== "PASS" || exec.exitCode !== 0) {
    const errText = redactSecrets(exec.stderr || exec.stdout || "publish failed");
    let reason = "publish_failed";
    if (/401|403|unauthorized|authentication/i.test(errText)) reason = "auth_failed";
    if (/already exists|duplicate|version/i.test(errText)) reason = "version_duplicate";
    return {
      status: "FAIL" as const,
      reason,
      workspacePath,
      extensionId: meta?.extensionId,
      version: meta?.version,
      vsixPath: path.relative(workspacePath, resolvedVsix).replace(/\\/g, "/"),
      marketplaceUrl: meta ? marketplaceUrl(meta.publisher, meta.name) : mktUrl,
      stderr: redacted.stderr,
      stdout: redacted.stdout,
      error: errText.slice(0, 500),
    };
  }

  return {
    status: "PASS" as const,
    workspacePath,
    extensionId: meta?.extensionId,
    version: meta?.version,
    vsixPath: path.relative(workspacePath, resolvedVsix).replace(/\\/g, "/"),
    marketplaceUrl: meta ? marketplaceUrl(meta.publisher, meta.name) : mktUrl,
    commandUsed: redactSecrets(invoke.label),
    warnings: preflight.warnings,
  };
}
