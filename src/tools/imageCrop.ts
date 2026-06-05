import sharp from "sharp";
import { resolveImageInput, resolveImageOutput, guardFail } from "../safety/imageGuard.js";
import { writeSharpPipeline } from "../utils/imageSafe.js";
import { pass } from "../utils/result.js";

export interface ImageCropInput {
  workspacePath: string;
  inputPath: string;
  outputPath: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface ImageCropOutput {
  status: "PASS" | "FAIL" | "BLOCKED";
  workspacePath?: string;
  inputPath?: string;
  outputPath?: string;
  outputWidth?: number;
  outputHeight?: number;
  bytesWritten?: number;
  error?: string;
}

export async function imageCrop(input: ImageCropInput): Promise<ImageCropOutput> {
  const src = resolveImageInput(input.workspacePath, input.inputPath);
  if (!src.ok) {
    return guardFail(src.error, src.status ?? "FAIL") as ImageCropOutput;
  }

  const dst = resolveImageOutput(input.workspacePath, input.outputPath);
  if (!dst.ok) {
    return guardFail(dst.error, dst.status) as ImageCropOutput;
  }

  const { left, top, width, height } = input;
  if (width <= 0 || height <= 0 || left < 0 || top < 0) {
    return guardFail("Crop dimensions must be positive and origin non-negative") as ImageCropOutput;
  }

  const meta = await sharp(src.resolved.fullPath).metadata();
  const imgW = meta.width ?? 0;
  const imgH = meta.height ?? 0;
  if (left + width > imgW || top + height > imgH) {
    return guardFail(`Crop region (${left},${top},${width}x${height}) exceeds image ${imgW}x${imgH}`) as ImageCropOutput;
  }

  const pipeline = sharp(src.resolved.fullPath).extract({ left, top, width, height });
  const { bytesWritten } = await writeSharpPipeline(pipeline, dst.resolved.fullPath);

  return pass({
    workspacePath: src.resolved.workspacePath,
    inputPath: src.resolved.relativePath,
    outputPath: dst.resolved.relativePath,
    outputWidth: width,
    outputHeight: height,
    bytesWritten,
  });
}
