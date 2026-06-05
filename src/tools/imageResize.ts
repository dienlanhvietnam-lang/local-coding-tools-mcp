import sharp from "sharp";
import {
  resolveImageInput,
  resolveImageOutput,
  guardFail,
  type OutputImageFormat,
  ALLOWED_OUTPUT_FORMATS,
} from "../safety/imageGuard.js";
import { writeSharpPipeline } from "../utils/imageSafe.js";
import { pass, fail } from "../utils/result.js";

export interface ImageResizeInput {
  workspacePath: string;
  inputPath: string;
  outputPath: string;
  width?: number;
  height?: number;
  format?: OutputImageFormat;
  quality?: number;
  fit?: "cover" | "contain" | "fill" | "inside" | "outside";
}

export interface ImageResizeOutput {
  status: "PASS" | "FAIL" | "BLOCKED";
  workspacePath?: string;
  inputPath?: string;
  outputPath?: string;
  outputWidth?: number;
  outputHeight?: number;
  format?: string;
  bytesWritten?: number;
  error?: string;
}

export async function imageResize(input: ImageResizeInput): Promise<ImageResizeOutput> {
  const src = resolveImageInput(input.workspacePath, input.inputPath);
  if (!src.ok) {
    return guardFail(src.error, src.status ?? "FAIL") as ImageResizeOutput;
  }

  const dst = resolveImageOutput(input.workspacePath, input.outputPath);
  if (!dst.ok) {
    return guardFail(dst.error, dst.status) as ImageResizeOutput;
  }

  if (!input.width && !input.height) {
    return fail("At least one of width or height is required") as ImageResizeOutput;
  }

  if (input.format && !ALLOWED_OUTPUT_FORMATS.includes(input.format)) {
    return fail(`Unsupported format. Allowed: ${ALLOWED_OUTPUT_FORMATS.join(", ")}`) as ImageResizeOutput;
  }

  let pipeline = sharp(src.resolved.fullPath).resize({
    width: input.width,
    height: input.height,
    fit: input.fit ?? "inside",
    withoutEnlargement: false,
  });

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
    format: meta.format ?? input.format,
    bytesWritten,
  });
}
