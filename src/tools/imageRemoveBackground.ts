import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { resolveImageInput, resolveImageOutput, guardFail } from "../safety/imageGuard.js";
import { removeBackgroundNode } from "../utils/removeBackgroundNode.js";
import {
  REMOVE_BG_INSTALL_HINT,
  allErrorsMissingDependency,
  probeImglyNode,
  probeRembgCli,
  isTokenConfigured,
} from "../utils/imageDependencies.js";
import { pass, fail, skipped } from "../utils/result.js";

export type RemoveBgMode = "auto" | "api" | "cli" | "node";

export interface ImageRemoveBackgroundInput {
  workspacePath: string;
  inputPath: string;
  outputPath: string;
  mode?: RemoveBgMode;
  /** For remove.bg API — falls back to REMOVE_BG_API_KEY env */
  apiKey?: string;
  timeoutMs?: number;
}

export interface ImageRemoveBackgroundOutput {
  status: "PASS" | "FAIL" | "BLOCKED" | "SKIPPED";
  workspacePath?: string;
  inputPath?: string;
  outputPath?: string;
  method?: "remove.bg" | "rembg-cli" | "imgly-node";
  bytesWritten?: number;
  error?: string;
  hint?: string;
  reason?: string;
  dependency?: string;
  installHint?: string;
}

function runCommand(
  command: string,
  args: string[],
  timeoutMs: number
): Promise<{ exitCode: number | null; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { shell: process.platform === "win32", windowsHide: true });
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
    }, timeoutMs);
    child.stderr?.on("data", (d: Buffer) => {
      stderr += d.toString();
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ exitCode: code, stderr });
    });
    child.on("error", () => {
      clearTimeout(timer);
      resolve({ exitCode: 1, stderr });
    });
  });
}

function skipMissing(extra?: Record<string, unknown>): ImageRemoveBackgroundOutput {
  return skipped("missing_dependency", {
    dependency: "rembg_or_removebg_api",
    installHint: REMOVE_BG_INSTALL_HINT,
    ...extra,
  }) as ImageRemoveBackgroundOutput;
}

async function removeViaRembgCli(
  inputPath: string,
  outputPath: string,
  timeoutMs: number
): Promise<{ ok: boolean; error?: string }> {
  if (!(await probeRembgCli()).ok) {
    return { ok: false, error: "rembg CLI not installed or not on PATH" };
  }
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const result = await runCommand("rembg", ["i", inputPath, outputPath], timeoutMs);
  if (result.exitCode === 0 && fs.existsSync(outputPath)) {
    return { ok: true };
  }
  return { ok: false, error: result.stderr || "rembg CLI failed" };
}

async function removeViaRemoveBgApi(
  inputPath: string,
  outputPath: string,
  apiKey: string,
  timeoutMs: number
): Promise<{ ok: boolean; error?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const form = new FormData();
    const bytes = fs.readFileSync(inputPath);
    const blob = new Blob([bytes]);
    form.append("image_file", blob, path.basename(inputPath));
    form.append("size", "auto");

    const response = await fetch("https://api.remove.bg/v1.0/removebg", {
      method: "POST",
      headers: { "X-Api-Key": apiKey },
      body: form,
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      return { ok: false, error: `remove.bg HTTP ${response.status}: ${text.slice(0, 500)}` };
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, buffer);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timer);
  }
}

export async function imageRemoveBackground(
  input: ImageRemoveBackgroundInput
): Promise<ImageRemoveBackgroundOutput> {
  const src = resolveImageInput(input.workspacePath, input.inputPath);
  if (!src.ok) {
    return guardFail(src.error, src.status ?? "FAIL") as ImageRemoveBackgroundOutput;
  }

  const dst = resolveImageOutput(input.workspacePath, input.outputPath);
  if (!dst.ok) {
    return guardFail(dst.error, dst.status) as ImageRemoveBackgroundOutput;
  }

  const outExt = path.extname(dst.resolved.relativePath).toLowerCase();
  if (outExt !== ".png" && outExt !== ".webp") {
    return fail("Background removal output should be .png or .webp (alpha channel)") as ImageRemoveBackgroundOutput;
  }

  const mode = input.mode ?? "auto";
  const timeoutMs = input.timeoutMs ?? 120_000;
  const apiKey = input.apiKey ?? process.env.REMOVE_BG_API_KEY;
  const hasApi = Boolean(apiKey?.trim()) || isTokenConfigured("REMOVE_BG_API_KEY");
  const hasRembg = (await probeRembgCli()).ok;
  const hasImgly = await probeImglyNode();

  const attempts: Array<() => Promise<{ ok: boolean; method?: "remove.bg" | "rembg-cli" | "imgly-node"; error?: string }>> = [];

  if (mode === "node" || mode === "auto") {
    if (hasImgly) {
      attempts.push(async () => {
        const r = await removeBackgroundNode(src.resolved.fullPath, dst.resolved.fullPath);
        return { ...r, method: "imgly-node" as const };
      });
    }
  }

  if (mode === "cli" || mode === "auto") {
    if (hasRembg) {
      attempts.push(async () => {
        const r = await removeViaRembgCli(src.resolved.fullPath, dst.resolved.fullPath, timeoutMs);
        return { ...r, method: "rembg-cli" as const };
      });
    }
  }

  if ((mode === "api" || mode === "auto") && hasApi && apiKey) {
    attempts.push(async () => {
      const r = await removeViaRemoveBgApi(
        src.resolved.fullPath,
        dst.resolved.fullPath,
        apiKey!,
        timeoutMs
      );
      return { ...r, method: "remove.bg" as const };
    });
  }

  if (attempts.length === 0) {
    return skipMissing({
      workspacePath: src.resolved.workspacePath,
      inputPath: src.resolved.relativePath,
      outputPath: dst.resolved.relativePath,
      hint: REMOVE_BG_INSTALL_HINT,
    });
  }

  const errors: string[] = [];
  for (const attempt of attempts) {
    const result = await attempt();
    if (result.ok && result.method) {
      const stat = fs.statSync(dst.resolved.fullPath);
      return pass({
        workspacePath: src.resolved.workspacePath,
        inputPath: src.resolved.relativePath,
        outputPath: dst.resolved.relativePath,
        method: result.method,
        bytesWritten: stat.size,
      });
    }
    if (result.error) errors.push(result.error);
  }

  if (allErrorsMissingDependency(errors)) {
    return skipMissing({
      workspacePath: src.resolved.workspacePath,
      inputPath: src.resolved.relativePath,
      outputPath: dst.resolved.relativePath,
      error: errors.join(" | "),
      hint: REMOVE_BG_INSTALL_HINT,
    });
  }

  return fail("Background removal failed", {
    workspacePath: src.resolved.workspacePath,
    inputPath: src.resolved.relativePath,
    outputPath: dst.resolved.relativePath,
    error: errors.join(" | "),
    hint: "Dependency present but processing failed. Check input image and logs.",
  }) as ImageRemoveBackgroundOutput;
}
