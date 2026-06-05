import sharp from "sharp";
import { resolveImageInput, resolveImageOutput, guardFail } from "../safety/imageGuard.js";
import { writeSharpPipeline } from "../utils/imageSafe.js";
import { pass, fail } from "../utils/result.js";

export type CompositeGravity =
  | "northwest"
  | "north"
  | "northeast"
  | "west"
  | "center"
  | "east"
  | "southwest"
  | "south"
  | "southeast";

export interface ImageCompositeInput {
  workspacePath: string;
  basePath: string;
  overlayPath: string;
  outputPath: string;
  /** Pixel offset when gravity not used */
  left?: number;
  top?: number;
  gravity?: CompositeGravity;
  /** 0–1 overlay opacity */
  opacity?: number;
  format?: "png" | "jpeg" | "webp" | "avif";
  quality?: number;
}

export interface ImageCompositeOutput {
  status: "PASS" | "FAIL" | "BLOCKED";
  workspacePath?: string;
  basePath?: string;
  overlayPath?: string;
  outputPath?: string;
  outputWidth?: number;
  outputHeight?: number;
  bytesWritten?: number;
  error?: string;
}

function gravityToPosition(
  gravity: CompositeGravity,
  baseW: number,
  baseH: number,
  overlayW: number,
  overlayH: number
): { left: number; top: number } {
  const positions: Record<CompositeGravity, { left: number; top: number }> = {
    northwest: { left: 0, top: 0 },
    north: { left: Math.floor((baseW - overlayW) / 2), top: 0 },
    northeast: { left: baseW - overlayW, top: 0 },
    west: { left: 0, top: Math.floor((baseH - overlayH) / 2) },
    center: { left: Math.floor((baseW - overlayW) / 2), top: Math.floor((baseH - overlayH) / 2) },
    east: { left: baseW - overlayW, top: Math.floor((baseH - overlayH) / 2) },
    southwest: { left: 0, top: baseH - overlayH },
    south: { left: Math.floor((baseW - overlayW) / 2), top: baseH - overlayH },
    southeast: { left: baseW - overlayW, top: baseH - overlayH },
  };
  return positions[gravity];
}

export async function imageComposite(input: ImageCompositeInput): Promise<ImageCompositeOutput> {
  const base = resolveImageInput(input.workspacePath, input.basePath);
  if (!base.ok) {
    return guardFail(base.error, base.status ?? "FAIL") as ImageCompositeOutput;
  }

  const overlay = resolveImageInput(input.workspacePath, input.overlayPath);
  if (!overlay.ok) {
    return guardFail(overlay.error, overlay.status ?? "FAIL") as ImageCompositeOutput;
  }

  const dst = resolveImageOutput(input.workspacePath, input.outputPath);
  if (!dst.ok) {
    return guardFail(dst.error, dst.status) as ImageCompositeOutput;
  }

  const baseMeta = await sharp(base.resolved.fullPath).metadata();
  const overlayMeta = await sharp(overlay.resolved.fullPath).metadata();
  const baseW = baseMeta.width ?? 0;
  const baseH = baseMeta.height ?? 0;
  const overlayW = overlayMeta.width ?? 0;
  const overlayH = overlayMeta.height ?? 0;

  let left = input.left ?? 0;
  let top = input.top ?? 0;
  if (input.gravity) {
    const pos = gravityToPosition(input.gravity, baseW, baseH, overlayW, overlayH);
    left = pos.left;
    top = pos.top;
  }

  let overlayBuffer = await sharp(overlay.resolved.fullPath).ensureAlpha().toBuffer();
  const opacity = input.opacity ?? 1;
  if (opacity < 1) {
    const { data, info } = await sharp(overlayBuffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    for (let i = 3; i < data.length; i += 4) {
      data[i] = Math.round((data[i] ?? 255) * opacity);
    }
    overlayBuffer = await sharp(data, { raw: info }).png().toBuffer();
  }

  const pipeline = sharp(base.resolved.fullPath).composite([
    { input: overlayBuffer, left, top },
  ]);

  const q = Math.min(100, Math.max(1, input.quality ?? 90));
  const { bytesWritten } = await writeSharpPipeline(pipeline, dst.resolved.fullPath, input.format, q);
  const outMeta = await sharp(dst.resolved.fullPath).metadata();

  if ((outMeta.width ?? 0) === 0) {
    return fail("Composite produced empty output") as ImageCompositeOutput;
  }

  return pass({
    workspacePath: base.resolved.workspacePath,
    basePath: base.resolved.relativePath,
    overlayPath: overlay.resolved.relativePath,
    outputPath: dst.resolved.relativePath,
    outputWidth: outMeta.width,
    outputHeight: outMeta.height,
    bytesWritten,
  });
}
