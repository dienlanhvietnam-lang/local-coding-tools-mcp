import path from "node:path";
import fs from "node:fs";
import { assertWithinWorkspace, validateWorkspacePath } from "../safety/pathGuard.js";
import { pass, fail, skipped } from "../utils/result.js";

export interface GenerateImageInput {
  workspacePath: string;
  prompt: string;
  outputPath: string;
  provider?: "openai" | "replicate" | "auto";
  size?: string;
  timeoutMs?: number;
}

export interface GenerateImageOutput {
  status: "PASS" | "FAIL" | "SKIPPED";
  workspacePath?: string;
  prompt?: string;
  outputPath?: string;
  provider?: string;
  bytes?: number;
  error?: string;
  reason?: string;
}

export async function generateImage(input: GenerateImageInput): Promise<GenerateImageOutput> {
  const validation = validateWorkspacePath(input.workspacePath);
  if (!validation.ok) {
    return fail(validation.error ?? "Invalid workspace");
  }
  const workspacePath = validation.resolvedPath!;
  const prompt = input.prompt?.trim();
  if (!prompt) return fail("prompt is required", { workspacePath });

  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  const replicateToken = process.env.REPLICATE_API_TOKEN?.trim();
  const provider = input.provider ?? "auto";

  const useOpenai = (provider === "openai" || provider === "auto") && openaiKey;
  const useReplicate = (provider === "replicate" || (provider === "auto" && !openaiKey)) && replicateToken;

  if (!useOpenai && !useReplicate) {
    return skipped("no_api_key", {
      workspacePath,
      reason: "Set OPENAI_API_KEY or REPLICATE_API_TOKEN to generate images",
    });
  }

  let outputFull: string;
  try {
    outputFull = assertWithinWorkspace(workspacePath, input.outputPath.replace(/\\/g, "/"));
  } catch (err) {
    return fail(err instanceof Error ? err.message : String(err), { workspacePath });
  }

  const timeoutMs = input.timeoutMs ?? 120_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    if (useOpenai) {
      const resp = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-image-1",
          prompt,
          size: input.size ?? "1024x1024",
          n: 1,
        }),
      });
      if (!resp.ok) {
        return fail(`OpenAI API HTTP ${resp.status}: ${(await resp.text()).slice(0, 300)}`, {
          workspacePath,
          provider: "openai",
        });
      }
      const data = (await resp.json()) as { data?: Array<{ b64_json?: string; url?: string }> };
      const b64 = data.data?.[0]?.b64_json;
      if (!b64) {
        const url = data.data?.[0]?.url;
        if (!url) return fail("OpenAI returned no image", { workspacePath, provider: "openai" });
        const imgResp = await fetch(url, { signal: controller.signal });
        const buf = Buffer.from(await imgResp.arrayBuffer());
        fs.mkdirSync(path.dirname(outputFull), { recursive: true });
        fs.writeFileSync(outputFull, buf);
        return pass({ workspacePath, prompt, outputPath: input.outputPath, provider: "openai", bytes: buf.length });
      }
      const buf = Buffer.from(b64, "base64");
      fs.mkdirSync(path.dirname(outputFull), { recursive: true });
      fs.writeFileSync(outputFull, buf);
      return pass({ workspacePath, prompt, outputPath: input.outputPath, provider: "openai", bytes: buf.length });
    }

    // Replicate
    const resp = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${replicateToken}`,
        Prefer: "wait",
      },
      body: JSON.stringify({
        version: "black-forest-labs/flux-schnell",
        input: { prompt },
      }),
    });
    if (!resp.ok) {
      return fail(`Replicate API HTTP ${resp.status}: ${(await resp.text()).slice(0, 300)}`, {
        workspacePath,
        provider: "replicate",
      });
    }
    const data = (await resp.json()) as { output?: string | string[] };
    const imgUrl = Array.isArray(data.output) ? data.output[0] : data.output;
    if (!imgUrl) return fail("Replicate returned no image URL", { workspacePath, provider: "replicate" });
    const imgResp = await fetch(imgUrl, { signal: controller.signal });
    const buf = Buffer.from(await imgResp.arrayBuffer());
    fs.mkdirSync(path.dirname(outputFull), { recursive: true });
    fs.writeFileSync(outputFull, buf);
    return pass({ workspacePath, prompt, outputPath: input.outputPath, provider: "replicate", bytes: buf.length });
  } catch (err) {
    return fail(err instanceof Error ? err.message : String(err), { workspacePath, provider });
  } finally {
    clearTimeout(timer);
  }
}
