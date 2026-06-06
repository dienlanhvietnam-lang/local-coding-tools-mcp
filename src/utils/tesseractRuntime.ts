import fs from "node:fs";
import path from "node:path";
import { createWorker, type Worker } from "tesseract.js";
import { PROJECT_ROOT } from "../config.js";

const CORE_PATH = path.join(PROJECT_ROOT, "node_modules", "tesseract.js-core");
const COMBINED_TESSDATA = path.join(PROJECT_ROOT, "resources", "tessdata");

const BUNDLED_LANG_DIRS: Record<string, string> = {
  eng: path.join(PROJECT_ROOT, "node_modules", "@tesseract.js-data", "eng", "4.0.0"),
  vie: path.join(PROJECT_ROOT, "node_modules", "@tesseract.js-data", "vie", "4.0.0"),
};

/** Languages with offline tessdata in node_modules (and eng+vie combined folder). */
export const BUNDLED_OCR_LANGUAGES = new Set(["eng", "vie"]);

function ensureDirEndsWithSep(dir: string): string {
  return dir.endsWith(path.sep) ? dir : dir + path.sep;
}

function langPathFor(languages: string): { langPath: string; gzip: boolean } {
  const codes = languages
    .split("+")
    .map((c) => c.trim())
    .filter(Boolean);
  const allBundled = codes.length > 0 && codes.every((c) => BUNDLED_OCR_LANGUAGES.has(c));
  if (!allBundled) {
    return { langPath: "https://tessdata.projectnaptha.com/4.0.0/", gzip: false };
  }

  if (codes.length === 1) {
    const single = BUNDLED_LANG_DIRS[codes[0]!];
    if (single && fs.existsSync(single)) {
      return { langPath: ensureDirEndsWithSep(single), gzip: true };
    }
  }

  if (fs.existsSync(COMBINED_TESSDATA)) {
    return { langPath: ensureDirEndsWithSep(COMBINED_TESSDATA), gzip: true };
  }

  // Fallback: first language package dir
  const fallback = BUNDLED_LANG_DIRS[codes[0]!];
  return { langPath: ensureDirEndsWithSep(fallback), gzip: true };
}

export function usesBundledTessdata(languages: string): boolean {
  const codes = languages
    .split("+")
    .map((c) => c.trim())
    .filter(Boolean);
  return codes.length > 0 && codes.every((c) => BUNDLED_OCR_LANGUAGES.has(c));
}

export async function createOcrWorker(languages: string): Promise<Worker> {
  const key = languages.trim() || "eng";
  const { langPath, gzip } = langPathFor(key);
  return createWorker(key, 1, {
    langPath,
    corePath: CORE_PATH,
    gzip,
    logger: () => {},
  });
}

/** Run OCR with a short-lived worker (terminated after each call). */
export async function runOcrOnBuffer(
  languages: string,
  buffer: Buffer
): Promise<Awaited<ReturnType<Worker["recognize"]>>["data"]> {
  const worker = await createOcrWorker(languages);
  try {
    const { data } = await worker.recognize(buffer, {}, { text: true, blocks: true });
    return data;
  } finally {
    await worker.terminate();
  }
}

/** Test teardown — no-op when workers are not cached. */
export async function terminateOcrWorkers(): Promise<void> {}
