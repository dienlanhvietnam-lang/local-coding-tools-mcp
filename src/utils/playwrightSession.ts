import fs from "node:fs";
import path from "node:path";
import { resolveBrowserExecutable } from "./browserResolve.js";
import { resolveViewport, type ViewportPreset } from "./browserCdp.js";
import { probePlaywrightCore, PLAYWRIGHT_INSTALL_HINT } from "./uiDesignDependencies.js";

export { PLAYWRIGHT_INSTALL_HINT };

export class PlaywrightNotAvailableError extends Error {
  constructor() {
    super("PLAYWRIGHT_NOT_AVAILABLE");
    this.name = "PlaywrightNotAvailableError";
  }
}

export async function assertPlaywrightAvailable(): Promise<typeof import("playwright-core")> {
  if (!(await probePlaywrightCore())) {
    throw new PlaywrightNotAvailableError();
  }
  return import("playwright-core");
}

type PwBrowser = import("playwright-core").Browser;
type PwContext = import("playwright-core").BrowserContext;
type PwPage = import("playwright-core").Page;

interface StoredSession {
  browser: PwBrowser;
  context: PwContext;
  page: PwPage;
  workspacePath: string;
  currentUrl: string;
}

const sessions = new Map<string, StoredSession>();

function sessionDir(workspacePath: string): string {
  return path.join(workspacePath, ".mcp-debug", "playwright");
}

export async function closePlaywrightSession(workspacePath: string): Promise<boolean> {
  const key = path.resolve(workspacePath);
  const s = sessions.get(key);
  if (!s) return false;
  try {
    await s.context.close();
    await s.browser.close();
  } catch {
    // ignore
  }
  sessions.delete(key);
  return true;
}

export async function getPlaywrightSession(
  workspacePath: string,
  options?: {
    chromePath?: string;
    viewport?: ViewportPreset;
    headless?: boolean;
  }
): Promise<StoredSession> {
  const key = path.resolve(workspacePath);
  const existing = sessions.get(key);
  if (existing) return existing;

  const pw = await assertPlaywrightAvailable();
  const exe = resolveBrowserExecutable({ chromePath: options?.chromePath });
  const viewport = options?.viewport ?? resolveViewport("desktop");
  const dir = sessionDir(workspacePath);
  fs.mkdirSync(dir, { recursive: true });

  const browser = await pw.chromium.launch({
    headless: options?.headless ?? true,
    executablePath: exe?.path,
  });
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
  });
  const page = await context.newPage();
  const session: StoredSession = {
    browser,
    context,
    page,
    workspacePath: key,
    currentUrl: "about:blank",
  };
  sessions.set(key, session);
  return session;
}

export async function navigatePlaywright(
  workspacePath: string,
  url: string,
  options?: {
    chromePath?: string;
    viewport?: ViewportPreset;
    waitUntil?: "load" | "domcontentloaded" | "networkidle";
    timeoutMs?: number;
  }
): Promise<{ url: string; title: string }> {
  const session = await getPlaywrightSession(workspacePath, {
    chromePath: options?.chromePath,
    viewport: options?.viewport,
  });
  await session.page.goto(url, {
    waitUntil: options?.waitUntil ?? "domcontentloaded",
    timeout: options?.timeoutMs ?? 30000,
  });
  session.currentUrl = session.page.url();
  const title = await session.page.title();
  return { url: session.currentUrl, title };
}

export function getActivePage(workspacePath: string): PwPage | null {
  return sessions.get(path.resolve(workspacePath))?.page ?? null;
}
