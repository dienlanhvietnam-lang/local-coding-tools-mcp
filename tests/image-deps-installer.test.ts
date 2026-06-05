import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  buildDependencyComponents,
  collectImageDependencies,
  profileExitCode,
} from "../src/utils/imageDependencies.js";
import { checkImageDependencies } from "../src/tools/checkImageDependencies.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const INSTALLER_FILES = [
  "scripts/check-image-deps.ps1",
  "scripts/check-image-deps.mjs",
  "scripts/install-image-deps.ps1",
  "scripts/verify-full-image-local.ps1",
  "scripts/verify-image-profile.mjs",
  "scripts/image-deps-smoke.mjs",
];

describe("image deps installer R1", () => {
  it("has all installer scripts", () => {
    for (const rel of INSTALLER_FILES) {
      expect(fs.existsSync(path.join(ROOT, rel)), rel).toBe(true);
    }
  });

  it("check_image_dependencies does not leak token values", async () => {
    const r = await checkImageDependencies();
    const json = JSON.stringify(r);
    expect(json).not.toMatch(/sk-[a-z0-9]{10,}/i);
    expect(r.replicateToken).toBeTypeOf("boolean");
    expect(r.removeBgApiKey).toBeTypeOf("boolean");
    expect(r.node).toBe(true);
    expect(r.npm).toBe(true);
  });

  it("image-core profile exit 0 when core ready", async () => {
    const snap = await collectImageDependencies();
    expect(snap.coreImageReady).toBe(true);
    expect(profileExitCode("image-core", snap)).toBe(0);
    expect(["PASS", "PARTIAL"]).toContain(
      (await checkImageDependencies()).status,
    );
  });

  it("full-image profile exit 1 when ai upscale missing", async () => {
    const snap = await collectImageDependencies();
    if (!snap.aiUpscaleReady) {
      expect(profileExitCode("full-image", snap)).toBe(1);
    } else {
      expect(profileExitCode("full-image", snap)).toBe(0);
    }
  });

  it("buildDependencyComponents has fix hints for rembg and realesrgan", () => {
    const rows = buildDependencyComponents({
      node: true,
      npm: true,
      sharp: true,
      python: false,
      pip: false,
      rembg: false,
      imglyNode: false,
      realesrgan: false,
      replicateToken: false,
      removeBgApiKey: false,
      coreImageReady: true,
      removeBackgroundReady: false,
      aiUpscaleReady: false,
      installHints: [],
    });
    const rembg = rows.find((r) => r.component === "rembg");
    const esrgan = rows.find((r) => r.component === "realesrgan-ncnn-vulkan");
    expect(rembg?.fix).toMatch(/install-image-deps/i);
    expect(esrgan?.fix).toMatch(/Real-ESRGAN/i);
  });

  it("image-deps-smoke.mjs passes", () => {
    execSync("node scripts/image-deps-smoke.mjs", {
      cwd: ROOT,
      encoding: "utf8",
      stdio: "pipe",
    });
  });
});
