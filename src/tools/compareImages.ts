import path from "node:path";
import fs from "node:fs";
import sharp from "sharp";
import { validateWorkspacePath } from "../safety/pathGuard.js";
import { resolveImageInput } from "../safety/imageGuard.js";
import { pass, fail } from "../utils/result.js";

export interface CompareImagesInput {
  workspacePath: string;
  referenceRelativePath: string;
  actualRelativePath: string;
  threshold?: number;
  outputDiffRelativePath?: string;
}

export interface CompareImagesOutput {
  status: "PASS" | "FAIL";
  workspacePath?: string;
  diffPercent?: number;
  matchingPixels?: number;
  totalPixels?: number;
  diffRelativePath?: string;
  threshold?: number;
  error?: string;
}

export async function compareImages(input: CompareImagesInput): Promise<CompareImagesOutput> {
  const validation = validateWorkspacePath(input.workspacePath);
  if (!validation.ok) return fail(validation.error ?? "Invalid workspace");

  const workspacePath = validation.resolvedPath!;
  const refResolved = resolveImageInput(workspacePath, input.referenceRelativePath);
  const actResolved = resolveImageInput(workspacePath, input.actualRelativePath);

  if (!refResolved.ok) return fail(refResolved.error ?? "Invalid reference image");
  if (!actResolved.ok) return fail(actResolved.error ?? "Invalid actual image");

  const threshold = input.threshold ?? 0.1;

  try {
    const pixelmatch = (await import("pixelmatch")).default;
    const { PNG } = await import("pngjs");

    const refMeta = await sharp(refResolved.resolved!.fullPath).metadata();
    const refW = refMeta.width ?? 1;
    const refH = refMeta.height ?? 1;
    const refBuf = await sharp(refResolved.resolved!.fullPath).png().toBuffer();
    const actBuf = await sharp(actResolved.resolved!.fullPath)
      .resize(refW, refH, { fit: "fill" })
      .png()
      .toBuffer();

    const img1 = PNG.sync.read(refBuf);
    const img2 = PNG.sync.read(actBuf);
    const { width, height } = img1;
    const diff = new PNG({ width, height });

    const mismatched = pixelmatch(img1.data, img2.data, diff.data, width, height, {
      threshold,
    });
    const totalPixels = width * height;
    const diffPercent = Math.round((mismatched / totalPixels) * 10000) / 100;

    let diffRelativePath: string | undefined;
    if (input.outputDiffRelativePath?.trim()) {
      const diffPath = path.resolve(workspacePath, input.outputDiffRelativePath.trim());
      fs.mkdirSync(path.dirname(diffPath), { recursive: true });
      fs.writeFileSync(diffPath, PNG.sync.write(diff));
      diffRelativePath = path.relative(workspacePath, diffPath).replace(/\\/g, "/");
    }

    return pass({
      workspacePath,
      diffPercent,
      matchingPixels: totalPixels - mismatched,
      totalPixels,
      diffRelativePath,
      threshold,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return fail(message, { workspacePath });
  }
}
