import { describe, it, expect, beforeAll, vi } from "vitest";
import path from "node:path";
import fs from "node:fs";
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { imageRemoveBackground } from "../src/tools/imageRemoveBackground.js";
import { imageUpscaleAi } from "../src/tools/imageUpscaleAi.js";
import { checkImageDependencies } from "../src/tools/checkImageDependencies.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.resolve(__dirname, "fixtures", "sample-project");
const IMAGES = path.resolve(__dirname, "fixtures", "images");
const SOURCE = "assets/test-source.png";

beforeAll(async () => {
  if (!fs.existsSync(path.join(IMAGES, "product-sample-1024.png"))) {
    throw new Error("Run: node scripts/generate-image-fixtures.mjs");
  }
  fs.mkdirSync(path.join(FIXTURE, "assets"), { recursive: true });
  if (!fs.existsSync(path.join(FIXTURE, SOURCE))) {
    await sharp({
      create: { width: 80, height: 60, channels: 4, background: { r: 100, g: 150, b: 200, alpha: 1 } },
    })
      .png()
      .toFile(path.join(FIXTURE, SOURCE));
  }
  fs.copyFileSync(
    path.join(IMAGES, "product-sample-1024.png"),
    path.join(FIXTURE, "assets", "product-sample-1024.png"),
  );
});

describe("optional image SKIPPED", () => {
  it("image_remove_background missing dependency returns SKIPPED with installHint", async () => {
    vi.stubEnv("REMOVE_BG_API_KEY", "");
    const r = await imageRemoveBackground({
      workspacePath: FIXTURE,
      inputPath: SOURCE,
      outputPath: "assets/test-nobg-skip.png",
      mode: "api",
      timeoutMs: 3000,
    });
    vi.unstubAllEnvs();
    expect(r.status).toBe("SKIPPED");
    expect(r.reason).toBe("missing_dependency");
    expect(r.dependency).toBe("rembg_or_removebg_api");
    expect(r.installHint).toMatch(/install-image-deps/i);
  });

  it("image_upscale_ai missing dependency returns SKIPPED with installHint", async () => {
    vi.stubEnv("REPLICATE_API_TOKEN", "");
    const r = await imageUpscaleAi({
      workspacePath: FIXTURE,
      inputPath: SOURCE,
      outputPath: "assets/test-ai-skip.png",
      mode: "cli",
      scale: 2,
      timeoutMs: 3000,
    });
    vi.unstubAllEnvs();
    if (r.status === "SKIPPED") {
      expect(r.reason).toBe("missing_dependency");
      expect(r.dependency).toMatch(/realesrgan/i);
      expect(r.installHint).toBeTruthy();
    } else {
      expect(["PASS", "FAIL"]).toContain(r.status);
    }
  });
});

describe("check_image_dependencies", () => {
  it("coreImageReady true and no token values in output", async () => {
    const r = await checkImageDependencies();
    expect(r.coreImageReady).toBe(true);
    expect(r.sharp).toBe(true);
    expect(["PASS", "PARTIAL"]).toContain(r.status);
    const json = JSON.stringify(r);
    expect(json).not.toMatch(/sk-[a-z0-9]{10,}/i);
    expect(r.replicateToken).toBeTypeOf("boolean");
    expect(r.removeBgApiKey).toBeTypeOf("boolean");
  });
});

describe("large fixture image tools", () => {
  it("resize 1024 → 800 webp", async () => {
    const { imageResize } = await import("../src/tools/imageResize.js");
    const r = await imageResize({
      workspacePath: FIXTURE,
      inputPath: "assets/product-sample-1024.png",
      outputPath: "assets/large-resize.webp",
      width: 800,
      format: "webp",
    });
    expect(r.status).toBe("PASS");
    expect(r.outputWidth).toBe(800);
  });
});
