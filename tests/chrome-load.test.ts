import { describe, it, expect } from "vitest";
import { resolveChromeExecutable } from "../src/tools/chromeLoadExtension.js";
import { chromeLoadExtension } from "../src/tools/chromeLoadExtension.js";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("chrome_load_extension", () => {
  it("resolveChromeExecutable returns string or null", () => {
    const p = resolveChromeExecutable();
    expect(p === null || typeof p === "string").toBe(true);
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
