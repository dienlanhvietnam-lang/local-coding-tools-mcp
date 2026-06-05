#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { SERVER_NAME, SERVER_VERSION } from "./config.js";
import { withToolLogging } from "./logger.js";
import { READ_ONLY, WRITE, EXECUTE, NETWORK, BATCH, IMAGE_READ, IMAGE_WRITE, IMAGE_NETWORK } from "./toolMeta.js";
import { checkSystem } from "./tools/checkSystem.js";
import { checkWorkspace } from "./tools/checkWorkspace.js";
import { readProjectInfo } from "./tools/readProjectInfo.js";
import { listScripts } from "./tools/listScripts.js";
import { runProjectScript } from "./tools/runProjectScript.js";
import { gitStatus } from "./tools/gitStatus.js";
import { checkUrl } from "./tools/checkUrl.js";
import { collectDebugBundle } from "./tools/collectDebugBundle.js";
import { readWorkspaceFile } from "./tools/readWorkspaceFile.js";
import { writeWorkspaceFile } from "./tools/writeWorkspaceFile.js";
import { searchWorkspace } from "./tools/searchWorkspace.js";
import { listWorkspaceTree } from "./tools/listWorkspaceTree.js";
import { runCodingSession } from "./tools/runCodingSession.js";
import { readLints } from "./tools/readLints.js";
import { applyPatch } from "./tools/applyPatch.js";
import { imageInfo } from "./tools/imageInfo.js";
import { imageCrop } from "./tools/imageCrop.js";
import { imageResize } from "./tools/imageResize.js";
import { imageRemoveBackground } from "./tools/imageRemoveBackground.js";
import { imageAdjust } from "./tools/imageAdjust.js";
import { imageComposite } from "./tools/imageComposite.js";
import { imageBatch } from "./tools/imageBatch.js";
import { imageText } from "./tools/imageText.js";
import { imageRounded } from "./tools/imageRounded.js";
import { imageUpscale } from "./tools/imageUpscale.js";
import { imageUpscaleAi } from "./tools/imageUpscaleAi.js";
import { checkImageDependencies } from "./tools/checkImageDependencies.js";

function jsonText(data: unknown): { content: Array<{ type: "text"; text: string }> } {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
}

const workspacePathSchema = z
  .string()
  .describe("Absolute path to the project workspace");

const server = new McpServer({
  name: SERVER_NAME,
  version: SERVER_VERSION,
});

// ── Batch workflow (1 approval thay vì 7) ──────────────────────────────────

server.tool(
  "run_coding_session",
  "Run full coding workflow in one call: check_system, check_workspace, read_project_info, list_scripts, optional build/test script, git_status, collect_debug_bundle. Prefer this to avoid repeated MCP approval prompts.",
  {
    workspacePath: workspacePathSchema,
    runScript: z.boolean().optional().describe("Run build or test script if present (default true)"),
    collectBundle: z.boolean().optional().describe("Collect debug bundle (default true)"),
  },
  BATCH,
  async ({ workspacePath, runScript, collectBundle }) =>
    jsonText(
      await withToolLogging("run_coding_session", { workspacePath, riskLevel: "low" }, () =>
        runCodingSession({ workspacePath, runScript, collectBundle })
      )
    )
);

// ── Read-only inspection ───────────────────────────────────────────────────

server.tool(
  "check_system",
  "Check availability of Node.js, npm, pnpm, git (and optionally winget). Does not fail entirely if one tool is missing.",
  { includeWinget: z.boolean().optional().describe("Also check winget availability") },
  READ_ONLY,
  async ({ includeWinget }) =>
    jsonText(
      await withToolLogging("check_system", { riskLevel: "low" }, () =>
        checkSystem({ includeWinget })
      )
    )
);

server.tool(
  "check_workspace",
  "Verify that a workspace path exists, is readable, and is not a restricted system path.",
  { workspacePath: workspacePathSchema },
  READ_ONLY,
  async ({ workspacePath }) =>
    jsonText(
      await withToolLogging("check_workspace", { workspacePath, riskLevel: "low" }, () =>
        checkWorkspace({ workspacePath })
      )
    )
);

