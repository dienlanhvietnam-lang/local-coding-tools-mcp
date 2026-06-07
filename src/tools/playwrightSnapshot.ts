import { validateWorkspacePath } from "../safety/pathGuard.js";
import {
  getActivePage,
  PlaywrightNotAvailableError,
  PLAYWRIGHT_INSTALL_HINT,
  assertPlaywrightAvailable,
} from "../utils/playwrightSession.js";
import { pass, fail, skipped } from "../utils/result.js";

export interface PlaywrightSnapshotInput {
  workspacePath: string;
  maxChars?: number;
}

export interface PlaywrightSnapshotOutput {
  status: "PASS" | "FAIL" | "SKIPPED";
  workspacePath?: string;
  url?: string;
  title?: string;
  snapshot?: string;
  truncated?: boolean;
  reason?: string;
  installHint?: string;
  error?: string;
}

export async function playwrightSnapshot(
  input: PlaywrightSnapshotInput
): Promise<PlaywrightSnapshotOutput> {
  const validation = validateWorkspacePath(input.workspacePath);
  if (!validation.ok) return fail(validation.error ?? "Invalid workspace");

  const workspacePath = validation.resolvedPath!;

  try {
    await assertPlaywrightAvailable();
    const page = getActivePage(workspacePath);
    if (!page) {
      return fail("No active Playwright session — call playwright_navigate first", {
        workspacePath,
      });
    }

    const snapshot = await page.accessibility.snapshot();
    let text = JSON.stringify(snapshot, null, 2);
    const maxChars = input.maxChars ?? 32000;
    const truncated = text.length > maxChars;
    if (truncated) text = text.slice(0, maxChars);

    return pass({
      workspacePath,
      url: page.url(),
      title: await page.title(),
      snapshot: text,
      truncated,
    });
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
