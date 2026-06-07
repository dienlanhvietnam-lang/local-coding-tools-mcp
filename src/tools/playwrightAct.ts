import { validateWorkspacePath } from "../safety/pathGuard.js";
import {
  getActivePage,
  PlaywrightNotAvailableError,
  PLAYWRIGHT_INSTALL_HINT,
  assertPlaywrightAvailable,
} from "../utils/playwrightSession.js";
import { pass, fail, skipped } from "../utils/result.js";

export type PlaywrightAction = "click" | "fill" | "press" | "select" | "hover";

export interface PlaywrightActInput {
  workspacePath: string;
  action: PlaywrightAction;
  selector: string;
  value?: string;
  timeoutMs?: number;
}

export interface PlaywrightActOutput {
  status: "PASS" | "FAIL" | "SKIPPED";
  workspacePath?: string;
  action?: string;
  selector?: string;
  url?: string;
  reason?: string;
  installHint?: string;
  error?: string;
}

export async function playwrightAct(input: PlaywrightActInput): Promise<PlaywrightActOutput> {
  const validation = validateWorkspacePath(input.workspacePath);
  if (!validation.ok) return fail(validation.error ?? "Invalid workspace");

  const workspacePath = validation.resolvedPath!;
  const selector = input.selector?.trim();
  if (!selector) return fail("selector is required");

  try {
    await assertPlaywrightAvailable();
    const page = getActivePage(workspacePath);
    if (!page) {
      return fail("No active Playwright session — call playwright_navigate first", {
        workspacePath,
      });
    }

    const timeout = input.timeoutMs ?? 15000;
    const loc = page.locator(selector).first();

    switch (input.action) {
      case "click":
        await loc.click({ timeout });
        break;
      case "fill":
        if (!input.value) return fail("value required for fill action");
        await loc.fill(input.value, { timeout });
        break;
      case "press":
        await loc.press(input.value ?? "Enter", { timeout });
        break;
      case "select":
        if (!input.value) return fail("value required for select action");
        await loc.selectOption(input.value, { timeout });
        break;
      case "hover":
        await loc.hover({ timeout });
        break;
      default:
        return fail(`Unknown action: ${input.action as string}`);
    }

    return pass({
      workspacePath,
      action: input.action,
      selector,
      url: page.url(),
    });
  } catch (err) {
    if (err instanceof PlaywrightNotAvailableError) {
      return skipped("missing_dependency", {
        workspacePath,
        installHint: PLAYWRIGHT_INSTALL_HINT,
      });
    }
    const message = err instanceof Error ? err.message : String(err);
    return fail(message, { workspacePath, action: input.action, selector });
  }
}
