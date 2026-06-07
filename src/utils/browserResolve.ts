import path from "node:path";
import fs from "node:fs";

export type BrowserKind = "chrome" | "edge" | "chromium";
export type BrowserPrefer = "chrome" | "edge" | "any";

interface BrowserCandidate {
  path: string;
  browser: BrowserKind;
}

export function detectBrowserFromPath(exePath: string): BrowserKind {
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
    { path: path.join(programFiles, "Google", "Chrome", "Application", "chrome.exe"), browser: "chrome" },
    { path: path.join(programFilesX86, "Google", "Chrome", "Application", "chrome.exe"), browser: "chrome" },
    { path: path.join(localAppData, "Google", "Chrome", "Application", "chrome.exe"), browser: "chrome" },
    { path: path.join(programFiles, "Microsoft", "Edge", "Application", "msedge.exe"), browser: "edge" },
    { path: path.join(programFilesX86, "Microsoft", "Edge", "Application", "msedge.exe"), browser: "edge" },
  ];
}

function macCandidates(): BrowserCandidate[] {
  return [
    { path: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", browser: "chrome" },
    { path: "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge", browser: "edge" },
    { path: "/Applications/Chromium.app/Contents/MacOS/Chromium", browser: "chromium" },
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
