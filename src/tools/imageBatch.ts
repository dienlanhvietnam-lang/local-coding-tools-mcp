import path from "node:path";
import { MAX_BATCH_IMAGES } from "../config.js";
import { validateWorkspacePath } from "../safety/pathGuard.js";
import { imageInfo } from "./imageInfo.js";
import { imageResize } from "./imageResize.js";
import { pass, fail, partial } from "../utils/result.js";

export type BatchOperation = "info" | "resize" | "convert";

export interface ImageBatchInput {
  workspacePath: string;
  operation: BatchOperation;
  inputPaths: string[];
  outputDir: string;
  /** For resize/convert */
  width?: number;
  height?: number;
  format?: "png" | "jpeg" | "webp" | "avif";
  quality?: number;
}

export interface BatchItemResult {
  inputPath: string;
  outputPath?: string;
  status: "PASS" | "FAIL" | "BLOCKED";
  error?: string;
  detail?: Record<string, unknown>;
}

export interface ImageBatchOutput {
  status: "PASS" | "PARTIAL" | "FAIL";
  workspacePath?: string;
  operation?: BatchOperation;
  processed?: number;
  passed?: number;
  failed?: number;
  results?: BatchItemResult[];
  error?: string;
}

export async function imageBatch(input: ImageBatchInput): Promise<ImageBatchOutput> {
  const validation = validateWorkspacePath(input.workspacePath);
  if (!validation.ok) {
    return fail(validation.error ?? "Invalid workspace");
  }

  const workspacePath = validation.resolvedPath!;
  const outputDir = input.outputDir.replace(/\\/g, "/").replace(/\/$/, "");

  if (!input.inputPaths?.length) {
    return fail("inputPaths must not be empty");
  }

  if (input.inputPaths.length > MAX_BATCH_IMAGES) {
    return fail(`Max ${MAX_BATCH_IMAGES} images per batch`, { workspacePath });
  }

  const results: BatchItemResult[] = [];

  for (const inputPath of input.inputPaths) {
    const rel = inputPath.replace(/\\/g, "/");
    const baseName = path.basename(rel, path.extname(rel));
    const ext = input.format ?? (path.extname(rel).slice(1) || "png");
    const outputPath = `${outputDir}/${baseName}-batch.${ext === "jpeg" ? "jpg" : ext}`;

    try {
      if (input.operation === "info") {
        const r = await imageInfo({ workspacePath, relativePath: rel });
        results.push({
          inputPath: rel,
          status: r.status === "PASS" ? "PASS" : "FAIL",
          error: r.error,
          detail: r.status === "PASS" ? { width: r.width, height: r.height, format: r.format } : undefined,
        });
      } else if (input.operation === "resize" || input.operation === "convert") {
        const r = await imageResize({
          workspacePath,
          inputPath: rel,
          outputPath,
          width: input.width,
          height: input.height,
          format: input.format ?? (input.operation === "convert" ? "webp" : undefined),
          quality: input.quality,
        });
        results.push({
          inputPath: rel,
          outputPath,
          status: r.status,
          error: r.error,
          detail:
            r.status === "PASS"
              ? { width: r.outputWidth, height: r.outputHeight, bytesWritten: r.bytesWritten }
              : undefined,
        });
      }
    } catch (err) {
      results.push({
        inputPath: rel,
        status: "FAIL",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.length - passed;

  const payload = {
    workspacePath,
    operation: input.operation,
    processed: results.length,
    passed,
    failed,
    results,
  };

  if (failed === 0) return pass(payload) as ImageBatchOutput;
  if (passed === 0) return fail("All batch items failed", payload) as ImageBatchOutput;
  return partial(payload) as ImageBatchOutput;
}
