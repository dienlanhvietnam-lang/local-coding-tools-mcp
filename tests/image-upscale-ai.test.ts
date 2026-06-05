import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "node:path";
import fs from "node:fs";
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { imageUpscaleAi } from "../src/tools/imageUpscaleAi.js";
import {
  upscaleViaRealesrganCli,
  upscaleViaReplicateApi,
} from "../src/utils/aiUpscale.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.resolve(__dirname, "fixtures", "sample-project");
const SOURCE = "assets/ai-upscale-src.png";

beforeAll(async () => {
  fs.mkdirSync(path.join(FIXTURE, "assets"), { recursive: true });
  await sharp({
    create: { width: 64, height: 64, channels: 3, background: { r: 100, g: 150, b: 200 } },
  })
    .png()
    .toFile(path.join(FIXTURE, SOURCE));
});

afterAll(() => {
  try {
    fs.unlinkSync(path.join(FIXTURE, SOURCE));
    fs.unlinkSync(path.join(FIXTURE, "assets", "ai-upscale-out.png"));
  } catch {
    // ignore
  }
});

describe("image_upscale_ai", () => {
  it("SKIPPED with installHint when no CLI and no API token", async () => {
    const prev = process.env.REPLICATE_API_TOKEN;
    delete process.env.REPLICATE_API_TOKEN;
    const r = await imageUpscaleAi({
      workspacePath: FIXTURE,
      inputPath: SOURCE,
      outputPath: "assets/ai-upscale-out.png",
      scale: 2,
      mode: "auto",
      timeoutMs: 5000,
    });
    if (prev) process.env.REPLICATE_API_TOKEN = prev;
    expect(r.status).toBe("SKIPPED");
    expect(r.reason).toBe("missing_dependency");
    expect(r.installHint ?? r.hint).toMatch(/realesrgan|REPLICATE/i);
  });

  it("api mode without token returns SKIPPED", async () => {
    const prev = process.env.REPLICATE_API_TOKEN;
    delete process.env.REPLICATE_API_TOKEN;
    const r = await imageUpscaleAi({
      workspacePath: FIXTURE,
      inputPath: SOURCE,
      outputPath: "assets/ai-upscale-out.png",
      mode: "api",
    });
    if (prev) process.env.REPLICATE_API_TOKEN = prev;
    expect(r.status).toBe("SKIPPED");
  });
});

describe("aiUpscale utils", () => {
  it("realesrgan CLI returns error when not installed", async () => {
    const r = await upscaleViaRealesrganCli(
      path.join(FIXTURE, SOURCE),
      path.join(FIXTURE, "assets", "cli-out.png"),
      2,
      3000
    );
    expect(r.ok).toBe(false);
  });
});