server.tool(
  "read_project_info",
  "Read package.json, detect frameworks, summarize .env keys (values redacted — secrets never exposed).",
  { workspacePath: workspacePathSchema },
  READ_ONLY,
  async ({ workspacePath }) =>
    jsonText(
      await withToolLogging("read_project_info", { workspacePath, riskLevel: "low" }, () =>
        readProjectInfo({ workspacePath })
      )
    )
);

server.tool(
  "list_scripts",
  "List npm/pnpm scripts defined in package.json (read-only, does not execute).",
  { workspacePath: workspacePathSchema },
  READ_ONLY,
  async ({ workspacePath }) =>
    jsonText(
      await withToolLogging("list_scripts", { workspacePath, riskLevel: "low" }, () =>
        listScripts({ workspacePath })
      )
    )
);

server.tool(
  "git_status",
  "Run git status --short --branch in the workspace (read-only, no commit/push/checkout).",
  { workspacePath: workspacePathSchema },
  READ_ONLY,
  async ({ workspacePath }) =>
    jsonText(
      await withToolLogging("git_status", { workspacePath, riskLevel: "low" }, () =>
        gitStatus({ workspacePath })
      )
    )
);

server.tool(
  "read_workspace_file",
  "Read a text file inside the workspace. .env values are redacted. Path must stay within workspace.",
  {
    workspacePath: workspacePathSchema,
    relativePath: z.string().describe("Path relative to workspace root"),
    maxChars: z.number().optional().describe("Max characters to return"),
  },
  READ_ONLY,
  async ({ workspacePath, relativePath, maxChars }) =>
    jsonText(
      await withToolLogging("read_workspace_file", { workspacePath, riskLevel: "low" }, () =>
        readWorkspaceFile({ workspacePath, relativePath, maxChars })
      )
    )
);

server.tool(
  "search_workspace",
  "Search file contents in workspace using regex. Skips node_modules/.git. Output is redacted.",
  {
    workspacePath: workspacePathSchema,
    pattern: z.string().describe("Regex pattern to search"),
    relativeDir: z.string().optional().describe("Subdirectory to search (default .)"),
    maxResults: z.number().optional().describe("Max matches (default 50)"),
    fileGlob: z.string().optional().describe("Filter filenames e.g. *.ts"),
  },
  READ_ONLY,
  async ({ workspacePath, pattern, relativeDir, maxResults, fileGlob }) =>
    jsonText(
      await withToolLogging("search_workspace", { workspacePath, riskLevel: "low" }, () =>
        searchWorkspace({ workspacePath, pattern, relativeDir, maxResults, fileGlob })
      )
    )
);

server.tool(
  "list_workspace_tree",
  "List files and directories in workspace tree (skips node_modules/.git). Read-only.",
  {
    workspacePath: workspacePathSchema,
    relativeDir: z.string().optional().describe("Start directory (default .)"),
    maxDepth: z.number().optional().describe("Max depth (default 4)"),
    maxEntries: z.number().optional().describe("Max entries (default 200)"),
  },
  READ_ONLY,
  async ({ workspacePath, relativeDir, maxDepth, maxEntries }) =>
    jsonText(
      await withToolLogging("list_workspace_tree", { workspacePath, riskLevel: "low" }, () =>
        listWorkspaceTree({ workspacePath, relativeDir, maxDepth, maxEntries })
      )
    )
);

server.tool(
  "check_url",
  "Send GET request to a URL with timeout. Limited redirects. Returns status code and response time.",
  {
    url: z.string().describe("HTTP or HTTPS URL to check"),
    timeoutMs: z.number().optional().describe("Timeout in ms (default 10000)"),
  },
  NETWORK,
  async ({ url, timeoutMs }) =>
    jsonText(
      await withToolLogging("check_url", { riskLevel: "low" }, () =>
        checkUrl({ url, timeoutMs })
      )
    )
);

// ── Write / execute (still guarded) ────────────────────────────────────────

server.tool(
  "write_workspace_file",
  "Write or create a file inside workspace. Blocks .env, credentials, keys. Path must stay within workspace.",
  {
    workspacePath: workspacePathSchema,
    relativePath: z.string().describe("Path relative to workspace root"),
    content: z.string().describe("File content to write"),
    createDirs: z.boolean().optional().describe("Create parent dirs (default true)"),
  },
  WRITE,
  async ({ workspacePath, relativePath, content, createDirs }) =>
    jsonText(
      await withToolLogging("write_workspace_file", { workspacePath, riskLevel: "medium" }, () =>
        writeWorkspaceFile({ workspacePath, relativePath, content, createDirs })
      )
    )
);

