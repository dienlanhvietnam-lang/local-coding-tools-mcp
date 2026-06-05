#!/usr/bin/env node
/**
 * Generate local test images (no network). Run: node scripts/generate-image-fixtures.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "tests", "fixtures", "images");

async function main() {
  fs.mkdirSync(OUT, { recursive: true });

  const w = 1024;
  const h = 1024;
  const svg = `
    <svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#1e3a5f"/>
      <rect x="80" y="80" width="400" height="300" rx="24" fill="#e85d4c"/>
      <circle cx="720" cy="360" r="180" fill="#f4c542"/>
      <rect x="200" y="520" width="624" height="200" rx="12" fill="#3dd68c"/>
      <text x="512" y="900" font-size="48" text-anchor="middle" fill="#ffffff" font-family="Arial">PRODUCT SAMPLE</text>
    </svg>`;

  await sharp(Buffer.from(svg)).png().toFile(path.join(OUT, "product-sample-1024.png"));

  const transparentSvg = `
    <svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="none"/>
      <circle cx="256" cy="256" r="200" fill="#e85d4c" fill-opacity="0.85"/>
      <rect x="156" y="380" width="200" height="40" rx="8" fill="#3dd68c"/>
    </svg>`;

  await sharp(Buffer.from(transparentSvg)).png().toFile(path.join(OUT, "product-sample-transparent.png"));

  console.log("Generated:", path.join(OUT, "product-sample-1024.png"));
  console.log("Generated:", path.join(OUT, "product-sample-transparent.png"));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
