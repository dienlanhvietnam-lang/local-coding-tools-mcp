import sharp from "sharp";
import { resolveImageInput, resolveImageOutput, guardFail } from "../safety/imageGuard.js";
import { writeSharpPipeline } from "../utils/imageSafe.js";
import { pass, fail } from "../utils/result.js";

export interface ImageRoundedInput {
  workspacePath: string;
  inputPath: string;
  outputPath: string;
  /** Corner radius in px (ignored when circle=true) */
  radius?: number;
  /** Circular mask (uses min(width,height)/2) */
  circle?: boolean;
  format?: "png" | "jpeg" | "webp" | "avif";
  quality?: number;
}

export interface ImageRoundedOutput {
  status: "PASS" | "FAIL" | "BLOCKED";
  workspacePath?: string;
  inputPath?: string;
  outputPath?: string;
  appliedRadius?: number;
  bytesWritten?: number;
  error?: string;
}

function roundedRectMaskSvg(w: number, h: number, r: number): Buffer {
  const radius = Math.min(r, Math.floor(Math.min(w, h) / 2));
  const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="${w}" height="${h}" rx="${radius}" ry="${radius}" fill="white"/>
</svg>`;
  return Buffer.from(svg);
}

function circleMaskSvg(size: number): Buffer {
  const r = size / 2;
  const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <circle cx="${r}" cy="${r}" r="${r}" fill="white"/>
</svg>`;
  return Buffer.from(svg);
}

export async function imageRounded(input: ImageRoundedInput): Promise<ImageRoundedOutput> {
  const src = resolveImageInput(input.workspacePath, input.inputPath);
  if (!src.ok) {
    return guardFail(src.error, src.status ?? "FAIL") as ImageRoundedOutput;
  }

  const dst = resolveImageOutput(input.workspacePath, input.outputPath);
  if (!dst.ok) {
    return guardFail(dst.error, dst.status) as ImageRoundedOutput;
  }

  const outExt = input.outputPath.toLowerCase();
  if (!outExt.endsWith(".png") && !outExt.endsWith(".webp")) {
    return fail("Rounded/circle output should be .png or .webp to preserve transparency") as ImageRoundedOutput;
  }

  const meta = await sharp(src.resolved.fullPath).metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;

  let pipeline = sharp(src.resolved.fullPath).ensureAlpha();
  let appliedRadius = input.radius ?? 24;

  if (input.circle) {
    const size = Math.min(w, h);
    appliedRadius = Math.floor(size / 2);
    pipeline = pipeline
      .resize(size, size, { fit: "cover", position: "centre" })
      .composite([{ input: circleMaskSvg(size), blend: "dest-in" }]);
  } else {
    const mask = roundedRectMaskSvg(w, h, appliedRadius);
    pipeline = pipeline.composite([{ input: mask, blend: "dest-in" }]);
  }

  const q = Math.min(100, Math.max(1, input.quality ?? 90));
  const { bytesWritten } = await writeSharpPipeline(
    pipeline,
    dst.resolved.fullPath,
    input.format ?? "png",
    q
  );

  return pass({
    workspacePath: src.resolved.workspacePath,
    inputPath: src.resolved.relativePath,
    outputPath: dst.resolved.relativePath,
    appliedRadius,
    bytesWritten,
  });
}
