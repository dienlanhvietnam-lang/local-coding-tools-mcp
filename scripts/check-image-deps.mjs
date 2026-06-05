#!/usr/bin/env node
/**
 * Image dependency check (JSON + exit codes). Used by check-image-deps.ps1 and CI.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const args = process.argv.slice(2);
const profile = (() => {
  const i = args.indexOf("--profile");
  return i >= 0 ? args[i + 1] : "image-core";
})();
const jsonOnly = args.includes("--json");

async function main() {
  const modPath = path.join(ROOT, "dist", "utils", "imageDependencies.js");
  if (!fs.existsSync(modPath)) {
    const err = { error: "dist not built", fix: "npm run build", exitCode: 2 };
    console.log(JSON.stringify(err, null, 2));
    process.exit(2);
  }

  try {
    const mod = await import(pathToFileURL(modPath).href);
    const snap = await mod.collectImageDependencies();
    const status = mod.imageDependencyStatus(snap);
    const components = mod.buildDependencyComponents(snap);
    const exitCode = mod.profileExitCode(profile, snap);

    const report = {
      profile,
      status,
      exitCode,
      node: snap.node,
      npm: snap.npm,
      sharp: snap.sharp,
      python: snap.python,
      pip: snap.pip,
      rembg: snap.rembg,
      imglyNode: snap.imglyNode,
      realesrgan: snap.realesrgan,
      replicateToken: snap.replicateToken,
      removeBgApiKey: snap.removeBgApiKey,
      coreImageReady: snap.coreImageReady,
      removeBackgroundReady: snap.removeBackgroundReady,
      aiUpscaleReady: snap.aiUpscaleReady,
      installHints: snap.installHints,
      components,
    };

    console.log(JSON.stringify(report, null, 2));
    process.exit(exitCode);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(JSON.stringify({ error: msg, exitCode: 2 }, null, 2));
    process.exit(2);
  }
}

main();
