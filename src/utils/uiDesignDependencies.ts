import { commandExists } from "./imageDependencies.js";
import { resolveBrowserExecutable } from "./browserResolve.js";

export const PLAYWRIGHT_INSTALL_HINT =
  "Run: npx playwright install chromium — or scripts/install-ui-design-deps.ps1 -InstallPlaywright";

export interface UiDesignDependencySnapshot {
  systemBrowser: boolean;
  systemBrowserPath: string | null;
  playwrightCore: boolean;
  axePlaywright: boolean;
  pixelmatch: boolean;
  pngjs: boolean;
}

export async function probePlaywrightCore(): Promise<boolean> {
  try {
    const mod = await import("playwright-core");
    return typeof mod.chromium?.launch === "function";
  } catch {
    return false;
  }
}

export async function probeAxePlaywright(): Promise<boolean> {
  try {
    const mod = await import("@axe-core/playwright");
    return typeof mod.AxeBuilder === "function" || typeof mod.default?.AxeBuilder === "function";
  } catch {
    return false;
  }
}

export async function probePixelmatch(): Promise<boolean> {
  try {
    const mod = await import("pixelmatch");
    return typeof mod.default === "function" || typeof mod === "function";
  } catch {
    return false;
  }
}

export async function probePngjs(): Promise<boolean> {
  try {
    const mod = await import("pngjs");
    return typeof mod.PNG?.sync?.read === "function";
  } catch {
    return false;
  }
}

export async function collectUiDesignDependencies(): Promise<UiDesignDependencySnapshot> {
  const browser = resolveBrowserExecutable({ prefer: "chrome" });
  const [playwrightCore, axePlaywright, pixelmatch, pngjs] = await Promise.all([
    probePlaywrightCore(),
    probeAxePlaywright(),
    probePixelmatch(),
    probePngjs(),
  ]);

  return {
    systemBrowser: browser !== null,
    systemBrowserPath: browser?.path ?? null,
    playwrightCore,
    axePlaywright,
    pixelmatch,
    pngjs,
  };
}

export function uiDesignCoreReady(snap: UiDesignDependencySnapshot): boolean {
  return snap.pixelmatch && snap.pngjs;
}

export function uiDesignFullReady(snap: UiDesignDependencySnapshot): boolean {
  return uiDesignCoreReady(snap) && snap.playwrightCore && snap.axePlaywright;
}

export async function probeLighthouseCli(): Promise<boolean> {
  const r = await commandExists("lighthouse");
  return r.ok;
}
