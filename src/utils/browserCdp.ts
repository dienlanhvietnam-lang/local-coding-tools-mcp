import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { resolveBrowserExecutable, type BrowserKind, type BrowserPrefer } from "./browserResolve.js";

export interface ViewportPreset {
  width: number;
  height: number;
  label: string;
}

export const VIEWPORT_PRESETS: Record<string, ViewportPreset> = {
  mobile: { width: 375, height: 812, label: "mobile" },
  tablet: { width: 768, height: 1024, label: "tablet" },
  desktop: { width: 1280, height: 800, label: "desktop" },
};

export function resolveViewport(
  preset?: string,
  customWidth?: number,
  customHeight?: number
): ViewportPreset {
  if (customWidth && customHeight) {
    return { width: customWidth, height: customHeight, label: "custom" };
  }
  const key = (preset ?? "desktop").toLowerCase();
  return VIEWPORT_PRESETS[key] ?? VIEWPORT_PRESETS.desktop;
}

export interface BrowserSessionOptions {
  chromePath?: string;
  prefer?: BrowserPrefer;
  userDataDir: string;
  viewport: ViewportPreset;
  timeoutMs?: number;
}

export interface ScreenshotResult {
  outputPath: string;
  width: number;
  height: number;
  browserPath: string;
  browser: BrowserKind;
}

const A11Y_LITE_SCRIPT = `
(() => {
  const issues = [];
  let id = 0;
  const add = (severity, rule, selector, message, fixHint) => {
    issues.push({ id: ++id, severity, rule, selector, message, fixHint });
  };

  document.querySelectorAll("img").forEach((img, i) => {
    const alt = img.getAttribute("alt");
    if (alt === null || alt.trim() === "") {
      add("serious", "img-alt", "img:nth-of-type(" + (i + 1) + ")", "Image missing alt text", "Add descriptive alt attribute");
    }
  });

  document.querySelectorAll("[aria-label]").forEach((el) => {
    if (!(el.getAttribute("aria-label") || "").trim()) {
      add("moderate", "aria-label-empty", el.tagName.toLowerCase(), "Empty aria-label", "Provide meaningful aria-label or remove attribute");
    }
  });

  const headings = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")];
  let lastLevel = 0;
  headings.forEach((h) => {
    const level = parseInt(h.tagName[1], 10);
    if (lastLevel && level > lastLevel + 1) {
      add("moderate", "heading-order", h.tagName.toLowerCase(), "Heading level skips from h" + lastLevel + " to h" + level, "Use sequential heading levels");
    }
    lastLevel = level;
  });

  document.querySelectorAll("button,a,input,select,textarea,[tabindex]").forEach((el) => {
    const tag = el.tagName.toLowerCase();
    const hasLabel =
      (el.getAttribute("aria-label") || "").trim() ||
      (el.textContent || "").trim() ||
      document.querySelector('label[for="' + el.id + '"]');
    if (!hasLabel && (tag === "button" || tag === "a")) {
      add("serious", "focusable-no-label", tag, "Interactive element without accessible name", "Add visible text or aria-label");
    }
  });

  const checkContrast = (el) => {
    const style = getComputedStyle(el);
    const fg = style.color;
    const bg = style.backgroundColor;
    if (!fg || !bg || bg === "rgba(0, 0, 0, 0)") return;
    const parse = (c) => {
      const m = c.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/);
      if (!m) return null;
      return [+m[1], +m[2], +m[3]];
    };
    const f = parse(fg);
    const b = parse(bg);
    if (!f || !b) return;
    const lum = (rgb) => {
      const [r, g, bl] = rgb.map((v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
    };
    const l1 = lum(f);
    const l2 = lum(b);
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    if (ratio < 4.5 && (el.textContent || "").trim()) {
      add("serious", "color-contrast", el.tagName.toLowerCase(), "Contrast ratio " + ratio.toFixed(2) + " below 4.5:1", "Increase text/background contrast");
    }
  };

  document.querySelectorAll("p,span,a,button,h1,h2,h3,h4,h5,h6,label").forEach(checkContrast);

  const critical = issues.filter((i) => i.severity === "critical" || i.severity === "serious").length;
  const score = Math.max(0, 100 - critical * 15 - (issues.length - critical) * 5);
  return { issues, score, issueCount: issues.length };
})();
`;

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function getWebSocketUrl(port: number, timeoutMs: number): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (res.ok) {
        const data = (await res.json()) as { webSocketDebuggerUrl?: string };
        if (data.webSocketDebuggerUrl) return data.webSocketDebuggerUrl;
      }
    } catch {
      // retry
    }
    await sleep(200);
  }
  throw new Error(`CDP not ready on port ${port} within ${timeoutMs}ms`);
}

type CdpMessage = { id?: number; method?: string; params?: Record<string, unknown>; result?: unknown; error?: { message: string } };

class SimpleCdpClient {
  private ws: WebSocket;
  private nextId = 1;
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

