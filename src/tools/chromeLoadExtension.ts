import path from "node:path";
import fs from "node:fs";
import { spawn } from "node:child_process";
import { validateWorkspacePath } from "../safety/pathGuard.js";
import { pass, fail, skipped } from "../utils/result.js";
import {
  resolveBrowserExecutable,
  resolveChromeExecutable,
  type BrowserKind,
  type BrowserPrefer,
} from "../utils/browserResolve.js";

export type { BrowserKind, BrowserPrefer };
export { resolveBrowserExecutable, resolveChromeExecutable };

export interface ChromeLoadExtensionInput {
  workspacePath: string;
  extensionPath: string;
  chromePath?: string;
  prefer?: BrowserPrefer;
  startUrl?: string;
  reuseProfile?: boolean;
}

export interface ChromeLoadExtensionOutput {
  status: "PASS" | "FAIL" | "SKIPPED";
  workspacePath?: string;
  extensionPath?: string;
  chromePath?: string;
  browser?: BrowserKind;
  userDataDir?: string;
  pid?: number;
  error?: string;
  reason?: string;
}

export function buildChromeLaunchArgs(
  extensionPath: string,
  userDataDir: string,
  startUrl?: string
): string[] {
  const args = [
    `--disable-extensions-except=${extensionPath}`,
    `--load-extension=${extensionPath}`,
    `--user-data-dir=${userDataDir}`,
    "--enable-extensions",
    "--no-first-run",
    "--no-default-browser-check",
  ];
  if (startUrl?.trim()) {
    args.push(startUrl.trim());
  }
  return args;
}

export async function chromeLoadExtension(
  input: ChromeLoadExtensionInput
): Promise<ChromeLoadExtensionOutput> {
  const validation = validateWorkspacePath(input.workspacePath);
  if (!validation.ok) {
    return fail(validation.error ?? "Invalid workspace");
  }

  const workspacePath = validation.resolvedPath!;
  const extensionPath = path.isAbsolute(input.extensionPath)
    ? path.resolve(input.extensionPath)
    : path.resolve(workspacePath, input.extensionPath);

  if (!fs.existsSync(extensionPath)) {
    return fail("Extension path does not exist", { workspacePath, extensionPath });
  }

  const manifestPath = path.join(extensionPath, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    return fail("extensionPath must contain manifest.json (unpacked extension)", {
      workspacePath,
      extensionPath,
    });
  }

  const browser = resolveBrowserExecutable({
    chromePath: input.chromePath,
    prefer: input.prefer,
  });
  if (!browser) {
    return skipped("chrome_not_found", {
      workspacePath,
      extensionPath,
      reason: "Chrome/Edge not found — set chromePath explicitly",
    });
  }

  const profileBase = path.join(workspacePath, ".mcp-debug", "chrome-profile");
  const userDataDir = input.reuseProfile
    ? profileBase
    : path.join(profileBase, `run-${Date.now()}`);
  fs.mkdirSync(userDataDir, { recursive: true });

  try {
    const child = spawn(
      browser.path,
      buildChromeLaunchArgs(extensionPath, userDataDir, input.startUrl),
      {
        detached: true,
        stdio: "ignore",
        windowsHide: true,
        shell: false,
      }
    );

    child.unref();

    if (child.pid === undefined) {
      return fail("Browser process failed to start (no pid)", {
        workspacePath,
        extensionPath,
        chromePath: browser.path,
        browser: browser.browser,
        userDataDir,
      });
    }

    return pass({
      workspacePath,
      extensionPath,
      chromePath: browser.path,
      browser: browser.browser,
      userDataDir,
      pid: child.pid,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return fail(message, {
      workspacePath,
      extensionPath,
      chromePath: browser.path,
      browser: browser.browser,
    });
  }
}
