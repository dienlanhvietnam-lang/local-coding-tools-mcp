import sharp from "sharp";
import { MAX_UPSCALE_FACTOR } from "../config.js";
import { resolveImageInput, resolveImageOutput, guardFail } from "../safety/imageGuard.js";
import { writeSharpPipeline } from "../utils/imageSafe.js";
import { pass, fail } from "../utils/result.js";

export interface ImageUpscaleInput {
  workspacePath: string;
  inputPath: string;
  outputPath: string;
  /** Multiply dimensions e.g. 2 = 2x (max MAX_UPSCALE_FACTOR) */
  scale?: number;
  width?: number;
  height?: number;
  /** Post-upscale sharpen sigma */
  sharpen?: number;
  format?: "png" | "jpeg" | "webp" | "avif";
  quality?: number;
}

export interface ImageUpscaleOutput {
  status: "PASS" | "FAIL" | "BLOCKED";
  workspacePath?: string;
  inputPath?: string;
  outputPath?: string;
  inputWidth?: number;
  inputHeight?: number;
  outputWidth?: number;
  outputHeight?: number;
  scaleApplied?: number;
  method?: string;
  bytesWritten?: number;
  error?: string;
}

export async function imageUpscale(input: ImageUpscaleInput): Promise<ImageUpscaleOutput> {
  const src = resolveImageInput(input.workspacePath, input.inputPath);
  if (!src.ok) {
    return guardFail(src.error, src.status ?? "FAIL") as ImageUpscaleOutput;
  }

  const dst = resolveImageOutput(input.workspacePath, input.outputPath);
  if (!dst.ok) {
    return guardFail(dst.error, dst.status) as ImageUpscaleOutput;
  }

  const meta = await sharp(src.resolved.fullPath).metadata();
  const inW = meta.width ?? 0;
  const inH = meta.height ?? 0;

  let outW = input.width;
  let outH = input.height;

  if (input.scale !== undefined) {
    if (input.scale <= 1 || input.scale > MAX_UPSCALE_FACTOR) {
      return fail(`scale must be > 1 and <= ${MAX_UPSCALE_FACTOR}`) as ImageUpscaleOutput;
    }
    outW = Math.round(inW * input.scale);
    outH = Math.round(inH * input.scale);
  }

  if (!outW && !outH) {
    return fail("Provide scale or width/height target") as ImageUpscaleOutput;
  }

  const maxDim = 16_384;
  if ((outW ?? 0) > maxDim || (outH ?? 0) > maxDim) {
    return fail(`Output dimension exceeds max ${maxDim}px`) as ImageUpscaleOutput;
  }

  let pipeline = sharp(src.resolved.fullPath).resize(outW, outH, {
    fit: "fill",
    kernel: sharp.kernel.lanczos3,
    withoutEnlargement: false,
  });

  if (input.sharpen !== undefined && input.sharpen > 0) {
    pipeline = pipeline.sharpen(input.sharpen);
  }

  const q = Math.min(100, Math.max(1, input.quality ?? 92));
  const { bytesWritten } = await writeSharpPipeline(pipeline, dst.resolved.fullPath, input.format, q);
  const outMeta = await sharp(dst.resolved.fullPath).metadata();
  const outputWidth = outMeta.width ?? outW;
  const outputHeight = outMeta.height ?? outH;

  const scaleApplied =
    input.scale ?? (inW > 0 ? Number((outputWidth / inW).toFixed(2)) : undefined);

  return pass({
    workspacePath: src.resolved.workspacePath,
    inputPath: src.resolved.relativePath,
    outputPath: dst.resolved.relativePath,
    inputWidth: inW,
    inputHeight: inH,
    outputWidth,
    outputHeight,
    scaleApplied,
    method: "sharp-lanczos3",
    bytesWritten,
  });
}