server.tool(
  "run_project_script",
  "Run a script that exists in package.json only. Blocks dangerous patterns. Output is redacted and truncated.",
  {
    workspacePath: workspacePathSchema,
    script: z.string().describe("Script name from package.json scripts section"),
    projectSubdir: z.string().optional().describe("Optional subdirectory containing package.json (monorepo support)"),
    timeoutMs: z.number().optional().describe("Timeout in ms (default 120000)"),
  },
  EXECUTE,
  async ({ workspacePath, script, projectSubdir, timeoutMs }) =>
    jsonText(
      await withToolLogging("run_project_script", { workspacePath, riskLevel: "medium" }, () =>
        runProjectScript({ workspacePath, script, projectSubdir, timeoutMs })
      )
    )
);

server.tool(
  "collect_debug_bundle",
  "Collect safe debug info into .mcp-debug/ in workspace. Excludes .env, credentials, and tokens.",
  { workspacePath: workspacePathSchema },
  { ...EXECUTE, idempotentHint: true },
  async ({ workspacePath }) =>
    jsonText(
      await withToolLogging("collect_debug_bundle", { workspacePath, riskLevel: "medium" }, () =>
        collectDebugBundle({ workspacePath })
      )
    )
);

server.tool(
  "read_lints",
  "Run TypeScript (tsc --noEmit) and/or ESLint diagnostics for the workspace or monorepo subdir. Read-only.",
  {
    workspacePath: workspacePathSchema,
    projectSubdir: z.string().optional().describe("Monorepo package subdirectory"),
    timeoutMs: z.number().optional().describe("Timeout ms (default 60000)"),
  },
  READ_ONLY,
  async ({ workspacePath, projectSubdir, timeoutMs }) =>
    jsonText(
      await withToolLogging("read_lints", { workspacePath, riskLevel: "low" }, () =>
        readLints({ workspacePath, projectSubdir, timeoutMs })
      )
    )
);

server.tool(
  "apply_patch",
  "Apply a search-and-replace patch to a workspace file. Respects write allowlist and blocks sensitive paths.",
  {
    workspacePath: workspacePathSchema,
    relativePath: z.string().describe("File path relative to workspace"),
    oldText: z.string().describe("Exact text to find"),
    newText: z.string().describe("Replacement text"),
    replaceAll: z.boolean().optional().describe("Replace all occurrences (default: first unique match)"),
  },
  WRITE,
  async ({ workspacePath, relativePath, oldText, newText, replaceAll }) =>
    jsonText(
      await withToolLogging("apply_patch", { workspacePath, riskLevel: "medium" }, () =>
        applyPatch({ workspacePath, relativePath, oldText, newText, replaceAll })
      )
    )
);

// ── Image tools (sharp + optional rembg / remove.bg) ───────────────────────

server.tool(
  "check_image_dependencies",
  "Check image toolchain: sharp (core), rembg/imgly/remove.bg API, Real-ESRGAN CLI, Replicate token. Returns PASS/PARTIAL/FAIL without exposing secrets.",
  {},
  READ_ONLY,
  async () =>
    jsonText(
      await withToolLogging("check_image_dependencies", { riskLevel: "low" }, () =>
        checkImageDependencies()
      )
    )
);

server.tool(
  "image_info",
  "Read image metadata (width, height, format, alpha) from a file in the workspace.",
  {
    workspacePath: workspacePathSchema,
    relativePath: z.string().describe("Image path relative to workspace"),
  },
  IMAGE_READ,
  async ({ workspacePath, relativePath }) =>
    jsonText(
      await withToolLogging("image_info", { workspacePath, riskLevel: "low" }, () =>
        imageInfo({ workspacePath, relativePath })
      )
    )
);

server.tool(
  "image_crop",
  "Crop an image by pixel region. Output must be in an allowed write path (e.g. assets/).",
  {
    workspacePath: workspacePathSchema,
    inputPath: z.string().describe("Source image relative path"),
    outputPath: z.string().describe("Output image relative path"),
    left: z.number().describe("Left offset in pixels"),
    top: z.number().describe("Top offset in pixels"),
    width: z.number().describe("Crop width in pixels"),
    height: z.number().describe("Crop height in pixels"),
  },
  IMAGE_WRITE,
  async ({ workspacePath, inputPath, outputPath, left, top, width, height }) =>
    jsonText(
      await withToolLogging("image_crop", { workspacePath, riskLevel: "medium" }, () =>
        imageCrop({ workspacePath, inputPath, outputPath, left, top, width, height })
      )
    )
);

