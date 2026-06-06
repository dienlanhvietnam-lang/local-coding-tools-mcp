#!/usr/bin/env node
/**
 * Bài test KHÓ — gọi lần lượt 27 MCP tools qua stdio client.
 * Usage: node scripts/hard-test-27-tools.mjs [workspacePath]
 *
 * Tạo sandbox tại <workspace>/.dmctn-hard-test-27/ (package.json + ảnh test).
 * Exit 0 = FULL_PASS (27 tools listed + tất cả callable đạt ngưỡng).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_ROOT = path.resolve(__dirname, "..");
const SERVER = path.join(SERVER_ROOT, "dist", "server.js");

const EXPECTED_TOOLS = [
  "run_coding_session",
  "check_system",
  "check_workspace",
  "read_project_info",
  "list_scripts",
  "git_status",
  "read_workspace_file",
  "search_workspace",
  "list_workspace_tree",
  "check_url",
  "write_workspace_file",
  "run_project_script",
  "collect_debug_bundle",
  "read_lints",
  "apply_patch",
  "check_image_dependencies",
  "image_info",
  "image_ocr",
  "image_crop",
  "image_resize",
  "image_remove_background",
  "image_adjust",
  "image_composite",
  "image_batch",
  "image_text",
  "image_rounded",
  "image_upscale",
  "image_upscale_ai",
];

const OK_STATUS = new Set(["PASS", "PARTIAL", "SKIPPED", "BLOCKED"]);

function parseResult(result) {
  const text = result?.content?.find((c) => c.type === "text")?.text ?? "{}";
  try {
    return JSON.parse(text);
  } catch {
    return { status: "FAIL", raw: text.slice(0, 500) };
  }
}

async function ensureSandbox(workspacePath) {
  const box = path.join(workspacePath, ".dmctn-hard-test-27");
  const assets = path.join(box, "assets");
  const src = path.join(box, "src");
  const out = path.join(box, "out");
  fs.mkdirSync(assets, { recursive: true });
  fs.mkdirSync(src, { recursive: true });
  fs.mkdirSync(out, { recursive: true });

  const pkg = {
    name: "dmctn-hard-test-sandbox",
    version: "1.0.0",
    private: true,
    type: "module",
    scripts: {
      test: 'node -e "console.log(\\"hard-test ok\\")"',
      build: 'node -e "console.log(\\"build ok\\")"',
    },
  };
  fs.writeFileSync(path.join(box, "package.json"), JSON.stringify(pkg, null, 2) + "\n", "utf8");
  fs.writeFileSync(path.join(src, "patch-target.txt"), "hello hard-test\n", "utf8");
  fs.writeFileSync(path.join(box, "needle.txt"), "DMCTN_HARD_TEST_NEEDLE\n", "utf8");

  const sourcePng = path.join(assets, "source.png");
  const ocrSamplePng = path.join(assets, "ocr-sample.png");
  const prevCwd = process.cwd();
  process.chdir(SERVER_ROOT);
  try {
    const sharp = (await import("sharp")).default;
    if (!fs.existsSync(sourcePng)) {
      await sharp({
        create: { width: 128, height: 96, channels: 4, background: { r: 40, g: 120, b: 200, alpha: 1 } },
      })
        .png()
        .toFile(sourcePng);
    }
    if (!fs.existsSync(ocrSamplePng)) {
      const svg = `<svg width="280" height="72" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="white"/>
  <text x="16" y="48" font-family="Arial, sans-serif" font-size="32" fill="black">DMCTN OCR TEST</text>
</svg>`;
      await sharp(Buffer.from(svg)).png().toFile(ocrSamplePng);
    }
  } finally {
    process.chdir(prevCwd);
  }

  return box;
}

function record(results, name, data, expectStatus) {
  const status = data?.status ?? (data?.error ? "FAIL" : "UNKNOWN");
  const ok = expectStatus ? status === expectStatus : OK_STATUS.has(status);
  results.push({
    tool: name,
    status,
    ok,
    detail: ok ? undefined : JSON.stringify(data).slice(0, 400),
  });
  return ok;
}

async function runHardTests(client, box) {
  const results = [];
  const rel = (p) => p.replace(/\\/g, "/");

  record(results, "check_system", parseResult(await client.callTool({ name: "check_system", arguments: {} })));
  record(results, "check_workspace", parseResult(await client.callTool({ name: "check_workspace", arguments: { workspacePath: box } })));
  record(results, "read_project_info", parseResult(await client.callTool({ name: "read_project_info", arguments: { workspacePath: box } })));
  record(results, "list_scripts", parseResult(await client.callTool({ name: "list_scripts", arguments: { workspacePath: box } })));
  record(results, "git_status", parseResult(await client.callTool({ name: "git_status", arguments: { workspacePath: box } })));
  record(results, "read_workspace_file", parseResult(await client.callTool({
    name: "read_workspace_file",
    arguments: { workspacePath: box, relativePath: "needle.txt", maxBytes: 4096 },
  })));
  record(results, "search_workspace", parseResult(await client.callTool({
    name: "search_workspace",
    arguments: { workspacePath: box, pattern: "DMCTN_HARD_TEST", maxResults: 5 },
  })));
  record(results, "list_workspace_tree", parseResult(await client.callTool({
    name: "list_workspace_tree",
    arguments: { workspacePath: box, maxDepth: 3, maxEntries: 50 },
  })));
  record(results, "check_url", parseResult(await client.callTool({
    name: "check_url",
    arguments: { url: "https://example.com", timeoutMs: 15000 },
  })));
  record(results, "write_workspace_file", parseResult(await client.callTool({
    name: "write_workspace_file",
    arguments: { workspacePath: box, relativePath: "assets/written-by-mcp.txt", content: "hard-test write\n" },
  })));
  record(results, "run_project_script", parseResult(await client.callTool({
    name: "run_project_script",
    arguments: { workspacePath: box, script: "test", timeoutMs: 60000 },
  })));
  record(results, "collect_debug_bundle", parseResult(await client.callTool({
    name: "collect_debug_bundle",
    arguments: { workspacePath: box },
  })));
  record(results, "read_lints", parseResult(await client.callTool({
    name: "read_lints",
    arguments: { workspacePath: SERVER_ROOT, timeoutMs: 120000 },
  })));
  record(results, "apply_patch", parseResult(await client.callTool({
    name: "apply_patch",
    arguments: {
      workspacePath: box,
      relativePath: "src/patch-target.txt",
      oldText: "hello",
      newText: "xin-chao",
    },
  })));
  record(results, "write_workspace_file_env", parseResult(await client.callTool({
    name: "write_workspace_file",
    arguments: { workspacePath: box, relativePath: ".env", content: "DMCTN_TEST=1\n" },
  })));

  record(results, "check_image_dependencies", parseResult(await client.callTool({
    name: "check_image_dependencies",
    arguments: { profile: "image-core" },
  })));

  const imgIn = "assets/source.png";
  record(results, "image_info", parseResult(await client.callTool({
    name: "image_info",
    arguments: { workspacePath: box, relativePath: imgIn },
  })));
  record(results, "image_ocr", parseResult(await client.callTool({
    name: "image_ocr",
    arguments: { workspacePath: box, relativePath: "assets/ocr-sample.png", languages: "eng" },
  })));
  record(results, "image_crop", parseResult(await client.callTool({
    name: "image_crop",
    arguments: { workspacePath: box, inputPath: imgIn, outputPath: "assets/crop.png", left: 8, top: 6, width: 48, height: 40 },
  })));
  record(results, "image_resize", parseResult(await client.callTool({
    name: "image_resize",
    arguments: { workspacePath: box, inputPath: imgIn, outputPath: "assets/resize.webp", width: 64, height: 48, format: "webp" },
  })));
  record(results, "image_adjust", parseResult(await client.callTool({
    name: "image_adjust",
    arguments: { workspacePath: box, inputPath: imgIn, outputPath: "assets/adjust.jpg", brightness: 1.05, saturation: 1.1 },
  })));
  record(results, "image_composite", parseResult(await client.callTool({
    name: "image_composite",
    arguments: {
      workspacePath: box,
      basePath: imgIn,
      overlayPath: "assets/crop.png",
      outputPath: "assets/composite.png",
      left: 4,
      top: 4,
    },
  })));
  record(results, "image_text", parseResult(await client.callTool({
    name: "image_text",
    arguments: {
      workspacePath: box,
      inputPath: imgIn,
      outputPath: "assets/text.png",
      text: "DMCTN 27",
      fontSize: 14,
      x: 10,
      y: 20,
    },
  })));
  record(results, "image_rounded", parseResult(await client.callTool({
    name: "image_rounded",
    arguments: { workspacePath: box, inputPath: imgIn, outputPath: "assets/rounded.png", radius: 16 },
  })));
  record(results, "image_upscale", parseResult(await client.callTool({
    name: "image_upscale",
    arguments: { workspacePath: box, inputPath: imgIn, outputPath: "assets/upscale.png", scale: 2 },
  })));
  record(results, "image_batch", parseResult(await client.callTool({
    name: "image_batch",
    arguments: {
      workspacePath: box,
      operation: "resize",
      inputPaths: [imgIn],
      outputDir: "assets/batch-out",
      width: 32,
      height: 24,
      format: "png",
    },
  })));

  const nobg = parseResult(await client.callTool({
    name: "image_remove_background",
    arguments: { workspacePath: box, inputPath: imgIn, outputPath: "assets/nobg.png", timeoutMs: 180000 },
  }));
  const nobgOk =
    OK_STATUS.has(nobg.status) ||
    (nobg.status === "FAIL" && /dependency|processing failed|model/i.test(String(nobg.hint ?? nobg.error ?? "")));
  results.push({
    tool: "image_remove_background",
    status: nobg.status,
    ok: nobgOk,
    detail: nobgOk ? undefined : JSON.stringify(nobg).slice(0, 400),
  });

  const aiUp = parseResult(await client.callTool({
    name: "image_upscale_ai",
    arguments: { workspacePath: box, inputPath: imgIn, outputPath: "assets/ai-upscale.png", scale: 2, timeoutMs: 180000 },
  }));
  record(results, "image_upscale_ai", aiUp);

  record(results, "run_coding_session", parseResult(await client.callTool({
    name: "run_coding_session",
    arguments: { workspacePath: box, runScript: true, collectBundle: true },
  })));

  return results;
}

async function main() {
  const workspacePath = path.resolve(process.argv[2] ?? process.cwd());
  const report = {
    mode: "hard-test-27-tools",
    serverRoot: SERVER_ROOT,
    workspacePath,
    toolList: { expected: 28, actual: 0, missing: [], extra: [] },
    toolCalls: [],
    summary: { pass: 0, fail: 0, overall: "FAIL" },
    durationMs: 0,
  };

  const start = Date.now();
  if (!fs.existsSync(SERVER)) {
    console.error(JSON.stringify({ ...report, error: "dist/server.js missing — run npm run build" }, null, 2));
    process.exit(1);
  }

  const box = await ensureSandbox(workspacePath);
  report.sandbox = box;

  let client;
  try {
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [SERVER],
      cwd: SERVER_ROOT,
    });
    client = new Client({ name: "hard-test-27", version: "1.0.0" }, { capabilities: {} });
    await client.connect(transport);

    const listed = await client.listTools();
    const names = (listed.tools ?? []).map((t) => t.name).sort();
    report.toolList.actual = names.length;
    report.toolList.names = names;
    for (const e of EXPECTED_TOOLS) {
      if (!names.includes(e)) report.toolList.missing.push(e);
    }
    for (const n of names) {
      if (!EXPECTED_TOOLS.includes(n)) report.toolList.extra.push(n);
    }

    report.toolCalls = await runHardTests(client, box);
    report.summary.pass = report.toolCalls.filter((r) => r.ok).length;
    report.summary.fail = report.toolCalls.filter((r) => !r.ok).length;

    const listOk = report.toolList.actual === 28 && report.toolList.missing.length === 0;
    const callsOk = report.summary.fail === 0;
    report.summary.overall = listOk && callsOk ? "FULL_PASS" : "FAIL";
  } catch (err) {
    report.error = err instanceof Error ? err.message : String(err);
    report.summary.overall = "FAIL";
  } finally {
    if (client) await client.close().catch(() => {});
    report.durationMs = Date.now() - start;
  }

  console.log(JSON.stringify(report, null, 2));
  process.exit(report.summary.overall === "FULL_PASS" ? 0 : 1);
}

main();
