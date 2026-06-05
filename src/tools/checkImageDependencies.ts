import {
  collectImageDependencies,
  imageDependencyStatus,
} from "../utils/imageDependencies.js";
import { fail } from "../utils/result.js";

export interface CheckImageDependenciesOutput {
  status: "PASS" | "PARTIAL" | "FAIL";
  node: boolean;
  npm: boolean;
  sharp: boolean;
  python: boolean;
  pip: boolean;
  rembg: boolean;
  realesrgan: boolean;
  replicateToken: boolean;
  removeBgApiKey: boolean;
  coreImageReady: boolean;
  removeBackgroundReady: boolean;
  aiUpscaleReady: boolean;
  installHints: string[];
}

export async function checkImageDependencies(): Promise<CheckImageDependenciesOutput> {
  const snap = await collectImageDependencies();
  const status = imageDependencyStatus(snap);

  if (!snap.coreImageReady) {
    return fail("sharp not available — run npm install", {
      ...snap,
      status: "FAIL",
    }) as unknown as CheckImageDependenciesOutput;
  }

  return { status, ...snap };
}
