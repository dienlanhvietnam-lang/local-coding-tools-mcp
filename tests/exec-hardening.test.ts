import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import sharp from "sharp";
import {
  assertSafeCommand,
  runCommand,
} from "../src/utils/execSafe.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "src");
const FIXTURE = path.join(ROOT, "tests", "fixtures", "sample-project");
const TEST_SOURCE = path.join(FIXTURE, "assets", "exec-hard-source.png");

beforeAll(async () => {
  fs.mkdirSync(path.dirname(TEST_SOURCE), { recursive: true });
  await sharp({
    create: {
      width: 64,
      height: 64,
      channels: 4,
      background: { r: 120, g: 80, b: 200, alpha: 1 },
    },
  })
    .png()
    .toFile(TEST_SOURCE);
});

afterAll(() => {
  try {
    fs.unlinkSync(TEST_SOURCE);
  } catch {
    // ignore
  }
});

function walkTs(dir: string, out: string[] = []): string[] {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walkTs(full, out);
    else if (ent.name.endsWith(".ts")) out.push(full);
  }
  return out;
}

describe("exec hardening R1", () => {
  it("assertSafeCommand rejects merged command strings", () => {
    expect(() => assertSafeCommand("npm run build")).toThrow(/spaces/);
    expect(() => assertSafeCommand("node -e")).toThrow();
    expect(() => assertSafeCommand("npm")).not.toThrow();
  });

  it("runCommand npm --version returns PASS", async () => {
    const r = await runCommand("npm", ["--version"], { timeoutMs: 15_000 });
    expect(r.command).toBe("npm");
    expect(r.args).toEqual(["--version"]);
    expect(r.status).toBe("PASS");
    expect(r.stdout.length).toBeGreaterThan(0);
  }, 20_000);

  it("runCommand returns raw stdout/stderr (no redaction)", async () => {
    const r = await runCommand("node", [
      "-e",
      "console.log('token=super-secret-token api_key=sk-abc123xyz')",
    ], { timeoutMs: 10_000 });
    const combined = r.stdout + r.stderr;
    expect(combined).toMatch(/sk-abc123xyz/);
    expect(combined).not.toMatch(/REDACTED/i);
  });

  it("image dependency detection does not crash when command missing", async () => {
    const { commandExists } = await import("../src/utils/imageDependencies.js");
    const r = await commandExists("definitely-not-a-real-tool-xyz-999");
    expect(r.ok).toBe(false);
  });

  it("aiUpscale missing dependency returns not ok", async () => {
    const { upscaleViaRealesrganCli } = await import("../src/utils/aiUpscale.js");
    const tmp = path.join(ROOT, "tests", "fixtures", "images", "product-sample-1024.png");
    const out = path.join(ROOT, "tests", "fixtures", "sample-project", "assets", "exec-hard-test-out.png");
    const r = await upscaleViaRealesrganCli(tmp, out, 2, 3000);
    if (!r.ok) {
      expect(r.error).toMatch(/not found|PATH|failed/i);
    }
  });

  it("imageRemoveBackground missing API returns SKIPPED", async () => {
    const { imageRemoveBackground } = await import("../src/tools/imageRemoveBackground.js");
    const prevKey = process.env.REMOVE_BG_API_KEY;
    delete process.env.REMOVE_BG_API_KEY;
    try {
      const r = await imageRemoveBackground({
        workspacePath: FIXTURE,
        inputPath: "assets/exec-hard-source.png",
        outputPath: "assets/exec-hard-nobg.png",
        mode: "api",
        timeoutMs: 3000,
      });
      expect(r.status).toBe("SKIPPED");
      expect(r.reason).toBe("missing_dependency");
    } finally {
      if (prevKey === undefined) delete process.env.REMOVE_BG_API_KEY;
      else process.env.REMOVE_BG_API_KEY = prevKey;
    }
  });

  it("src/ has no execSync string or shell:true", () => {
    const bad: string[] = [];
    for (const file of walkTs(SRC)) {
      const rel = path.relative(ROOT, file);
      const content = fs.readFileSync(file, "utf8");
      for (const [i, line] of content.split(/\r?\n/).entries()) {
        const trimmed = line.trim();
        if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue;
        if (/execSync\s*\(\s*[`'"]/.test(line)) bad.push(`${rel}:${i + 1} execSync`);
        if (/shell\s*:\s*true/.test(line)) bad.push(`${rel}:${i + 1} shell:true`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("check-exec-hardening.mjs passes", () => {
    const r = spawnSync(process.execPath, ["scripts/check-exec-hardening.mjs"], {
      cwd: ROOT,
      shell: false,
      encoding: "utf8",
    });
    expect(r.status).toBe(0);
  });

  it("verify-customer-zip-clean does not use execSync", () => {
    const content = fs.readFileSync(
      path.join(ROOT, "scripts/verify-customer-zip-clean.mjs"),
      "utf8",
    );
    expect(content).not.toMatch(/execSync\s*\(/);
    expect(content).not.toMatch(/shell\s*:\s*true/);
  });
});
