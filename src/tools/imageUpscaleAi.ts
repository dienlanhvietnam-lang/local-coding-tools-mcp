import fs from "node:fs";
import sharp from "sharp";
import { MAX_UPSCALE_FACTOR } from "../config.js";
import { resolveImageInput, resolveImageOutput, guardFail } from "../safety/imageGuard.js";
import {
  upscaleViaRealesrganCli,
  upscaleViaWaifu2xCli,
  upscaleViaReplicateApi,
  type AiUpscaleMethod,
} from "../utils/aiUpscale.js";
import {
  AI_UPSCALE_INSTALL_HINT,
  allErrorsMissingDependency,
  probeRealesrganCli,
  isTokenConfigured,
} from "../utils/imageDependencies.js";
import { pass, fail, skipped } from "../utils/result.js";

export type AiUpscaleMode = "auto" | "cli" | "api";

export interface ImageUpscaleAiInput {
  workspacePath: string;
  inputPath: string;
  outputPath: string;
  scale?: 2 | 4;
  mode?: AiUpscaleMode;
  /** Replicate token — or env REPLICATE_API_TOKEN */
  apiToken?: string;
  timeoutMs?: number;
}

export interface ImageUpscaleAiOutput {
  status: "PASS" | "FAIL" | "BLOCKED" | "SKIPPED";
  workspacePath?: string;
  inputPath?: string;
  outputPath?: string;
  method?: AiUpscaleMethod;
  scale?: number;
  inputWidth?: number;
  inputHeight?: number;
  outputWidth?: number;
  outputHeight?: number;
  bytesWritten?: number;
  error?: string;
  hint?: string;
  reason?: string;
  dependency?: string;
  installHint?: string;
}

function skipMissing(extra?: Record<string, unknown>): ImageUpscaleAiOutput {
  return skipped("missing_dependency", {
    dependency: "realesrgan-ncnn-vulkan_or_REPLICATE_API_TOKEN",
    installHint: AI_UPSCALE_INSTALL_HINT,
    ...extra,
  }) as ImageUpscaleAiOutput;
}

export async function imageUpscaleAi(input: ImageUpscaleAiInput): Promise<ImageUpscaleAiOutput> {
  const src = resolveImageInput(input.workspacePath, input.inputPath);
  if (!src.ok) {
    return guardFail(src.error, src.status ?? "FAIL") as ImageUpscaleAiOutput;
  }

  const dst = resolveImageOutput(input.workspacePath, input.outputPath);
  if (!dst.ok) {
    return guardFail(dst.error, dst.status) as ImageUpscaleAiOutput;
  }

  const scale = (input.scale ?? 2) as 2 | 4;
  if (scale !== 2 && scale !== 4) {
    return fail("AI upscale scale must be 2 or 4") as ImageUpscaleAiOutput;
  }
  if (scale > MAX_UPSCALE_FACTOR) {
    return fail(`scale exceeds max ${MAX_UPSCALE_FACTOR}`) as ImageUpscaleAiOutput;
  }

  const mode = input.mode ?? "auto";
  const timeoutMs = input.timeoutMs ?? 300_000;
  const token = input.apiToken ?? process.env.REPLICATE_API_TOKEN;
  const hasReplicate = Boolean(token?.trim()) || isTokenConfigured("REPLICATE_API_TOKEN");
  const hasRealesrgan = (await probeRealesrganCli()).ok;

  const inMeta = await sharp(src.resolved.fullPath).metadata();

  type Attempt = () => Promise<{ ok: boolean; method?: AiUpscaleMethod; error?: string }>;
  const attempts: Attempt[] = [];

  if (mode === "cli" || mode === "auto") {
    if (hasRealesrgan) {
      attempts.push(async () => {
        const r = await upscaleViaRealesrganCli(
          src.resolved.fullPath,
          dst.resolved.fullPath,
          scale,
          timeoutMs
        );
        return { ...r, method: "realesrgan-cli" as const };
      });
    }
    if (scale === 2) {
      attempts.push(async () => {
        const r = await upscaleViaWaifu2xCli(
          src.resolved.fullPath,
          dst.resolved.fullPath,
          2,
          timeoutMs
        );
        return { ...r, method: "waifu2x-cli" as const };
      });
    }
  }

  if ((mode === "api" || mode === "auto") && hasReplicate && token) {
    attempts.push(async () => {
      const r = await upscaleViaReplicateApi(
        src.resolved.fullPath,
        dst.resolved.fullPath,
        scale,
        token!,
        timeoutMs
      );
      return { ...r, method: "replicate-api" as const };
    });
  }

  if (attempts.length === 0) {
    return skipMissing({
      workspacePath: src.resolved.workspacePath,
      inputPath: src.resolved.relativePath,
      outputPath: dst.resolved.relativePath,
      hint: AI_UPSCALE_INSTALL_HINT,
    });
  }

  const errors: string[] = [];
  for (const attempt of attempts) {
    const result = await attempt();
    if (result.ok && result.method) {
      const stat = fs.statSync(dst.resolved.fullPath);
      const outMeta = await sharp(dst.resolved.fullPath).metadata();
      return pass({
        workspacePath: src.resolved.workspacePath,
        inputPath: src.resolved.relativePath,
        outputPath: dst.resolved.relativePath,
        method: result.method,
        scale,
        inputWidth: inMeta.width,
        inputHeight: inMeta.height,
        outputWidth: outMeta.width,
        outputHeight: outMeta.height,
        bytesWritten: stat.size,
      });
    }
    if (result.error) errors.push(`${result.method ?? "unknown"}: ${result.error}`);
  }

  if (allErrorsMissingDependency(errors)) {
    return skipMissing({
      workspacePath: src.resolved.workspacePath,
      inputPath: src.resolved.relativePath,
      outputPath: dst.resolved.relativePath,
      error: errors.join(" | "),
      hint: AI_UPSCALE_INSTALL_HINT,
    });
  }

  return fail("AI generative upscale failed", {
    workspacePath: src.resolved.workspacePath,
    inputPath: src.resolved.relativePath,
    outputPath: dst.resolved.relativePath,
    error: errors.join(" | "),
    hint: "Dependency present but processing failed. Check input image, CLI, or API quota.",
  }) as ImageUpscaleAiOutput;
}
