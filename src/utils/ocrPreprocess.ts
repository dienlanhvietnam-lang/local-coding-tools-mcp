import sharp from "sharp";

/** Longest edge cap before OCR — balances speed and accuracy */
export const DEFAULT_OCR_MAX_DIMENSION = 1600;

export interface OcrPreprocessResult {
  buffer: Buffer;
  scaledWidth: number;
  scaledHeight: number;
  sourceWidth: number;
  sourceHeight: number;
}

/**
 * Sharp pipeline tuned for Tesseract: auto-orient, downscale, greyscale, contrast, PNG buffer.
 */
export async function preprocessImageForOcr(
  fullPath: string,
  maxDimension = DEFAULT_OCR_MAX_DIMENSION
): Promise<OcrPreprocessResult> {
  const meta = await sharp(fullPath).metadata();
  const sourceWidth = meta.width ?? 0;
  const sourceHeight = meta.height ?? 0;
  if (sourceWidth < 1 || sourceHeight < 1) {
    throw new Error("Invalid image dimensions");
  }

  const longEdge = Math.max(sourceWidth, sourceHeight);
  const scale = longEdge > maxDimension ? maxDimension / longEdge : 1;
  const scaledWidth = Math.max(1, Math.round(sourceWidth * scale));
  const scaledHeight = Math.max(1, Math.round(sourceHeight * scale));

  let pipeline = sharp(fullPath).rotate();
  if (scale < 1) {
    pipeline = pipeline.resize(scaledWidth, scaledHeight, { fit: "inside", withoutEnlargement: true });
  }

  const buffer = await pipeline.greyscale().normalize().sharpen({ sigma: 0.8 }).png().toBuffer();

  return {
    buffer,
    scaledWidth,
    scaledHeight,
    sourceWidth,
    sourceHeight,
  };
}
