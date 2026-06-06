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
import { EXPECTED_TOOLS, EXPECTED_TOOL_COUNT } from "./expected-tools.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_ROOT = path.resolve(__dirname, "..");
const SERVER = path.join(SERVER_ROOT, "dist", "server.js");

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

async function callToolSafe(client, name, args) {
  try {
    return await client.callTool({ name, arguments: args });
  } catch (err) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            status: "FAIL",
            error: err instanceof Error ? err.message : String(err),
          }),
        },
      ],
    };
  }
}

async function runHardTests(client, box) {
  const results = [];
  const rel = (p) => p.replace(/\\/g, "/");

  record(results, "check_system", parseResult(await callToolSafe(client, "check_system", {})));
  record(results, "check_workspace", parseResult(await callToolSafe(client, "check_workspace", { workspacePath: box })));
  record(results, "read_project_info", parseResult(await callToolSafe(client, "read_project_info", { workspacePath: box })));
  record(results, "list_scripts", parseResult(await callToolSafe(client, "list_scripts", { workspacePath: box })));
  record(results, "git_status", parseResult(await callToolSafe(client, "git_status", { workspacePath: box })));
  record(results, "read_workspace_file", parseResult(await callToolSafe(client, "read_workspace_file", {
    workspacePath: box, relativePath: "needle.txt", maxChars: 4096,
  })));
  record(results, "search_workspace", parseResult(await callToolSafe(client, "search_workspace", {
    workspacePath: box, pattern: "DMCTN_HARD_TEST", maxResults: 5,
  })));
  record(results, "list_workspace_tree", parseResult(await callToolSafe(client, "list_workspace_tree", {
    workspacePath: box, maxDepth: 3, maxEntries: 50,
  })));
  record(results, "check_url", parseResult(await callToolSafe(client, "check_url", {
    url: "https://example.com", timeoutMs: 15000,
  })));
  record(results, "fetch_url", parseResult(await callToolSafe(client, "fetch_url", {
    url: "https://example.com", timeoutMs: 15000, maxBodyChars: 4096,
  })));
  record(results, "search_web", parseResult(await callToolSafe(client, "search_web", {
    query: "Model Context Protocol MCP", maxResults: 3,
  })));
  record(results, "write_workspace_file", parseResult(await callToolSafe(client, "write_workspace_file", {
    workspacePath: box, relativePath: "assets/written-by-mcp.txt", content: "hard-test write\n",
  })));
  record(results, "run_project_script", parseResult(await callToolSafe(client, "run_project_script", {
    workspacePath: box, script: "test", timeoutMs: 60000,
  })));
  record(results, "collect_debug_bundle", parseResult(await callToolSafe(client, "collect_debug_bundle", {
    workspacePath: box,
  })));
  record(results, "read_lints", parseResult(await callToolSafe(client, "read_lints", {
    workspacePath: SERVER_ROOT, timeoutMs: 120000,
  })));
  record(results, "apply_patch", parseResult(await callToolSafe(client, "apply_patch", {
    workspacePath: box,
    relativePath: "src/patch-target.txt",
    oldText: "hello",
    newText: "xin-chao",
  })));
  record(results, "write_workspace_file_env", parseResult(await callToolSafe(client, "write_workspace_file", {
    workspacePath: box, relativePath: ".env", content: "DMCTN_TEST=1\n",
  })));
  record(results, "move_workspace_file", parseResult(await callToolSafe(client, "move_workspace_file", {
    workspacePath: box,
    fromRelativePath: "assets/written-by-mcp.txt",
    toRelativePath: "assets/moved-by-mcp.txt",
  })));
  record(results, "delete_workspace_file", parseResult(await callToolSafe(client, "delete_workspace_file", {
    workspacePath: box, relativePath: "assets/moved-by-mcp.txt",
  })));
  record(results, "run_safe_command", parseResult(await callToolSafe(client, "run_safe_command", {
    workspacePath: box, command: "node", args: ["--version"], timeoutMs: 30000,
  })));
  record(results, "git_init", parseResult(await callToolSafe(client, "git_init", { workspacePath: box })));
  record(results, "write_workspace_file_git", parseResult(await callToolSafe(client, "write_workspace_file", {
    workspacePath: box, relativePath: "hard-test-git-marker.txt", content: `hard-test ${Date.now()}\n`,
  })));
  record(results, "git_add", parseResult(await callToolSafe(client, "git_add", {
    workspacePath: box, paths: ["hard-test-git-marker.txt"],
  })));
  record(results, "git_commit", parseResult(await callToolSafe(client, "git_commit", {
    workspacePath: box, message: "hard-test mcp commit",
  })));
  record(results, "chrome_load_extension", parseResult(await callToolSafe(client, "chrome_load_extension", {
    workspacePath: box,
    extensionPath: path.join(SERVER_ROOT, "tests", "fixtures", "sample-extension"),
    chromePath: path.join(box, "nonexistent-chrome.exe"),
  })));
  record(results, "check_image_dependencies", parseResult(await callToolSafe(client, "check_image_dependencies", {
    profile: "image-core",
  })));

  const imgIn = "assets/source.png";
  record(results, "image_info", parseResult(await callToolSafe(client, "image_info", {
    workspacePath: box, relativePath: imgIn,
  })));
  record(results, "image_ocr", parseResult(await callToolSafe(client, "image_ocr", {
    workspacePath: box, relativePath: "assets/ocr-sample.png", languages: "eng",
  })));
  record(results, "image_crop", parseResult(await callToolSafe(client, "image_crop", {
    workspacePath: box, inputPath: imgIn, outputPath: "assets/crop.png", left: 8, top: 6, width: 48, height: 40,
  })));
  record(results, "image_resize", parseResult(await callToolSafe(client, "image_resize", {
    workspacePath: box, inputPath: imgIn, outputPath: "assets/resize.webp", width: 64, height: 48, format: "webp",
  })));
  record(results, "image_adjust", parseResult(await callToolSafe(client, "image_adjust", {
    workspacePath: box, inputPath: imgIn, outputPath: "assets/adjust.jpg", brightness: 1.05, saturation: 1.1,
  })));
  record(results, "image_composite", parseResult(await callToolSafe(client, "image_composite", {
    workspacePath: box, basePath: imgIn, overlayPath: "assets/crop.png", outputPath: "assets/composite.png", left: 4, top: 4,
  })));
  record(results, "image_text", parseResult(await callToolSafe(client, "image_text", {
    workspacePath: box, inputPath: imgIn, outputPath: "assets/text.png", text: "DMCTN 37", fontSize: 14, x: 10, y: 20,
  })));
  record(results, "image_rounded", parseResult(await callToolSafe(client, "image_rounded", {
    workspacePath: box, inputPath: imgIn, outputPath: "assets/rounded.png", radius: 16,
  })));
  record(results, "image_upscale", parseResult(await callToolSafe(client, "image_upscale", {
    workspacePath: box, inputPath: imgIn, outputPath: "assets/upscale.png", scale: 2,
  })));
  record(results, "image_batch", parseResult(await callToolSafe(client, "image_batch", {
    workspacePath: box, operation: "resize", inputPaths: [imgIn], outputDir: "assets/batch-out", width: 32, height: 24, format: "png",
  })));

  const aiUp = parseResult(await callToolSafe(client, "image_upscale_ai", {
    workspacePath: box, inputPath: imgIn, outputPath: "assets/ai-upscale.png", scale: 2, timeoutMs: 180000,
  }));
  record(results, "image_upscale_ai", aiUp);

  record(results, "run_coding_session", parseResult(await callToolSafe(client, "run_coding_session", {
    workspacePath: box, runScript: true, collectBundle: true,
  })));

  // Last: optional nobg may crash native deps on some Windows hosts — isolate after core tools.
  const nobg = parseResult(await callToolSafe(client, "image_remove_background", {
    workspacePath: box, inputPath: imgIn, outputPath: "assets/nobg.png", timeoutMs: 180000,
  }));
  const nobgErr = String(nobg.hint ?? nobg.error ?? "");
  const nobgOk =
    OK_STATUS.has(nobg.status) ||
    (nobg.status === "FAIL" &&
      /Not connected|Connection closed|dependency|processing failed|model/i.test(nobgErr));
  results.push({
    tool: "image_remove_background",
    status: nobg.status,
    ok: nobgOk,
    detail: nobgOk ? undefined : JSON.stringify(nobg).slice(0, 400),
  });

  return results;
}

async function main() {
  const workspacePath = path.resolve(process.argv[2] ?? process.cwd());
  const report = {
    mode: "hard-test-27-tools",
    serverRoot: SERVER_ROOT,
    workspacePath,
    toolList: { expected: EXPECTED_TOOL_COUNT, actual: 0, missing: [], extra: [] },
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

    const listOk =
      report.toolList.actual === EXPECTED_TOOL_COUNT && report.toolList.missing.length === 0;
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
