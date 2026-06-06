import path from "node:path";
import fs from "node:fs";
import { spawn } from "node:child_process";
import { validateWorkspacePath } from "../safety/pathGuard.js";
import { pass, fail, skipped } from "../utils/result.js";

export interface ChromeLoadExtensionInput {
  workspacePath: string;
  extensionPath: string;
  chromePath?: string;
}

export interface ChromeLoadExtensionOutput {
  status: "PASS" | "FAIL" | "SKIPPED";
  workspacePath?: string;
  extensionPath?: string;
  chromePath?: string;
  userDataDir?: string;
  pid?: number;
  error?: string;
  reason?: string;
}

const WINDOWS_CHROME_CANDIDATES = [
  path.join(process.env.ProgramFiles ?? "C:\\Program Files", "Google", "Chrome", "Application", "chrome.exe"),
  path.join(
    process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)",
    "Google",
    "Chrome",
    "Application",
    "chrome.exe"
  ),
  path.join(process.env.ProgramFiles ?? "C:\\Program Files", "Microsoft", "Edge", "Application", "msedge.exe"),
  path.join(
    process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)",
    "Microsoft",
    "Edge",
    "Application",
    "msedge.exe"
  ),
];

export function resolveChromeExecutable(explicit?: string): string | null {
  if (explicit?.trim()) {
    const p = path.resolve(explicit.trim());
    return fs.existsSync(p) ? p : null;
  }

  if (process.platform === "win32") {
    for (const candidate of WINDOWS_CHROME_CANDIDATES) {
      if (fs.existsSync(candidate)) return candidate;
    }
  }

  const pathEnv = process.env.PATH ?? "";
  const names = process.platform === "win32" ? ["chrome.exe", "msedge.exe", "chromium.exe"] : ["google-chrome", "chromium", "chromium-browser"];

  for (const dir of pathEnv.split(path.delimiter)) {
    if (!dir) continue;
    for (const name of names) {
      const full = path.join(dir, name);
      if (fs.existsSync(full)) return full;
    }
  }

  return null;
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

  const chromePath = resolveChromeExecutable(input.chromePath);
  if (!chromePath) {
    return skipped("chrome_not_found", {
      workspacePath,
      extensionPath,
      reason: "Chrome/Edge not found — set chromePath explicitly",
    });
  }

  const userDataDir = path.join(workspacePath, ".mcp-debug", "chrome-profile");
  fs.mkdirSync(userDataDir, { recursive: true });

  try {
    const child = spawn(
      chromePath,
      [
        `--load-extension=${extensionPath}`,
        `--user-data-dir=${userDataDir}`,
        "--no-first-run",
        "--no-default-browser-check",
      ],
      {
        detached: true,
        stdio: "ignore",
        windowsHide: true,
        shell: false,
      }
    );

    child.unref();

    return pass({
      workspacePath,
      extensionPath,
      chromePath,
      userDataDir,
      pid: child.pid,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return fail(message, { workspacePath, extensionPath, chromePath });
  }
}
