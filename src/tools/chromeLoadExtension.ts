import path from "node:path";
import fs from "node:fs";
import { spawn } from "node:child_process";
import { validateWorkspacePath } from "../safety/pathGuard.js";
import { pass, fail, skipped } from "../utils/result.js";

export type BrowserKind = "chrome" | "edge" | "chromium";
export type BrowserPrefer = "chrome" | "edge" | "any";

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

interface BrowserCandidate {
  path: string;
  browser: BrowserKind;
}

function detectBrowserFromPath(exePath: string): BrowserKind {
  const base = path.basename(exePath).toLowerCase();
  if (base.includes("msedge") || base.includes("edge")) return "edge";
  if (base.includes("chromium")) return "chromium";
  return "chrome";
}

function windowsCandidates(): BrowserCandidate[] {
  const localAppData = process.env.LOCALAPPDATA ?? "";
  const programFiles = process.env.ProgramFiles ?? "C:\\Program Files";
  const programFilesX86 = process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)";

  return [
    {
      path: path.join(programFiles, "Google", "Chrome", "Application", "chrome.exe"),
      browser: "chrome",
    },
    {
      path: path.join(programFilesX86, "Google", "Chrome", "Application", "chrome.exe"),
      browser: "chrome",
    },
    {
      path: path.join(localAppData, "Google", "Chrome", "Application", "chrome.exe"),
      browser: "chrome",
    },
    {
      path: path.join(programFiles, "Microsoft", "Edge", "Application", "msedge.exe"),
      browser: "edge",
    },
    {
      path: path.join(programFilesX86, "Microsoft", "Edge", "Application", "msedge.exe"),
      browser: "edge",
    },
  ];
}

function macCandidates(): BrowserCandidate[] {
  return [
    {
      path: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      browser: "chrome",
    },
    {
      path: "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
      browser: "edge",
    },
    {
      path: "/Applications/Chromium.app/Contents/MacOS/Chromium",
      browser: "chromium",
    },
  ];
}

function linuxCandidates(): BrowserCandidate[] {
  return [
    { path: "/usr/bin/google-chrome", browser: "chrome" },
    { path: "/usr/bin/google-chrome-stable", browser: "chrome" },
    { path: "/usr/bin/chromium", browser: "chromium" },
    { path: "/usr/bin/chromium-browser", browser: "chromium" },
    { path: "/snap/bin/chromium", browser: "chromium" },
    { path: "/usr/bin/microsoft-edge", browser: "edge" },
  ];
}

function pathCandidates(): BrowserCandidate[] {
  const names =
    process.platform === "win32"
      ? [
          { name: "chrome.exe", browser: "chrome" as BrowserKind },
          { name: "msedge.exe", browser: "edge" as BrowserKind },
          { name: "chromium.exe", browser: "chromium" as BrowserKind },
        ]
      : [
          { name: "google-chrome", browser: "chrome" as BrowserKind },
          { name: "google-chrome-stable", browser: "chrome" as BrowserKind },
          { name: "chromium", browser: "chromium" as BrowserKind },
          { name: "chromium-browser", browser: "chromium" as BrowserKind },
          { name: "microsoft-edge", browser: "edge" as BrowserKind },
        ];

  const found: BrowserCandidate[] = [];
  const pathEnv = process.env.PATH ?? "";
  for (const dir of pathEnv.split(path.delimiter)) {
    if (!dir) continue;
    for (const entry of names) {
      const full = path.join(dir, entry.name);
      if (fs.existsSync(full)) {
        found.push({ path: full, browser: entry.browser });
      }
    }
  }
  return found;
}

function listCandidates(): BrowserCandidate[] {
  const platform =
    process.platform === "win32"
      ? windowsCandidates()
      : process.platform === "darwin"
        ? macCandidates()
        : linuxCandidates();

  const seen = new Set<string>();
  const all: BrowserCandidate[] = [];
  for (const candidate of [...platform, ...pathCandidates()]) {
    if (seen.has(candidate.path) || !fs.existsSync(candidate.path)) continue;
    seen.add(candidate.path);
    all.push(candidate);
  }
  return all;
}

function pickCandidate(candidates: BrowserCandidate[], prefer: BrowserPrefer): BrowserCandidate | null {
  if (candidates.length === 0) return null;

  if (prefer === "edge") {
    return (
      candidates.find((c) => c.browser === "edge") ??
      candidates.find((c) => c.browser === "chrome") ??
      candidates[0]
    );
  }

  if (prefer === "chrome") {
    return (
      candidates.find((c) => c.browser === "chrome") ??
      candidates.find((c) => c.browser === "chromium") ??
      candidates.find((c) => c.browser === "edge") ??
      null
    );
  }

  return candidates[0];
}

export function resolveBrowserExecutable(options?: {
  chromePath?: string;
  prefer?: BrowserPrefer;
}): { path: string; browser: BrowserKind } | null {
  const prefer = options?.prefer ?? "chrome";

  if (options?.chromePath?.trim()) {
    const resolved = path.resolve(options.chromePath.trim());
    return fs.existsSync(resolved)
      ? { path: resolved, browser: detectBrowserFromPath(resolved) }
      : null;
  }

  return pickCandidate(listCandidates(), prefer);
}

/** @deprecated Use resolveBrowserExecutable — kept for existing imports/tests. */
export function resolveChromeExecutable(explicit?: string): string | null {
  return resolveBrowserExecutable({ chromePath: explicit, prefer: "chrome" })?.path ?? null;
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
