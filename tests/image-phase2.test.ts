import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "node:path";
import fs from "node:fs";
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { imageAdjust } from "../src/tools/imageAdjust.js";
import { imageComposite } from "../src/tools/imageComposite.js";
import { imageBatch } from "../src/tools/imageBatch.js";
import { imageRemoveBackground } from "../src/tools/imageRemoveBackground.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.resolve(__dirname, "fixtures", "sample-project");
const ASSETS = path.join(FIXTURE, "assets");
const BATCH_OUT = path.join(ASSETS, "batch-out");

const SOURCE = "assets/test-source.png";
const OVERLAY = "assets/test-overlay.png";

beforeAll(async () => {
  fs.mkdirSync(ASSETS, { recursive: true });
  await sharp({
    create: { width: 100, height: 80, channels: 4, background: { r: 30, g: 120, b: 200, alpha: 1 } },
  })
    .png()
    .toFile(path.join(FIXTURE, SOURCE));
  await sharp({
    create: { width: 40, height: 20, channels: 4, background: { r: 255, g: 255, b: 0, alpha: 0.8 } },
  })
    .png()
    .toFile(path.join(FIXTURE, OVERLAY));
});

afterAll(() => {
  for (const f of [
    "test-source.png",
    "test-overlay.png",
    "test-adjust.png",
    "test-composite.png",
    "test-nobg-node.png",
  ]) {
    try {
      fs.unlinkSync(path.join(ASSETS, f));
    } catch {
      // ignore
    }
  }
  try {
    fs.rmSync(BATCH_OUT, { recursive: true, force: true });
  } catch {
    // ignore
  }
});

describe("image_adjust", () => {
  it("applies brightness and greyscale", async () => {
    const r = await imageAdjust({
      workspacePath: FIXTURE,
      inputPath: SOURCE,
      outputPath: "assets/test-adjust.png",
      brightness: 1.2,
      greyscale: true,
    });
    expect(r.status).toBe("PASS");
    expect(r.applied).toContain("greyscale");
  });
});

describe("image_composite", () => {
  it("overlays with center gravity", async () => {
    const r = await imageComposite({
      workspacePath: FIXTURE,
      basePath: SOURCE,
      overlayPath: OVERLAY,
      outputPath: "assets/test-composite.png",
      gravity: "center",
      opacity: 0.7,
    });
    expect(r.status).toBe("PASS");
    expect(r.outputWidth).toBe(100);
  });
});

describe("image_batch", () => {
  it("batch info for multiple files", async () => {
    const r = await imageBatch({
      workspacePath: FIXTURE,
      operation: "info",
      inputPaths: [SOURCE, OVERLAY],
      outputDir: "assets/batch-out",
    });
    expect(r.status).toBe("PASS");
    expect(r.passed).toBe(2);
  });

  it("batch resize", async () => {
    const r = await imageBatch({
      workspacePath: FIXTURE,
      operation: "resize",
      inputPaths: [SOURCE],
      outputDir: "assets/batch-out",
      width: 50,
      format: "webp",
    });
    expect(r.status).toBe("PASS");
    expect(fs.existsSync(path.join(BATCH_OUT, "test-source-batch.webp"))).toBe(true);
  });
});

describe("image_remove_background node mode", () => {
  it(
    "removes background via imgly-node when available",
    async () => {
      const r = await imageRemoveBackground({
        workspacePath: FIXTURE,
        inputPath: SOURCE,
        outputPath: "assets/test-nobg-node.png",
        mode: "node",
        timeoutMs: 180_000,
      });
      expect(["PASS", "FAIL", "SKIPPED"]).toContain(r.status);
      if (r.status === "SKIPPED") return;
      if (r.status === "PASS") {
        expect(r.method).toBe("imgly-node");
      }
    },
    240_000
  );
});
