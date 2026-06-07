import path from "node:path";
import fs from "node:fs";
import { validateWorkspacePath } from "../safety/pathGuard.js";
import { validateWorkspaceHtmlFile, targetUrlFromGuard } from "../safety/urlGuard.js";
import { capturePageScreenshot, resolveViewport } from "../utils/browserCdp.js";
import { pass, fail, skipped } from "../utils/result.js";

export interface PreviewHtmlInput {
  workspacePath: string;
  relativePath?: string;
  htmlSnippet?: string;
  viewport?: string;
  width?: number;
  height?: number;
  outputRelativePath?: string;
  chromePath?: string;
  timeoutMs?: number;
}

export interface PreviewHtmlOutput {
  status: "PASS" | "FAIL" | "SKIPPED";
  workspacePath?: string;
  htmlRelativePath?: string;
  outputRelativePath?: string;
  width?: number;
  height?: number;
  reason?: string;
  error?: string;
}

export async function previewHtml(input: PreviewHtmlInput): Promise<PreviewHtmlOutput> {
  const validation = validateWorkspacePath(input.workspacePath);
  if (!validation.ok) return fail(validation.error ?? "Invalid workspace");

  const workspacePath = validation.resolvedPath!;
  let htmlRelativePath: string;

  if (input.relativePath?.trim()) {
    htmlRelativePath = input.relativePath.trim();
    const fileCheck = validateWorkspaceHtmlFile(workspacePath, htmlRelativePath);
    if (!fileCheck.ok) return fail(fileCheck.error);
  } else if (input.htmlSnippet?.trim()) {
    htmlRelativePath = `.mcp-debug/previews/preview-${Date.now()}.html`;
    const htmlPath = path.resolve(workspacePath, htmlRelativePath);
    fs.mkdirSync(path.dirname(htmlPath), { recursive: true });
    fs.writeFileSync(htmlPath, input.htmlSnippet.trim(), "utf8");
  } else {
    return fail("Provide relativePath or htmlSnippet");
  }

  const fileCheck = validateWorkspaceHtmlFile(workspacePath, htmlRelativePath);
  if (!fileCheck.ok) return fail(fileCheck.error);

  const viewport = resolveViewport(input.viewport, input.width, input.height);
  const outputRelativePath =
    input.outputRelativePath?.trim() ||
    `.mcp-debug/screenshots/preview-${Date.now()}.png`;
  const outputPath = path.resolve(workspacePath, outputRelativePath);
  const userDataDir = path.join(workspacePath, ".mcp-debug", "ui-browser", `preview-${Date.now()}`);
  fs.mkdirSync(userDataDir, { recursive: true });

  try {
    const result = await capturePageScreenshot(targetUrlFromGuard(fileCheck), outputPath, {
      chromePath: input.chromePath,
      userDataDir,
      viewport,
      timeoutMs: input.timeoutMs,
    });
    return pass({
      workspacePath,
      htmlRelativePath,
      outputRelativePath: path.relative(workspacePath, result.outputPath).replace(/\\/g, "/"),
      width: result.width,
      height: result.height,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "BROWSER_NOT_FOUND") {
      return skipped("browser_not_found", { workspacePath, reason: "Chrome/Edge not found" });
    }
    return fail(message, { workspacePath });
  }
}
