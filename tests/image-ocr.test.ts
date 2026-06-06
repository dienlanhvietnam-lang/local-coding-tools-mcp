import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "node:path";
import fs from "node:fs";
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { imageOcr } from "../src/tools/imageOcr.js";
import { terminateOcrWorkers } from "../src/utils/tesseractRuntime.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.resolve(__dirname, "fixtures", "sample-project");
const ASSETS = path.join(FIXTURE, "assets");
const OCR_SAMPLE = path.join(ASSETS, "test-ocr-sample.png");

beforeAll(async () => {
  fs.mkdirSync(ASSETS, { recursive: true });
  const svg = `<svg width="300" height="80" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="white"/>
  <text x="20" y="52" font-family="Arial, sans-serif" font-size="36" fill="black">HELLO OCR</text>
</svg>`;
  await sharp(Buffer.from(svg)).png().toFile(OCR_SAMPLE);
}, 30_000);

afterAll(async () => {
  try {
    fs.unlinkSync(OCR_SAMPLE);
  } catch {
    // ignore
  }
  await terminateOcrWorkers();
});

describe("image_ocr", () => {
  it(
    "extracts text with bundled eng tessdata",
    async () => {
      const r = await imageOcr({
        workspacePath: FIXTURE,
        relativePath: "assets/test-ocr-sample.png",
        languages: "eng",
      });
      expect(r.status).toBe("PASS");
      expect(r.tessdataSource).toBe("bundled");
      expect(r.width).toBeGreaterThan(0);
      expect(r.height).toBeGreaterThan(0);
      expect(r.format).toBe("png");
      expect(r.preprocess?.scaledWidth).toBeGreaterThan(0);
      expect(r.fullText?.toUpperCase()).toMatch(/HELLO/);
      expect(r.blockCount).toBeGreaterThan(0);
      expect(r.blocks?.length).toBeGreaterThan(0);
    },
    180_000
  );

  it(
    "extracts Vietnamese with bundled vie tessdata",
    async () => {
      const vieSvg = `<svg width="320" height="80" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="white"/>
  <text x="20" y="52" font-family="Arial, sans-serif" font-size="32" fill="black">Xin chao Viet Nam</text>
</svg>`;
      const viePath = path.join(ASSETS, "test-ocr-vie.png");
      await sharp(Buffer.from(vieSvg)).png().toFile(viePath);

      const r = await imageOcr({
        workspacePath: FIXTURE,
        relativePath: "assets/test-ocr-vie.png",
        languages: "vie",
      });
      try {
        fs.unlinkSync(viePath);
      } catch {
        // ignore
      }
      expect(r.status).toBe("PASS");
      expect(r.tessdataSource).toBe("bundled");
      expect(r.languages).toBe("vie");
      expect((r.fullText ?? "").length).toBeGreaterThan(0);
    },
    180_000
  );

  it("FAIL for missing image", async () => {
    const r = await imageOcr({
      workspacePath: FIXTURE,
      relativePath: "assets/missing-ocr.png",
    });
    expect(r.status).toBe("FAIL");
  });
});
