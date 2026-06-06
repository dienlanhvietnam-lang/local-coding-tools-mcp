import { describe, it, expect } from "vitest";
import {
  resolveChromeExecutable,
  resolveBrowserExecutable,
  buildChromeLaunchArgs,
  chromeLoadExtension,
} from "../src/tools/chromeLoadExtension.js";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";

describe("chrome_load_extension", () => {
  it("resolveChromeExecutable returns string or null", () => {
    const p = resolveChromeExecutable();
    expect(p === null || typeof p === "string").toBe(true);
  });

  it("resolveBrowserExecutable honors explicit chromePath", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-browser-"));
    const fakeExe = path.join(tmp, "chrome.exe");
    fs.writeFileSync(fakeExe, "");
    const r = resolveBrowserExecutable({ chromePath: fakeExe, prefer: "chrome" });
    expect(r?.path).toBe(fakeExe);
    expect(r?.browser).toBe("chrome");
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("buildChromeLaunchArgs includes disable-extensions-except and load-extension", () => {
    const ext = "C:\\ext\\my-extension";
    const profile = "C:\\ws\\.mcp-debug\\chrome-profile\\run-1";
    const args = buildChromeLaunchArgs(ext, profile, "https://example.com");
    expect(args).toContain(`--disable-extensions-except=${ext}`);
    expect(args).toContain(`--load-extension=${ext}`);
    expect(args).toContain(`--user-data-dir=${profile}`);
    expect(args).toContain("--enable-extensions");
    expect(args).toContain("https://example.com");
  });

  it("fails without manifest.json", async () => {
    const ws = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-chrome-"));
    const ext = path.join(ws, "fake-ext");
    fs.mkdirSync(ext);

    const r = await chromeLoadExtension({
      workspacePath: ws,
      extensionPath: ext,
      chromePath: path.join(ws, "nonexistent-chrome.exe"),
    });
    expect(r.status).toBe("FAIL");

    fs.rmSync(ws, { recursive: true, force: true });
  });
});
