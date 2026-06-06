#!/usr/bin/env node
/**
 * Copy eng + vie traineddata into resources/tessdata for offline eng+vie OCR.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "resources", "tessdata");

const SOURCES = [
  ["eng", path.join(ROOT, "node_modules", "@tesseract.js-data", "eng", "4.0.0", "eng.traineddata.gz")],
  ["vie", path.join(ROOT, "node_modules", "@tesseract.js-data", "vie", "4.0.0", "vie.traineddata.gz")],
];

fs.mkdirSync(OUT, { recursive: true });
let copied = 0;
for (const [, src] of SOURCES) {
  if (!fs.existsSync(src)) {
    console.warn(`[sync-bundled-tessdata] skip missing: ${src}`);
    continue;
  }
  const dest = path.join(OUT, path.basename(src));
  fs.copyFileSync(src, dest);
  copied++;
}
console.log(`[sync-bundled-tessdata] ${copied} file(s) -> ${OUT}`);
