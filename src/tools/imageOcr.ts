import { resolveImageInput, guardFail } from "../safety/imageGuard.js";
import { readImageMetadata } from "../utils/imageSafe.js";
import { preprocessImageForOcr, DEFAULT_OCR_MAX_DIMENSION } from "../utils/ocrPreprocess.js";
import { runOcrOnBuffer, usesBundledTessdata } from "../utils/tesseractRuntime.js";
import { pass, fail } from "../utils/result.js";
import { MAX_OUTPUT_CHARS } from "../config.js";

export interface OcrBlock {
  text: string;
  confidence: number;
  bbox: { x: number; y: number; width: number; height: number };
}

export interface ImageOcrInput {
  workspacePath: string;
  relativePath: string;
  /** Tesseract language codes, e.g. "eng" or "eng+vie". "eng" uses bundled tessdata (offline). */
  languages?: string;
  maxDimension?: number;
  includeBlocks?: boolean;
}

export interface ImageOcrOutput {
  status: "PASS" | "FAIL" | "BLOCKED";
  workspacePath?: string;
  relativePath?: string;
  width?: number;
  height?: number;
  format?: string;
  sizeBytes?: number;
  hasAlpha?: boolean;
  channels?: number;
  orientation?: number;
  languages?: string;
  tessdataSource?: "bundled" | "remote";
  preprocess?: {
    scaledWidth: number;
    scaledHeight: number;
    maxDimension: number;
  };
  fullText?: string;
  textTruncated?: boolean;
  meanConfidence?: number;
  blockCount?: number;
  blocks?: OcrBlock[];
  error?: string;
  hint?: string;
}

type TessWord = {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
};

function flattenWords(data: {
  blocks?: Array<{
    paragraphs?: Array<{ lines?: Array<{ words?: TessWord[] }> }>;
  }> | null;
}): TessWord[] {
  const words: TessWord[] = [];
  for (const block of data.blocks ?? []) {
    for (const para of block.paragraphs ?? []) {
      for (const line of para.lines ?? []) {
        for (const word of line.words ?? []) {
          words.push(word);
        }
      }
    }
  }
  return words;
}

function mapWordBlocks(words: TessWord[]): OcrBlock[] {
  return words
    .filter((w) => w.text.trim().length > 0)
    .map((w) => ({
      text: w.text.trim(),
      confidence: Math.round(w.confidence * 10) / 10,
      bbox: {
        x: w.bbox.x0,
        y: w.bbox.y0,
        width: Math.max(0, w.bbox.x1 - w.bbox.x0),
        height: Math.max(0, w.bbox.y1 - w.bbox.y0),
      },
    }));
}

export async function imageOcr(input: ImageOcrInput): Promise<ImageOcrOutput> {
  const resolved = resolveImageInput(input.workspacePath, input.relativePath);
  if (!resolved.ok) {
    return guardFail(resolved.error, resolved.status ?? "FAIL", {
      workspacePath: input.workspacePath,
      relativePath: input.relativePath,
    }) as ImageOcrOutput;
  }

  const languages = (input.languages ?? "eng").trim() || "eng";
  const maxDimension = input.maxDimension ?? DEFAULT_OCR_MAX_DIMENSION;
  const includeBlocks = input.includeBlocks !== false;

  try {
    const meta = await readImageMetadata(
      resolved.resolved.fullPath,
      resolved.resolved.sizeBytes
    );
    const pre = await preprocessImageForOcr(resolved.resolved.fullPath, maxDimension);
    const data = await runOcrOnBuffer(languages, pre.buffer);

    let fullText = (data.text ?? "").trim();
    let textTruncated = false;
    if (fullText.length > MAX_OUTPUT_CHARS) {
      fullText = fullText.slice(0, MAX_OUTPUT_CHARS);
      textTruncated = true;
    }

    const words = mapWordBlocks(flattenWords(data));
    const confidences = words.map((w) => w.confidence).filter((c) => c > 0);
    const pageConfidence = typeof data.confidence === "number" ? data.confidence : 0;
    const meanConfidence =
      confidences.length > 0
        ? Math.round((confidences.reduce((a, b) => a + b, 0) / confidences.length) * 10) / 10
        : Math.round(pageConfidence * 10) / 10;

    const blocks = includeBlocks ? words.slice(0, 500) : undefined;

    const tessdataSource: "bundled" | "remote" = usesBundledTessdata(languages)
      ? "bundled"
      : "remote";

    return pass({
      workspacePath: resolved.resolved.workspacePath,
      relativePath: resolved.resolved.relativePath,
      ...meta,
      languages,
      tessdataSource,
      preprocess: {
        scaledWidth: pre.scaledWidth,
        scaledHeight: pre.scaledHeight,
        maxDimension,
      },
      fullText,
      textTruncated,
      meanConfidence,
      blockCount: words.length,
      blocks,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return fail("OCR failed", {
      workspacePath: resolved.resolved.workspacePath,
      relativePath: resolved.resolved.relativePath,
      languages,
      error: message,
      hint: usesBundledTessdata(languages)
        ? "Bundled eng tessdata failed. Reinstall npm dependencies in the MCP server folder."
        : 'Use languages="eng" for offline OCR, or ensure network access to download tessdata.',
    }) as ImageOcrOutput;
  }
}