server.tool(
  "image_resize",
  "Resize and optionally convert image format (png/jpeg/webp/avif).",
  {
    workspacePath: workspacePathSchema,
    inputPath: z.string().describe("Source image relative path"),
    outputPath: z.string().describe("Output image relative path"),
    width: z.number().optional().describe("Target width (px)"),
    height: z.number().optional().describe("Target height (px)"),
    format: z.enum(["png", "jpeg", "webp", "avif"]).optional().describe("Output format"),
    quality: z.number().optional().describe("Quality 1-100 for jpeg/webp/avif"),
    fit: z
      .enum(["cover", "contain", "fill", "inside", "outside"])
      .optional()
      .describe("Resize fit mode (default inside)"),
  },
  IMAGE_WRITE,
  async ({ workspacePath, inputPath, outputPath, width, height, format, quality, fit }) =>
    jsonText(
      await withToolLogging("image_resize", { workspacePath, riskLevel: "medium" }, () =>
        imageResize({ workspacePath, inputPath, outputPath, width, height, format, quality, fit })
      )
    )
);

server.tool(
  "image_remove_background",
  "Remove background: @imgly/background-removal-node (local), rembg CLI, or remove.bg API. Output .png/.webp.",
  {
    workspacePath: workspacePathSchema,
    inputPath: z.string().describe("Source image relative path"),
    outputPath: z.string().describe("Output .png or .webp path"),
    mode: z.enum(["auto", "node", "api", "cli"]).optional().describe("auto=node→cli→api"),
    apiKey: z.string().optional().describe("remove.bg API key (or env REMOVE_BG_API_KEY)"),
    timeoutMs: z.number().optional().describe("Timeout ms (default 120000)"),
  },
  IMAGE_NETWORK,
  async ({ workspacePath, inputPath, outputPath, mode, apiKey, timeoutMs }) =>
    jsonText(
      await withToolLogging("image_remove_background", { workspacePath, riskLevel: "high" }, () =>
        imageRemoveBackground({ workspacePath, inputPath, outputPath, mode, apiKey, timeoutMs })
      )
    )
);

server.tool(
  "image_adjust",
  "Adjust image: brightness, saturation, hue, sharpen, greyscale, rotate, flip.",
  {
    workspacePath: workspacePathSchema,
    inputPath: z.string(),
    outputPath: z.string(),
    brightness: z.number().optional().describe("0.5–2, default 1"),
    saturation: z.number().optional().describe("0–2, default 1"),
    hue: z.number().optional().describe("Hue rotation degrees"),
    sharpen: z.number().optional().describe("Sharpen sigma"),
    greyscale: z.boolean().optional(),
    rotate: z.number().optional().describe("Rotation degrees"),
    flip: z.enum(["horizontal", "vertical"]).optional(),
    format: z.enum(["png", "jpeg", "webp", "avif"]).optional(),
    quality: z.number().optional(),
  },
  IMAGE_WRITE,
  async (args) =>
    jsonText(
      await withToolLogging("image_adjust", { workspacePath: args.workspacePath, riskLevel: "medium" }, () =>
        imageAdjust(args)
      )
    )
);

server.tool(
  "image_composite",
  "Overlay/watermark: composite overlay image onto base with position or gravity and opacity.",
  {
    workspacePath: workspacePathSchema,
    basePath: z.string().describe("Background image"),
    overlayPath: z.string().describe("Overlay/watermark image"),
    outputPath: z.string(),
    left: z.number().optional(),
    top: z.number().optional(),
    gravity: z
      .enum(["northwest", "north", "northeast", "west", "center", "east", "southwest", "south", "southeast"])
      .optional(),
    opacity: z.number().optional().describe("0–1 overlay opacity"),
    format: z.enum(["png", "jpeg", "webp", "avif"]).optional(),
    quality: z.number().optional(),
  },
  IMAGE_WRITE,
  async (args) =>
    jsonText(
      await withToolLogging("image_composite", { workspacePath: args.workspacePath, riskLevel: "medium" }, () =>
        imageComposite(args)
      )
    )
);

