import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "node:path";
import fs from "node:fs";
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { imageText } from "../src/tools/imageText.js";
import { imageRounded } from "../src/tools/imageRounded.js";
import { imageUpscale } from "../src/tools/imageUpscale.js";
import { imageInfo } from "../src/tools/imageInfo.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.resolve(__dirname, "fixtures", "sample-project");
const ASSETS = path.join(FIXTURE, "assets");
const SOURCE = "assets/phase3-source.png";

beforeAll(async () => {
  fs.mkdirSync(ASSETS, { recursive: true });
  await sharp({
    create: { width: 80, height: 60, channels: 3, background: { r: 40, g: 80, b: 200 } },
  })
    .png()
    .toFile(path.join(FIXTURE, SOURCE));
});

afterAll(() => {
  for (const f of [
    "phase3-source.png",
    "phase3-text.png",
    "phase3-round.png",
    "phase3-circle.png",
    "phase3-upscale.png",
  ]) {
    try {
      fs.unlinkSync(path.join(ASSETS, f));
    } catch {
      // ignore
    }
  }
});

describe("image_text", () => {
  it("renders caption on image", async () => {
    const r = await imageText({
      workspacePath: FIXTURE,
      inputPath: SOURCE,
      outputPath: "assets/phase3-text.png",
      text: "Hello MCP",
      gravity: "south",
      color: "#ffffff",
      fontSize: 18,
    });
    expect(r.status).toBe("PASS");
    expect(fs.existsSync(path.join(ASSETS, "phase3-text.png"))).toBe(true);
  });
});

describe("image_rounded", () => {
  it("applies corner radius", async () => {
    const r = await imageRounded({
      workspacePath: FIXTURE,
      inputPath: SOURCE,
      outputPath: "assets/phase3-round.png",
      radius: 16,
    });
    expect(r.status).toBe("PASS");
    expect(r.appliedRadius).toBe(16);
  });

  it("applies circle mask", async () => {
    const r = await imageRounded({
      workspacePath: FIXTURE,
      inputPath: SOURCE,
      outputPath: "assets/phase3-circle.png",
      circle: true,
    });
    expect(r.status).toBe("PASS");
    const info = await imageInfo({
      workspacePath: FIXTURE,
      relativePath: "assets/phase3-circle.png",
    });
    expect(info.width).toBe(info.height);
  });
});

describe("image_upscale", () => {
  it("upscales 2x with lanczos3", async () => {
    const r = await imageUpscale({
      workspacePath: FIXTURE,
      inputPath: SOURCE,
      outputPath: "assets/phase3-upscale.png",
      scale: 2,
      sharpen: 0.5,
    });
    expect(r.status).toBe("PASS");
    expect(r.outputWidth).toBe(160);
    expect(r.outputHeight).toBe(120);
    expect(r.method).toBe("sharp-lanczos3");
  });

  it("rejects scale > MAX", async () => {
    const r = await imageUpscale({
      workspacePath: FIXTURE,
      inputPath: SOURCE,
      outputPath: "assets/bad-upscale.png",
      scale: 10,
    });
    expect(r.status).toBe("FAIL");
  });
});
