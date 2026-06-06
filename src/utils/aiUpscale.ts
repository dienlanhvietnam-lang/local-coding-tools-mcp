import fs from "node:fs";
import path from "node:path";
import { runCommand as safeRun } from "./execSafe.js";

/** Replicate model: nightmareai/real-esrgan */
export const REPLICATE_ESRGAN_VERSION =
  "42fed1c4974146d4d2624fd870237aa4deaca82bc24192872db9ebaaaad7e3f3";

export type AiUpscaleMethod = "realesrgan-cli" | "waifu2x-cli" | "replicate-api";

/**
 * Run a CLI upscaler with safe command+args (no shell concat).
 * If the command is missing, returns a FAIL result — callers treat as SKIPPED.
 */
async function runCli(
  command: string,
  args: string[],
  timeoutMs: number
): Promise<{ exitCode: number | null; stderr: string }> {
  const result = await safeRun(command, args, { timeoutMs });
  return { exitCode: result.exitCode, stderr: result.stderr };
}

async function commandExists(cmd: string): Promise<boolean> {
  const probeCmd = process.platform === "win32" ? "where" : "which";
  const result = await safeRun(probeCmd, [cmd], { timeoutMs: 5000 });
  return result.status === "PASS";
}

export async function upscaleViaRealesrganCli(
  inputPath: string,
  outputPath: string,
  scale: 2 | 4,
  timeoutMs: number
): Promise<{ ok: boolean; error?: string }> {
  const cmds = ["realesrgan-ncnn-vulkan", "realesrgan-ncnn-vulkan.exe"];
  let bin: string | null = null;
  for (const c of cmds) {
    if (await commandExists(c)) {
      bin = c;
      break;
    }
  }
  if (!bin) return { ok: false, error: "realesrgan-ncnn-vulkan not found on PATH" };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const model = scale >= 4 ? "realesrgan-x4plus" : "realesrgan-x4plus";
  const result = await runCli(
    bin,
    ["-i", inputPath, "-o", outputPath, "-s", String(scale), "-n", model],
    timeoutMs
  );
  if (result.exitCode === 0 && fs.existsSync(outputPath)) return { ok: true };
  return { ok: false, error: result.stderr || "realesrgan CLI failed" };
}

export async function upscaleViaWaifu2xCli(
  inputPath: string,
  outputPath: string,
  scale: 2,
  timeoutMs: number
): Promise<{ ok: boolean; error?: string }> {
  const cmds = ["waifu2x-ncnn-vulkan", "waifu2x-ncnn-vulkan.exe"];
  let bin: string | null = null;
  for (const c of cmds) {
    if (await commandExists(c)) {
      bin = c;
      break;
    }
  }
  if (!bin) return { ok: false, error: "waifu2x-ncnn-vulkan not found on PATH" };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const result = await runCli(
    bin,
    ["-i", inputPath, "-o", outputPath, "-s", String(scale), "-n", "noise3_scale2x"],
    timeoutMs
  );
  if (result.exitCode === 0 && fs.existsSync(outputPath)) return { ok: true };
  return { ok: false, error: result.stderr || "waifu2x CLI failed" };
}

function imageToDataUri(inputPath: string): string {
  const ext = path.extname(inputPath).slice(1).toLowerCase() || "png";
  const mime =
    ext === "jpg" || ext === "jpeg"
      ? "image/jpeg"
      : ext === "webp"
        ? "image/webp"
        : "image/png";
  const b64 = fs.readFileSync(inputPath).toString("base64");
  return `data:${mime};base64,${b64}`;
}

async function pollReplicatePrediction(
  predictionUrl: string,
  token: string,
  timeoutMs: number
): Promise<{ ok: boolean; outputUrl?: string; error?: string }> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await fetch(predictionUrl, {
      headers: { Authorization: `Token ${token}` },
    });
    if (!res.ok) {
      return { ok: false, error: `Replicate poll HTTP ${res.status}` };
    }
    const data = (await res.json()) as {
      status: string;
      output?: string | string[];
      error?: string;
    };
    if (data.status === "succeeded") {
      const out = Array.isArray(data.output) ? data.output[0] : data.output;
      if (typeof out === "string") return { ok: true, outputUrl: out };
      return { ok: false, error: "Replicate returned no output URL" };
    }
    if (data.status === "failed" || data.status === "canceled") {
      return { ok: false, error: data.error ?? `Replicate status ${data.status}` };
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return { ok: false, error: "Replicate prediction timed out" };
}

export async function upscaleViaReplicateApi(
  inputPath: string,
  outputPath: string,
  scale: 2 | 4,
  token: string,
  timeoutMs: number
): Promise<{ ok: boolean; error?: string }> {
  const dataUri = imageToDataUri(inputPath);
  const createRes = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      Authorization: `Token ${token}`,
      "Content-Type": "application/json",
      Prefer: "wait",
    },
    body: JSON.stringify({
      version: REPLICATE_ESRGAN_VERSION,
      input: {
        image: dataUri,
        scale,
        face_enhance: false,
      },
    }),
  });

  if (!createRes.ok) {
    const text = await createRes.text();
    return { ok: false, error: `Replicate create HTTP ${createRes.status}: ${text.slice(0, 400)}` };
  }

  const prediction = (await createRes.json()) as {
    id: string;
    status: string;
    output?: string | string[];
    urls?: { get: string };
    error?: string;
  };

  let outputUrl: string | undefined;
  if (prediction.status === "succeeded") {
    outputUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
  } else if (prediction.urls?.get) {
    const polled = await pollReplicatePrediction(prediction.urls.get, token, timeoutMs);
    if (!polled.ok) return polled;
    outputUrl = polled.outputUrl;
  } else {
    return { ok: false, error: prediction.error ?? `Replicate status ${prediction.status}` };
  }

  if (!outputUrl) return { ok: false, error: "No output URL from Replicate" };

  const imgRes = await fetch(outputUrl);
  if (!imgRes.ok) return { ok: false, error: `Failed to download result HTTP ${imgRes.status}` };
  const buffer = Buffer.from(await imgRes.arrayBuffer());
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, buffer);
  return { ok: true };
}
