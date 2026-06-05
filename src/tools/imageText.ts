import sharp from "sharp";
import { resolveImageInput, resolveImageOutput, guardFail } from "../safety/imageGuard.js";
import { writeSharpPipeline } from "../utils/imageSafe.js";
import { buildTextOverlaySvg, type TextGravity } from "../utils/imageTextSvg.js";
import { pass } from "../utils/result.js";

export interface ImageTextInput {
  workspacePath: string;
  inputPath: string;
  outputPath: string;
  text: string;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  backgroundColor?: string;
  gravity?: TextGravity;
  padding?: number;
  format?: "png" | "jpeg" | "webp" | "avif";
  quality?: number;
}

export interface ImageTextOutput {
  status: "PASS" | "FAIL" | "BLOCKED";
  workspacePath?: string;
  inputPath?: string;
  outputPath?: string;
  outputWidth?: number;
  outputHeight?: number;
  bytesWritten?: number;
  error?: string;
}

export async function imageText(input: ImageTextInput): Promise<ImageTextOutput> {
  const src = resolveImageInput(input.workspacePath, input.inputPath);
  if (!src.ok) {
    return guardFail(src.error, src.status ?? "FAIL") as ImageTextOutput;
  }

  const dst = resolveImageOutput(input.workspacePath, input.outputPath);
  if (!dst.ok) {
    return guardFail(dst.error, dst.status) as ImageTextOutput;
  }

  const meta = await sharp(src.resolved.fullPath).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;

  const svg = buildTextOverlaySvg({
    text: input.text,
    width,
    height,
    fontSize: input.fontSize,
    fontFamily: input.fontFamily,
    color: input.color,
    backgroundColor: input.backgroundColor,
    gravity: input.gravity,
    padding: input.padding,
  });

  const pipeline = sharp(src.resolved.fullPath).composite([{ input: svg, top: 0, left: 0 }]);
  const q = Math.min(100, Math.max(1, input.quality ?? 90));
  const { bytesWritten } = await writeSharpPipeline(pipeline, dst.resolved.fullPath, input.format, q);
  const outMeta = await sharp(dst.resolved.fullPath).metadata();

  return pass({
    workspacePath: src.resolved.workspacePath,
    inputPath: src.resolved.relativePath,
    outputPath: dst.resolved.relativePath,
    outputWidth: outMeta.width,
    outputHeight: outMeta.height,
    bytesWritten,
  });
}
