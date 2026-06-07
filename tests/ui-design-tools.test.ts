import { describe, it, expect } from "vitest";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { extractDesignTokens } from "../src/tools/extractDesignTokens.js";
import { generatePalette } from "../src/tools/generatePalette.js";
import { suggestUiPattern } from "../src/tools/suggestUiPattern.js";
import { readDevgolGuide } from "../src/tools/readDevgolGuide.js";
import { listUiComponents } from "../src/tools/listUiComponents.js";
import { compareImages } from "../src/tools/compareImages.js";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const UI_HTML = path.join(ROOT, "tests/fixtures/ui/sample.html");

describe("ui design tools", () => {
  it("extract_design_tokens reads CSS variables", async () => {
    const ws = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-ui-"));
    fs.writeFileSync(
      path.join(ws, "theme.css"),
      ":root { --color-primary: #2563eb; --space-4: 1rem; }",
      "utf8"
    );
    const r = await extractDesignTokens({ workspacePath: ws, sources: ["theme.css"] });
    expect(r.status).toBe("PASS");
    expect(r.tokens?.colors?.["color-primary"]).toBe("#2563eb");
    fs.rmSync(ws, { recursive: true, force: true });
  });

  it("generate_palette from seed", async () => {
    const ws = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-ui-"));
    const r = await generatePalette({ workspacePath: ws, seedColor: "#2563eb" });
    expect(r.status).toBe("PASS");
    expect(r.light?.length).toBeGreaterThan(0);
    expect(r.cssVariables).toContain("--color-primary");
    fs.rmSync(ws, { recursive: true, force: true });
  });

  it("suggest_ui_pattern returns 3 directions", async () => {
    const ws = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-ui-"));
    const r = await suggestUiPattern({ workspacePath: ws, productType: "saas" });
    expect(r.status).toBe("PASS");
    expect(r.suggestions?.length).toBe(3);
    fs.rmSync(ws, { recursive: true, force: true });
  });

  it("read_devgol_guide loads bundled scorecard", async () => {
    const ws = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-ui-"));
    const r = await readDevgolGuide({ workspacePath: ws, topic: "scorecard" });
    expect(r.status).toBe("PASS");
    expect(r.content).toContain("DEV GOL");
    fs.rmSync(ws, { recursive: true, force: true });
  });

  it("list_ui_components finds PascalCase files", async () => {
    const ws = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-ui-"));
    const compDir = path.join(ws, "src/components");
    fs.mkdirSync(compDir, { recursive: true });
    fs.writeFileSync(path.join(compDir, "Button.tsx"), "export function Button() {}", "utf8");
    const r = await listUiComponents({ workspacePath: ws });
    expect(r.status).toBe("PASS");
    expect(r.count).toBe(1);
    fs.rmSync(ws, { recursive: true, force: true });
  });

  it("compare_images identical PNGs", async () => {
    const ws = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-ui-"));
    const pngPath = path.join(ws, "a.png");
    await sharp({ create: { width: 32, height: 32, channels: 3, background: "#2563eb" } })
      .png()
      .toFile(pngPath);
    fs.copyFileSync(pngPath, path.join(ws, "b.png"));
    const r = await compareImages({
      workspacePath: ws,
      referenceRelativePath: "a.png",
      actualRelativePath: "b.png",
    });
    expect(r.status).toBe("PASS");
    expect(r.diffPercent).toBe(0);
    fs.rmSync(ws, { recursive: true, force: true });
  });

  it("preview_html fixture accepts html path", async () => {
    const ws = path.dirname(UI_HTML);
    const r = await import("../src/tools/previewHtml.js").then((m) =>
      m.previewHtml({
        workspacePath: ws,
        relativePath: "sample.html",
        outputRelativePath: ".mcp-debug/test-preview.png",
      })
    );
    expect(["PASS", "SKIPPED"]).toContain(r.status);
  });
});
