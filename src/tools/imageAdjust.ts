import sharp from "sharp";
import { resolveImageInput, resolveImageOutput, guardFail } from "../safety/imageGuard.js";
import { writeSharpPipeline } from "../utils/imageSafe.js";
import { pass } from "../utils/result.js";

export interface ImageAdjustInput {
  workspacePath: string;
  inputPath: string;
  outputPath: string;
  /** 0.5–2.0, default 1 */
  brightness?: number;
  /** 0–2.0, default 1 */
  saturation?: number;
  /** Hue rotation degrees */
  hue?: number;
  /** Sharpen sigma, e.g. 1 */
  sharpen?: number;
  greyscale?: boolean;
  /** Rotation angle (degrees) */
  rotate?: number;
  flip?: "horizontal" | "vertical";
  format?: "png" | "jpeg" | "webp" | "avif";
  quality?: number;
}

export interface ImageAdjustOutput {
  status: "PASS" | "FAIL" | "BLOCKED";
  workspacePath?: string;
  inputPath?: string;
  outputPath?: string;
  outputWidth?: number;
  outputHeight?: number;
  bytesWritten?: number;
  applied?: string[];
  error?: string;
}

export async function imageAdjust(input: ImageAdjustInput): Promise<ImageAdjustOutput> {
  const src = resolveImageInput(input.workspacePath, input.inputPath);
  if (!src.ok) {
    return guardFail(src.error, src.status ?? "FAIL") as ImageAdjustOutput;
  }

  const dst = resolveImageOutput(input.workspacePath, input.outputPath);
  if (!dst.ok) {
    return guardFail(dst.error, dst.status) as ImageAdjustOutput;
  }

  const applied: string[] = [];
  let pipeline = sharp(src.resolved.fullPath);

  if (input.greyscale) {
    pipeline = pipeline.greyscale();
    applied.push("greyscale");
  }

  const brightness = input.brightness ?? 1;
  const saturation = input.saturation ?? 1;
  if (brightness !== 1 || saturation !== 1 || (input.hue !== undefined && input.hue !== 0)) {
    pipeline = pipeline.modulate({
      brightness,
      saturation,
      hue: input.hue ?? 0,
    });
    applied.push("modulate");
  }

  if (input.sharpen !== undefined && input.sharpen > 0) {
    pipeline = pipeline.sharpen(input.sharpen);
    applied.push("sharpen");
  }

  if (input.rotate !== undefined && input.rotate !== 0) {
    pipeline = pipeline.rotate(input.rotate);
    applied.push(`rotate(${input.rotate})`);
  }

  if (input.flip === "horizontal") {
    pipeline = pipeline.flop();
    applied.push("flip-horizontal");
  } else if (input.flip === "vertical") {
    pipeline = pipeline.flip();
    applied.push("flip-vertical");
  }

  const q = Math.min(100, Math.max(1, input.quality ?? 90));
  const { bytesWritten } = await writeSharpPipeline(
    pipeline,
    dst.resolved.fullPath,
    input.format,
    q
  );
  const meta = await sharp(dst.resolved.fullPath).metadata();

  return pass({
    workspacePath: src.resolved.workspacePath,
    inputPath: src.resolved.relativePath,
    outputPath: dst.resolved.relativePath,
    outputWidth: meta.width,
    outputHeight: meta.height,
    bytesWritten,
    applied,
  });
}