server.tool(
  "image_batch",
  "Batch process up to 20 images: info, resize, or convert to outputDir.",
  {
    workspacePath: workspacePathSchema,
    operation: z.enum(["info", "resize", "convert"]),
    inputPaths: z.array(z.string()).describe("Relative image paths"),
    outputDir: z.string().describe("Output directory e.g. assets/batch-out"),
    width: z.number().optional(),
    height: z.number().optional(),
    format: z.enum(["png", "jpeg", "webp", "avif"]).optional(),
    quality: z.number().optional(),
  },
  IMAGE_WRITE,
  async (args) =>
    jsonText(
      await withToolLogging("image_batch", { workspacePath: args.workspacePath, riskLevel: "medium" }, () =>
        imageBatch(args)
      )
    )
);

server.tool(
  "image_text",
  "Add text caption/label overlay on image using SVG text composite.",
  {
    workspacePath: workspacePathSchema,
    inputPath: z.string(),
    outputPath: z.string(),
    text: z.string().describe("Text to render on image"),
    fontSize: z.number().optional(),
    fontFamily: z.string().optional(),
    color: z.string().optional().describe("Text color e.g. #ffffff"),
    backgroundColor: z.string().optional().describe("Optional semi-transparent bar"),
    gravity: z
      .enum(["northwest", "north", "northeast", "west", "center", "east", "southwest", "south", "southeast"])
      .optional(),
    padding: z.number().optional(),
    format: z.enum(["png", "jpeg", "webp", "avif"]).optional(),
    quality: z.number().optional(),
  },
  IMAGE_WRITE,
  async (args) =>
    jsonText(
      await withToolLogging("image_text", { workspacePath: args.workspacePath, riskLevel: "medium" }, () =>
        imageText(args)
      )
    )
);

server.tool(
  "image_rounded",
  "Apply rounded corners or circular mask. Output should be .png/.webp for transparency.",
  {
    workspacePath: workspacePathSchema,
    inputPath: z.string(),
    outputPath: z.string(),
    radius: z.number().optional().describe("Corner radius px (default 24)"),
    circle: z.boolean().optional().describe("Circular crop mask"),
    format: z.enum(["png", "webp"]).optional(),
    quality: z.number().optional(),
  },
  IMAGE_WRITE,
  async (args) =>
    jsonText(
      await withToolLogging("image_rounded", { workspacePath: args.workspacePath, riskLevel: "medium" }, () =>
        imageRounded(args)
      )
    )
);

server.tool(
  "image_upscale",
  "Upscale image using Lanczos3 resampling (sharp). Optional sharpen. Not generative AI upscale.",
  {
    workspacePath: workspacePathSchema,
    inputPath: z.string(),
    outputPath: z.string(),
    scale: z.number().optional().describe("Scale factor 1–4 e.g. 2 = 2x"),
    width: z.number().optional(),
    height: z.number().optional(),
    sharpen: z.number().optional(),
    format: z.enum(["png", "jpeg", "webp", "avif"]).optional(),
    quality: z.number().optional(),
  },
  IMAGE_WRITE,
  async (args) =>
    jsonText(
      await withToolLogging("image_upscale", { workspacePath: args.workspacePath, riskLevel: "medium" }, () =>
        imageUpscale(args)
      )
    )
);

server.tool(
  "image_upscale_ai",
  "AI generative upscale via Real-ESRGAN (realesrgan-ncnn-vulkan CLI local) or Replicate API (REPLICATE_API_TOKEN). Scale 2 or 4.",
  {
    workspacePath: workspacePathSchema,
    inputPath: z.string(),
    outputPath: z.string(),
    scale: z.union([z.literal(2), z.literal(4)]).optional().describe("AI upscale factor (default 2)"),
    mode: z.enum(["auto", "cli", "api"]).optional().describe("auto=CLI then Replicate API"),
    apiToken: z.string().optional().describe("Replicate API token"),
    timeoutMs: z.number().optional().describe("Timeout ms (default 300000)"),
  },
  IMAGE_NETWORK,
  async (args) =>
    jsonText(
      await withToolLogging("image_upscale_ai", { workspacePath: args.workspacePath, riskLevel: "high" }, () =>
        imageUpscaleAi(args)
      )
    )
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal MCP server error:", err);
  process.exit(1);
});
