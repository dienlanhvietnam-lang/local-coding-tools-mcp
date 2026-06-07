import { validateWorkspacePath } from "../../safety/pathGuard.js";
import { fail } from "../../utils/result.js";
import { runVsixPreflight } from "./vsixUtils.js";

export interface VsixCheckMarketplaceInput {
  workspacePath: string;
  checkMarketplace?: boolean;
}

export async function vsixCheckMarketplace(input: VsixCheckMarketplaceInput) {
  const validation = validateWorkspacePath(input.workspacePath);
  if (!validation.ok) return fail(validation.error ?? "Invalid workspace");

  const workspacePath = validation.resolvedPath!;
  const result = await runVsixPreflight(workspacePath, {
    checkMarketplace: input.checkMarketplace ?? false,
  });

  if (!result.meta) {
    return {
      status: "FAIL" as const,
      workspacePath,
      errors: result.errors,
      warnings: result.warnings,
      checks: result.checks,
      vsceAvailable: result.vsceAvailable,
      vsceHint: result.vsceHint,
    };
  }

  return {
    status: result.status,
    workspacePath,
    extensionId: result.meta.extensionId,
    publisher: result.meta.publisher,
    name: result.meta.name,
    version: result.meta.version,
    checks: result.checks,
    warnings: result.warnings,
    errors: result.errors,
    marketplaceUrl: result.marketplaceUrl,
    vsceAvailable: result.vsceAvailable,
    vsceHint: result.vsceHint,
  };
}