  constructor(ws: WebSocket) {
    this.ws = ws;
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(String(ev.data)) as CdpMessage;
      if (msg.id && this.pending.has(msg.id)) {
        const p = this.pending.get(msg.id)!;
        this.pending.delete(msg.id);
        if (msg.error) p.reject(new Error(msg.error.message));
        else p.resolve(msg.result);
      }
    });
  }

  send(method: string, params?: Record<string, unknown>, sessionId?: string): Promise<unknown> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      const payload: Record<string, unknown> = { id, method };
      if (sessionId) payload.sessionId = sessionId;
      if (params && Object.keys(params).length > 0) payload.params = params;
      this.ws.send(JSON.stringify(payload));
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP timeout: ${method}`));
        }
      }, 30000);
    });
  }

  close(): void {
    this.ws.close();
  }
}

function killProcess(proc: ChildProcess): void {
  try {
    if (proc.pid) {
      if (process.platform === "win32") {
        spawn("taskkill", ["/pid", String(proc.pid), "/f", "/t"], { stdio: "ignore", shell: false });
      } else {
        proc.kill("SIGTERM");
      }
    }
  } catch {
    // ignore
  }
}

export async function capturePageScreenshot(
  targetUrl: string,
  outputPath: string,
  options: BrowserSessionOptions
): Promise<ScreenshotResult> {
  const browser = resolveBrowserExecutable({
    chromePath: options.chromePath,
    prefer: options.prefer ?? "chrome",
  });
  if (!browser) {
    throw new Error("BROWSER_NOT_FOUND");
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const port = 9222 + Math.floor(Math.random() * 800);
  const timeoutMs = options.timeoutMs ?? 30000;

  const args = [
    `--user-data-dir=${options.userDataDir}`,
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--hide-scrollbars",
    `--window-size=${options.viewport.width},${options.viewport.height}`,
    `--remote-debugging-port=${port}`,
    "about:blank",
  ];

  const proc = spawn(browser.path, args, { stdio: "ignore", shell: false, windowsHide: true });

  let client: SimpleCdpClient | null = null;
  try {
    const wsUrl = await getWebSocketUrl(port, timeoutMs);
    const WS = globalThis.WebSocket;
    if (!WS) {
      throw new Error("WebSocket not available — use Node 20+ or install playwright for full UI tools");
    }
    const ws = new WS(wsUrl);
    await new Promise<void>((resolve, reject) => {
      ws.addEventListener("open", () => resolve());
      ws.addEventListener("error", () => reject(new Error("CDP WebSocket connection failed")));
      setTimeout(() => reject(new Error("CDP WebSocket open timeout")), timeoutMs);
    });

    client = new SimpleCdpClient(ws);
    await client.send("Target.setDiscoverTargets", { discover: true });
    const { targetId } = (await client.send("Target.createTarget", { url: targetUrl })) as {
      targetId: string;
    };
    const { sessionId } = (await client.send("Target.attachToTarget", {
      targetId,
      flatten: true,
    })) as { sessionId: string };

    const sendToTarget = (method: string, params?: Record<string, unknown>) =>
      client!.send(method, params, sessionId);

    await sendToTarget("Page.enable");
    await sendToTarget("Emulation.setDeviceMetricsOverride", {
      width: options.viewport.width,
      height: options.viewport.height,
      deviceScaleFactor: 1,
      mobile: options.viewport.label === "mobile",
    });
    await sleep(1500);

    const shot = (await sendToTarget("Page.captureScreenshot", { format: "png" })) as {
      data: string;
    };
    fs.writeFileSync(outputPath, Buffer.from(shot.data, "base64"));

    return {
      outputPath,
      width: options.viewport.width,
      height: options.viewport.height,
      browserPath: browser.path,
      browser: browser.browser,
    };
  } finally {
    client?.close();
    killProcess(proc);
  }
}

export interface A11yLiteResult {
  issues: Array<{
    id: number;
    severity: string;
    rule: string;
    selector: string;
    message: string;
    fixHint: string;
  }>;
  score: number;
  issueCount: number;
}

export async function runA11yLiteAudit(
  targetUrl: string,
  options: BrowserSessionOptions
): Promise<A11yLiteResult> {
  const browser = resolveBrowserExecutable({
    chromePath: options.chromePath,
    prefer: options.prefer ?? "chrome",
  });
  if (!browser) {
    throw new Error("BROWSER_NOT_FOUND");
  }

  const port = 9222 + Math.floor(Math.random() * 800);
  const timeoutMs = options.timeoutMs ?? 30000;
  const args = [
    `--user-data-dir=${options.userDataDir}`,
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    `--window-size=${options.viewport.width},${options.viewport.height}`,
    `--remote-debugging-port=${port}`,
    "about:blank",
  ];

  const proc = spawn(browser.path, args, { stdio: "ignore", shell: false, windowsHide: true });
  let client: SimpleCdpClient | null = null;

  try {
    const wsUrl = await getWebSocketUrl(port, timeoutMs);
    const WS = globalThis.WebSocket;
    if (!WS) throw new Error("WebSocket not available");
    const ws = new WS(wsUrl);
    await new Promise<void>((resolve, reject) => {
      ws.addEventListener("open", () => resolve());
      ws.addEventListener("error", () => reject(new Error("CDP WebSocket failed")));
      setTimeout(() => reject(new Error("CDP timeout")), timeoutMs);
    });

    client = new SimpleCdpClient(ws);
    const { targetId } = (await client.send("Target.createTarget", { url: targetUrl })) as {
      targetId: string;
    };
    const { sessionId } = (await client.send("Target.attachToTarget", {
      targetId,
      flatten: true,
    })) as { sessionId: string };

    const evalResult = (await client.send(
      "Runtime.evaluate",
      { expression: A11Y_LITE_SCRIPT, returnByValue: true, awaitPromise: true },
      sessionId
    )) as { result?: { value?: A11yLiteResult } };

    const value = evalResult.result?.value;
    if (!value) {
      return { issues: [], score: 100, issueCount: 0 };
    }
    return value;
  } finally {
    client?.close();
    killProcess(proc);
  }
}

export async function runPlaywrightAxeAudit(
  targetUrl: string,
  options: BrowserSessionOptions
): Promise<A11yLiteResult> {
  const pw = await import("playwright-core");
  const axeMod = await import("@axe-core/playwright");
  const AxeBuilder = axeMod.AxeBuilder ?? axeMod.default?.AxeBuilder;
  if (!AxeBuilder) throw new Error("AXE_NOT_AVAILABLE");

  const browser = await pw.chromium.launch({
    headless: true,
    executablePath: resolveBrowserExecutable({ chromePath: options.chromePath })?.path,
  });

  try {
    const context = await browser.newContext({
      viewport: { width: options.viewport.width, height: options.viewport.height },
    });
    const page = await context.newPage();
    await page.goto(targetUrl, { waitUntil: "networkidle", timeout: options.timeoutMs ?? 30000 });
    const results = await new AxeBuilder({ page }).analyze();
    const issues = results.violations.flatMap((v, vi) =>
      v.nodes.map((n, ni) => ({
        id: vi * 100 + ni + 1,
        severity: v.impact ?? "moderate",
        rule: v.id,
        selector: n.target.join(", "),
        message: v.description,
        fixHint: v.help,
      }))
    );
    const critical = issues.filter((i) => i.severity === "critical" || i.severity === "serious").length;
    const score = Math.max(0, 100 - critical * 12 - (issues.length - critical) * 4);
    return { issues, score, issueCount: issues.length };
  } finally {
    await browser.close();
  }
}

export async function getPageMetrics(
  targetUrl: string,
  options: BrowserSessionOptions
): Promise<{
  domNodeCount: number;
  documentHeight: number;
  documentWidth: number;
  scrollWidth: number;
  clientWidth: number;
  smallTextCount: number;
}> {
  const browser = resolveBrowserExecutable({ chromePath: options.chromePath });
  if (!browser) throw new Error("BROWSER_NOT_FOUND");

  const port = 9222 + Math.floor(Math.random() * 800);
  const args = [
    `--user-data-dir=${options.userDataDir}`,
    "--headless=new",
    "--disable-gpu",
    `--remote-debugging-port=${port}`,
    "about:blank",
  ];
  const proc = spawn(browser.path, args, { stdio: "ignore", shell: false, windowsHide: true });
  let client: SimpleCdpClient | null = null;

  try {
    const wsUrl = await getWebSocketUrl(port, options.timeoutMs ?? 30000);
    const ws = new WebSocket(wsUrl);
    await new Promise<void>((resolve, reject) => {
      ws.addEventListener("open", () => resolve());
      ws.addEventListener("error", () => reject(new Error("CDP failed")));
    });
    client = new SimpleCdpClient(ws);
    const { targetId } = (await client.send("Target.createTarget", { url: targetUrl })) as {
      targetId: string;
    };
    const { sessionId } = (await client.send("Target.attachToTarget", {
      targetId,
      flatten: true,
    })) as { sessionId: string };

    const script = `(() => {
      const all = document.querySelectorAll("*");
      let small = 0;
      all.forEach((el) => {
        const fs = parseFloat(getComputedStyle(el).fontSize);
        if (fs > 0 && fs < 12 && (el.textContent || "").trim()) small++;
      });
      const doc = document.documentElement;
      return {
        domNodeCount: all.length,
        documentHeight: doc.scrollHeight,
        documentWidth: doc.scrollWidth,
        scrollWidth: doc.scrollWidth,
        clientWidth: doc.clientWidth,
        smallTextCount: small,
      };
    })()`;

    const evalResult = (await client.send(
      "Runtime.evaluate",
      { expression: script, returnByValue: true },
      sessionId
    )) as { result?: { value?: Record<string, number> } };

    return (evalResult.result?.value ?? {
      domNodeCount: 0,
      documentHeight: 0,
      documentWidth: 0,
      scrollWidth: 0,
      clientWidth: 0,
      smallTextCount: 0,
    }) as {
      domNodeCount: number;
      documentHeight: number;
      documentWidth: number;
      scrollWidth: number;
      clientWidth: number;
      smallTextCount: number;
    };
  } finally {
    client?.close();
    killProcess(proc);
  }
}
