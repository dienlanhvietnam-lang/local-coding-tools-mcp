import { validateWorkspacePath } from "../safety/pathGuard.js";
import {
  closePlaywrightSession,
  PlaywrightNotAvailableError,
  PLAYWRIGHT_INSTALL_HINT,
} from "../utils/playwrightSession.js";
import { pass, fail, skipped } from "../utils/result.js";

export interface PlaywrightCloseInput {
  workspacePath: string;
}

export interface PlaywrightCloseOutput {
  status: "PASS" | "FAIL" | "SKIPPED";
  workspacePath?: string;
  closed?: boolean;
  reason?: string;
  installHint?: string;
  error?: string;
}

export async function playwrightClose(
  input: PlaywrightCloseInput
): Promise<PlaywrightCloseOutput> {
  const validation = validateWorkspacePath(input.workspacePath);
  if (!validation.ok) return fail(validation.error ?? "Invalid workspace");

  const workspacePath = validation.resolvedPath!;

  try {
    const closed = await closePlaywrightSession(workspacePath);
    return pass({ workspacePath, closed });
  } catch (err) {
    if (err instanceof PlaywrightNotAvailableError) {
      return skipped("missing_dependency", {
        workspacePath,
        installHint: PLAYWRIGHT_INSTALL_HINT,
      });
    }
    const message = err instanceof Error ? err.message : String(err);
    return fail(message, { workspacePath });
  }
}
