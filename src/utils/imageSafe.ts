import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import type { OutputImageFormat } from "../safety/imageGuard.js";

export interface ImageMetadataResult {
  width: number;
  height: number;
  format: string;
  sizeBytes: number;
  hasAlpha: boolean;
  channels?: number;
  orientation?: number;
  density?: number;
}

export async function readImageMetadata(fullPath: string, sizeBytes: number): Promise<ImageMetadataResult> {
  const meta = await sharp(fullPath).metadata();
  return {
    width: meta.width ?? 0,
    height: meta.height ?? 0,
    format: meta.format ?? path.extname(fullPath).slice(1),
    sizeBytes,
    hasAlpha: Boolean(meta.hasAlpha),
    channels: meta.channels,
    orientation: meta.orientation,
    density: meta.density,
  };
}

export function ensureParentDir(fullPath: string): void {
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
}

export async function writeSharpPipeline(
  pipeline: sharp.Sharp,
  outputPath: string,
  format?: OutputImageFormat,
  quality = 90
): Promise<{ bytesWritten: number }> {
  ensureParentDir(outputPath);
  let out = pipeline;
  if (format === "jpeg") {
    out = pipeline.jpeg({ quality });
  } else if (format === "webp") {
    out = pipeline.webp({ quality });
  } else if (format === "avif") {
    out = pipeline.avif({ quality });
  } else if (format === "png") {
    out = pipeline.png({ compressionLevel: 9 });
  }
  const buffer = await out.toBuffer();
  fs.writeFileSync(outputPath, buffer);
  return { bytesWritten: buffer.length };
}
