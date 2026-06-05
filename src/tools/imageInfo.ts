import { resolveImageInput, guardFail } from "../safety/imageGuard.js";
import { readImageMetadata } from "../utils/imageSafe.js";
import { pass } from "../utils/result.js";

export interface ImageInfoInput {
  workspacePath: string;
  relativePath: string;
}

export interface ImageInfoOutput {
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
  error?: string;
}

export async function imageInfo(input: ImageInfoInput): Promise<ImageInfoOutput> {
  const resolved = resolveImageInput(input.workspacePath, input.relativePath);
  if (!resolved.ok) {
    return guardFail(resolved.error, resolved.status ?? "FAIL", {
      workspacePath: input.workspacePath,
      relativePath: input.relativePath,
    }) as ImageInfoOutput;
  }

  const meta = await readImageMetadata(resolved.resolved.fullPath, resolved.resolved.sizeBytes);
  return pass({
    workspacePath: resolved.resolved.workspacePath,
    relativePath: resolved.resolved.relativePath,
    ...meta,
  });
}
