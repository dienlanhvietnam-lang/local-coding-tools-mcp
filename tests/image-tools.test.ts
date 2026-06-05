import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "node:path";
import fs from "node:fs";
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { imageInfo } from "../src/tools/imageInfo.js";
import { imageCrop } from "../src/tools/imageCrop.js";
import { imageResize } from "../src/tools/imageResize.js";
import { imageRemoveBackground } from "../src/tools/imageRemoveBackground.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.resolve(__dirname, "fixtures", "sample-project");
const ASSETS = path.join(FIXTURE, "assets");
const SOURCE = path.join(ASSETS, "test-source.png");

beforeAll(async () => {
  fs.mkdirSync(ASSETS, { recursive: true });
  await sharp({
    create: {
      width: 120,
      height: 80,
      channels: 4,
      background: { r: 200, g: 100, b: 50, alpha: 1 },
    },
  })
    .png()
    .toFile(SOURCE);
});

afterAll(() => {
  for (const f of ["test-source.png", "test-crop.png", "test-resize.webp", "test-nobg.png"]) {
    try {
      fs.unlinkSync(path.join(ASSETS, f));
    } catch {
      // ignore
    }
  }
});

describe("image_info", () => {
  it("reads metadata", async () => {
    const r = await imageInfo({
      workspacePath: FIXTURE,
      relativePath: "assets/test-source.png",
    });
    expect(r.status).toBe("PASS");
    expect(r.width).toBe(120);
    expect(r.height).toBe(80);
    expect(r.format).toBe("png");
  });

  it("FAIL for missing file", async () => {
    const r = await imageInfo({
      workspacePath: FIXTURE,
      relativePath: "assets/missing.png",
    });
    expect(r.status).toBe("FAIL");
  });
});

describe("image_crop", () => {
  it("crops region", async () => {
    const r = await imageCrop({
      workspacePath: FIXTURE,
      inputPath: "assets/test-source.png",
      outputPath: "assets/test-crop.png",
      left: 10,
      top: 5,
      width: 50,
      height: 40,
    });
    expect(r.status).toBe("PASS");
    expect(r.outputWidth).toBe(50);
    expect(r.outputHeight).toBe(40);
    const info = await imageInfo({
      workspacePath: FIXTURE,
      relativePath: "assets/test-crop.png",
    });
    expect(info.width).toBe(50);
  });

  it("FAIL when crop exceeds bounds", async () => {
    const r = await imageCrop({
      workspacePath: FIXTURE,
      inputPath: "assets/test-source.png",
      outputPath: "assets/bad-crop.png",
      left: 0,
      top: 0,
      width: 999,
      height: 999,
    });
    expect(r.status).toBe("FAIL");
  });
});

describe("image_resize", () => {
  it("resizes and converts to webp", async () => {
    const r = await imageResize({
      workspacePath: FIXTURE,
      inputPath: "assets/test-source.png",
      outputPath: "assets/test-resize.webp",
      width: 60,
      format: "webp",
    });
    expect(r.status).toBe("PASS");
    expect(r.outputWidth).toBe(60);
    const info = await imageInfo({
      workspacePath: FIXTURE,
      relativePath: "assets/test-resize.webp",
    });
    expect(info.format).toBe("webp");
  });
});

describe("image_remove_background", () => {
  it("returns SKIPPED or PASS when rembg/api unavailable", async () => {
    const r = await imageRemoveBackground({
      workspacePath: FIXTURE,
      inputPath: "assets/test-source.png",
      outputPath: "assets/test-nobg.png",
      mode: "cli",
      timeoutMs: 5000,
    });
    expect(["PASS", "SKIPPED"]).toContain(r.status);
    if (r.status === "SKIPPED") {
      expect(r.reason).toBe("missing_dependency");
      expect(r.installHint).toBeTruthy();
    }
  });
});
