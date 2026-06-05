#!/usr/bin/env node
/**
 * Verify image tool profiles: image-core | full-image
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const FIXTURE = path.join(ROOT, "tests", "fixtures", "images");
const WORKSPACE = path.join(ROOT, "tests", "fixtures", "sample-project");
const OUT = path.join(WORKSPACE, "assets", "profile-verify");

const profileArg = process.argv.find((a) => a.startsWith("--profile="))?.split("=")[1]
  ?? (process.argv.includes("--profile") ? process.argv[process.argv.indexOf("--profile") + 1] : "image-core");
const profile = profileArg === "full-image" ? "full-image" : "image-core";

async function importTool(rel) {
  return import(pathToFileURL(path.join(ROOT, "dist", rel)).href);
}

const results = [];

function record(name, status, detail = "") {
  results.push({ name, status, detail });
}

function okStatus(s) {
  return s === "PASS" || s === "SKIPPED";
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const src1024 = path.join(FIXTURE, "product-sample-1024.png");
  if (!fs.existsSync(src1024)) {
    console.error("Missing fixture — run: node scripts/generate-image-fixtures.mjs");
    process.exit(1);
  }

  const rel1024 = path.relative(WORKSPACE, src1024).replace(/\\/g, "/");
  const copyRel = "assets/profile-verify/input-1024.png";
  fs.copyFileSync(src1024, path.join(WORKSPACE, copyRel));

  const { imageInfo } = await importTool("tools/imageInfo.js");
  const { imageResize } = await importTool("tools/imageResize.js");
  const { imageCrop } = await importTool("tools/imageCrop.js");
  const { imageAdjust } = await importTool("tools/imageAdjust.js");
  const { imageText } = await importTool("tools/imageText.js");
  const { imageRounded } = await importTool("tools/imageRounded.js");
  const { imageBatch } = await importTool("tools/imageBatch.js");
  const { imageUpscale } = await importTool("tools/imageUpscale.js");
  const { imageRemoveBackground } = await importTool("tools/imageRemoveBackground.js");
  const { imageUpscaleAi } = await importTool("tools/imageUpscaleAi.js");

  const rInfo = await imageInfo({ workspacePath: WORKSPACE, relativePath: copyRel });
  record("image_info", rInfo.status);

  const rResize = await imageResize({
    workspacePath: WORKSPACE,
    inputPath: copyRel,
    outputPath: "assets/profile-verify/resized-800.webp",
    width: 800,
    format: "webp",
  });
  record("image_resize", rResize.status);

  const rCrop = await imageCrop({
    workspacePath: WORKSPACE,
    inputPath: copyRel,
    outputPath: "assets/profile-verify/crop.png",
    left: 50,
    top: 50,
    width: 400,
    height: 400,
  });
  record("image_crop", rCrop.status);

  const rAdjust = await imageAdjust({
    workspacePath: WORKSPACE,
    inputPath: copyRel,
    outputPath: "assets/profile-verify/adjust.png",
    brightness: 1.1,
  });
  record("image_adjust", rAdjust.status);

  const rText = await imageText({
    workspacePath: WORKSPACE,
    inputPath: copyRel,
    outputPath: "assets/profile-verify/text.png",
    text: "Profile OK",
    gravity: "south",
  });
  record("image_text", rText.status);

  const rRound = await imageRounded({
    workspacePath: WORKSPACE,
    inputPath: copyRel,
    outputPath: "assets/profile-verify/rounded.png",
    radius: 48,
  });
  record("image_rounded", rRound.status);

  const rBatch = await imageBatch({
    workspacePath: WORKSPACE,
    operation: "resize",
    inputPaths: [copyRel],
    outputDir: "assets/profile-verify/batch",
    width: 256,
    format: "webp",
  });
  record("image_batch", rBatch.status);

  const rUpscale = await imageUpscale({
    workspacePath: WORKSPACE,
    inputPath: copyRel,
    outputPath: "assets/profile-verify/upscale.png",
    scale: 1.5,
  });
  record("image_upscale", rUpscale.status);

  const rNobg = await imageRemoveBackground({
    workspacePath: WORKSPACE,
    inputPath: copyRel,
    outputPath: "assets/profile-verify/nobg.png",
    mode: profile === "full-image" ? "auto" : "cli",
    timeoutMs: profile === "full-image" ? 120_000 : 8000,
  });
  if (profile === "image-core") {
    record("image_remove_background", okStatus(rNobg.status) ? (rNobg.status === "SKIPPED" ? "SKIPPED" : "PASS") : "FAIL", rNobg.reason ?? rNobg.installHint ?? "");
  } else {
    record("image_remove_background", rNobg.status === "PASS" ? "PASS" : "FAIL", rNobg.installHint ?? rNobg.error ?? "");
  }

  const prevToken = process.env.REPLICATE_API_TOKEN;
  if (profile === "full-image") delete process.env.REPLICATE_API_TOKEN;
  const rAi = await imageUpscaleAi({
    workspacePath: WORKSPACE,
    inputPath: copyRel,
    outputPath: "assets/profile-verify/ai-upscale.png",
    scale: 2,
    mode: profile === "full-image" ? "auto" : "cli",
    timeoutMs: profile === "full-image" ? 60_000 : 8000,
  });
  if (prevToken) process.env.REPLICATE_API_TOKEN = prevToken;

  if (profile === "image-core") {
    record("image_upscale_ai", okStatus(rAi.status) ? (rAi.status === "SKIPPED" ? "SKIPPED" : "PASS") : "FAIL", rAi.reason ?? rAi.installHint ?? "");
  } else {
    const tokenOk = Boolean(prevToken?.trim());
    const passAi = rAi.status === "PASS" || (tokenOk && rAi.status !== "SKIPPED");
    record("image_upscale_ai", passAi ? "PASS" : "FAIL", rAi.installHint ?? rAi.error ?? "missing realesrgan or REPLICATE_API_TOKEN");
  }

  console.log(`\n=== verify-image-profile (${profile}) ===\n`);
  for (const r of results) {
    const color = r.status === "PASS" ? "\x1b[32m" : r.status === "SKIPPED" ? "\x1b[33m" : "\x1b[31m";
    console.log(`${color}${r.status.padEnd(7)}\x1b[0m ${r.name}${r.detail ? ` — ${r.detail}` : ""}`);
  }

  const coreTools = results.filter((r) => !r.name.includes("remove_background") && !r.name.includes("upscale_ai"));
  const corePass = coreTools.every((r) => r.status === "PASS");
  const optional = results.filter((r) => r.name.includes("remove_background") || r.name.includes("upscale_ai"));

  let overall = "PASS";
  if (!corePass) overall = "FAIL";
  else if (profile === "full-image" && optional.some((r) => r.status === "FAIL")) overall = "FAIL";
  else if (profile === "image-core" && optional.some((r) => r.status === "FAIL")) overall = "FAIL";

  console.log(`\nOVERALL: ${overall}`);
  process.exit(overall === "PASS" ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
