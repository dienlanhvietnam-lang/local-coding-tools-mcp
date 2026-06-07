#!/usr/bin/env node
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { SERVER_NAME, SERVER_VERSION } from "./config.js";
import { withToolLogging } from "./logger.js";
import {
  READ_ONLY,
  WRITE,
  EXECUTE,
  NETWORK,
  BATCH,
  IMAGE_READ,
  IMAGE_WRITE,
  IMAGE_NETWORK,
  UI_READ,
  UI_WRITE,
  UI_EXECUTE,
} from "./toolMeta.js";
import { checkSystem } from "./tools/checkSystem.js";
import { checkWorkspace } from "./tools/checkWorkspace.js";
import { readProjectInfo } from "./tools/readProjectInfo.js";
import { listScripts } from "./tools/listScripts.js";
import { runProjectScript } from "./tools/runProjectScript.js";
import { gitStatus } from "./tools/gitStatus.js";
import { gitInit } from "./tools/gitInit.js";
import { gitAdd } from "./tools/gitAdd.js";
import { gitCommit } from "./tools/gitCommit.js";
import { checkUrl } from "./tools/checkUrl.js";
import { fetchUrl } from "./tools/fetchUrl.js";
import { deleteWorkspaceFile } from "./tools/deleteWorkspaceFile.js";
import { moveWorkspaceFile } from "./tools/moveWorkspaceFile.js";
import { runSafeCommand } from "./tools/runSafeCommand.js";
import { searchWeb } from "./tools/searchWeb.js";
import { chromeLoadExtension } from "./tools/chromeLoadExtension.js";
import { checkJsSyntax } from "./tools/checkJsSyntax.js";
import { runFormat } from "./tools/runFormat.js";
import { readBinaryFile } from "./tools/readBinaryFile.js";
import { copyWorkspaceFile } from "./tools/copyWorkspaceFile.js";
import { createDirectory } from "./tools/createDirectory.js";
import { deletePattern } from "./tools/deletePattern.js";
import { fileStats } from "./tools/fileStats.js";
import { globWorkspace } from "./tools/globWorkspace.js";
import { httpRequest } from "./tools/httpRequest.js";
import { gitPush, gitPull, gitBranch, gitCheckout, gitMerge } from "./tools/gitAdvanced.js";
import { editNotebook } from "./tools/editNotebook.js";
import { todoWrite, todoRead } from "./tools/todoStore.js";
import { generateImage } from "./tools/generateImage.js";
import { semanticSearch } from "./tools/semanticSearch.js";
import { collectDebugBundle } from "./tools/collectDebugBundle.js";
import { readWorkspaceFile } from "./tools/readWorkspaceFile.js";
import { writeWorkspaceFile } from "./tools/writeWorkspaceFile.js";
import { searchWorkspace } from "./tools/searchWorkspace.js";
import { listWorkspaceTree } from "./tools/listWorkspaceTree.js";
import { runCodingSession } from "./tools/runCodingSession.js";
import { readLints } from "./tools/readLints.js";
import { applyPatch } from "./tools/applyPatch.js";
import { imageInfo } from "./tools/imageInfo.js";
import { imageOcr } from "./tools/imageOcr.js";
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
import { fetchCachedOutput } from "./tools/fetchCachedOutput.js";
import { listCacheEntries, parseCacheId, readCache, CACHE_URI_SCHEME } from "./cache/outputCache.js";
import { maybeCache } from "./utils/maybeCache.js";
import { getSessionContext, clearSessionContext } from "./tools/sessionContext.js";
import { estimateToolOutput } from "./tools/estimateToolOutput.js";
import { summarizeToolHistory } from "./tools/summarizeToolHistory.js";
import { captureScreenshot } from "./tools/captureScreenshot.js";
import { previewHtml } from "./tools/previewHtml.js";
import { auditAccessibility } from "./tools/auditAccessibility.js";
import { extractDesignTokens } from "./tools/extractDesignTokens.js";
import { compareImages } from "./tools/compareImages.js";
import { analyzeTypography } from "./tools/analyzeTypography.js";
import { generatePalette } from "./tools/generatePalette.js";
import { auditResponsive } from "./tools/auditResponsive.js";
import { listUiComponents } from "./tools/listUiComponents.js";
import { pageAudit } from "./tools/pageAudit.js";
import { readDevgolGuide } from "./tools/readDevgolGuide.js";
import { scoreUiDevgol } from "./tools/scoreUiDevgol.js";
import { suggestUiPattern } from "./tools/suggestUiPattern.js";
import { fetchIconSvg } from "./tools/fetchIconSvg.js";

function jsonText(data: unknown): { content: Array<{ type: "text"; text: string }> } {
  return {
    content: [{ type: "text", text: JSON.stringify(data) }],
  };
}

const workspacePathSchema = z
  .string()
  .describe("Absolute path to the project workspace");

const server = new McpServer(
  {
    name: SERVER_NAME,
    version: SERVER_VERSION,
  },
  {
    instructions: [
      "Context budget rules for local-coding-tools:",
      "1. Run search_workspace or semantic_search BEFORE read_workspace_file.",
      "2. Use read_workspace_file with startLine + lineCount; avoid reading whole files over ~200 lines.",
      "3. If a result has truncated:true or a cacheId/cacheUri, use fetch_cached_output (or the mcp-cache:// resource) instead of re-running the tool.",
      "4. Call get_session_context when resuming work to avoid repeating searches/reads.",
      "5. Call estimate_tool_output before large reads to decide on a line range.",
    ].join("\n"),
  }
);

server.tool(
  "run_coding_session",
  "Run full coding workflow in one call: check_system, check_workspace, read_project_info, list_scripts, optional build/test script, git_status, collect_debug_bundle.",
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
  "Read package.json, detect frameworks, summarize .env keys and values.",
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
  "git_init",
  "Initialize a new git repository in the workspace (git init). Skips if already a repo.",
  { workspacePath: workspacePathSchema },
  EXECUTE,
  async ({ workspacePath }) =>
    jsonText(
      await withToolLogging("git_init", { workspacePath, riskLevel: "medium" }, () =>
        gitInit({ workspacePath })
      )
    )
);

server.tool(
  "git_add",
  "Stage files for commit (git add). Default paths: [.] — no force add.",
  {
    workspacePath: workspacePathSchema,
    paths: z.array(z.string()).optional().describe("Relative paths to stage (default: all)"),
  },
  EXECUTE,
  async ({ workspacePath, paths }) =>
    jsonText(
      await withToolLogging("git_add", { workspacePath, riskLevel: "medium" }, () =>
        gitAdd({ workspacePath, paths })
      )
    )
);

server.tool(
  "git_commit",
  "Create a git commit with message (git commit -m). No push.",
  {
    workspacePath: workspacePathSchema,
    message: z.string().describe("Commit message"),
  },
  EXECUTE,
  async ({ workspacePath, message }) =>
    jsonText(
      await withToolLogging("git_commit", { workspacePath, riskLevel: "medium" }, () =>
        gitCommit({ workspacePath, message })
      )
    )
);

server.tool(
  "git_push",
  "Push commits to remote (git push). Uses --force-with-lease if force=true. SKIPPED if not a repo.",
  {
    workspacePath: workspacePathSchema,
    remote: z.string().optional().describe("Remote name e.g. origin"),
    branch: z.string().optional().describe("Branch name"),
    force: z.boolean().optional().describe("Force push with lease (default false)"),
    setUpstream: z.boolean().optional().describe("Set upstream (-u)"),
  },
  EXECUTE,
  async ({ workspacePath, remote, branch, force, setUpstream }) =>
    jsonText(
      await withToolLogging("git_push", { workspacePath, riskLevel: "high" }, () =>
        gitPush({ workspacePath, remote, branch, force, setUpstream })
      )
    )
);

server.tool(
  "git_pull",
  "Pull from remote (git pull). SKIPPED if not a repo.",
  {
    workspacePath: workspacePathSchema,
    remote: z.string().optional().describe("Remote name e.g. origin"),
    branch: z.string().optional().describe("Branch name"),
  },
  EXECUTE,
  async ({ workspacePath, remote, branch }) =>
    jsonText(
      await withToolLogging("git_pull", { workspacePath, riskLevel: "medium" }, () =>
        gitPull({ workspacePath, remote, branch })
      )
    )
);

server.tool(
  "git_branch",
  "List branches, or create a branch when 'create' is provided. SKIPPED if not a repo.",
  {
    workspacePath: workspacePathSchema,
    create: z.string().optional().describe("New branch name to create"),
  },
  EXECUTE,
  async ({ workspacePath, create }) =>
    jsonText(
      await withToolLogging("git_branch", { workspacePath, riskLevel: "medium" }, () =>
        gitBranch({ workspacePath, create })
      )
    )
);

server.tool(
  "git_checkout",
  "Switch to a branch (git checkout), or create with create=true. SKIPPED if not a repo.",
  {
    workspacePath: workspacePathSchema,
    branch: z.string().describe("Branch name"),
    create: z.boolean().optional().describe("Create branch (-b)"),
  },
  EXECUTE,
  async ({ workspacePath, branch, create }) =>
    jsonText(
      await withToolLogging("git_checkout", { workspacePath, riskLevel: "medium" }, () =>
        gitCheckout({ workspacePath, branch, create })
      )
    )
);

server.tool(
  "git_merge",
  "Merge a branch into current (git merge --no-edit). Reports conflicts. SKIPPED if not a repo.",
  {
    workspacePath: workspacePathSchema,
    branch: z.string().describe("Branch to merge into current"),
  },
  EXECUTE,
  async ({ workspacePath, branch }) =>
    jsonText(
      await withToolLogging("git_merge", { workspacePath, riskLevel: "high" }, () =>
        gitMerge({ workspacePath, branch })
      )
    )
);

server.tool(
  "read_workspace_file",
  "Read a text file. Prefer after search_workspace/semantic_search. Use startLine+lineCount for partial reads; read full files only when small.",
  {
    workspacePath: workspacePathSchema,
    relativePath: z.string().describe("Path relative to workspace root"),
    maxChars: z.number().optional().describe("Max characters to return"),
    startLine: z.number().optional().describe("First line to read (1-based). Enables line-range mode."),
    lineCount: z.number().optional().describe("Number of lines to read from startLine (default 80, capped)"),
    stripContext: z.boolean().optional().describe("Strip XML-like context blocks (rules, git_status, instructions) — useful for transcripts"),
  },
  READ_ONLY,
  async ({ workspacePath, relativePath, maxChars, startLine, lineCount, stripContext }) =>
    jsonText(
      await withToolLogging("read_workspace_file", { workspacePath, riskLevel: "low" }, () =>
        readWorkspaceFile({ workspacePath, relativePath, maxChars, startLine, lineCount, stripContext })
      )
    )
);

server.tool(
  "search_workspace",
  "Search file contents in workspace using regex. Skips node_modules/.git.",
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
  "glob_workspace",
  "Find files by glob pattern (e.g. **/*.{ts,tsx}). Skips node_modules/.git. Read-only.",
  {
    workspacePath: workspacePathSchema,
    pattern: z.string().describe("Glob pattern e.g. **/*.ts"),
    relativeDir: z.string().optional().describe("Base directory (default .)"),
    maxResults: z.number().optional().describe("Max matches (default 1000)"),
    includeDirs: z.boolean().optional().describe("Include directories (default false)"),
  },
  READ_ONLY,
  async ({ workspacePath, pattern, relativeDir, maxResults, includeDirs }) =>
    jsonText(
      await withToolLogging("glob_workspace", { workspacePath, riskLevel: "low" }, () =>
        globWorkspace({ workspacePath, pattern, relativeDir, maxResults, includeDirs })
      )
    )
);

server.tool(
  "semantic_search",
  "Semantic-ish code search. Uses embeddings if OPENAI_API_KEY/VOYAGE_API_KEY set; else keyword-overlap fallback.",
  {
    workspacePath: workspacePathSchema,
    query: z.string().describe("Natural language or keyword query"),
    relativeDir: z.string().optional().describe("Base directory (default .)"),
    maxResults: z.number().optional().describe("Max results 1-30 (default 8)"),
    fileGlob: z.string().optional().describe("Filter filenames"),
  },
  READ_ONLY,
  async ({ workspacePath, query, relativeDir, maxResults, fileGlob }) =>
    jsonText(
      await withToolLogging("semantic_search", { workspacePath, riskLevel: "low" }, () =>
        semanticSearch({ workspacePath, query, relativeDir, maxResults, fileGlob })
      )
    )
);

server.tool(
  "read_binary_file",
  "Read a binary file as base64 (size-limited, default 5MB).",
  {
    workspacePath: workspacePathSchema,
    relativePath: z.string().describe("Path relative to workspace root"),
    maxBytes: z.number().optional().describe("Max bytes (default 5242880)"),
  },
  READ_ONLY,
  async ({ workspacePath, relativePath, maxBytes }) =>
    jsonText(
      await withToolLogging("read_binary_file", { workspacePath, riskLevel: "low" }, () =>
        readBinaryFile({ workspacePath, relativePath, maxBytes })
      )
    )
);

server.tool(
  "file_stats",
  "Get file/directory metadata: size, mode, created/modified time, isFile/isDirectory.",
  {
    workspacePath: workspacePathSchema,
    relativePath: z.string().describe("Path relative to workspace root"),
  },
  READ_ONLY,
  async ({ workspacePath, relativePath }) =>
    jsonText(
      await withToolLogging("file_stats", { workspacePath, riskLevel: "low" }, () =>
        fileStats({ workspacePath, relativePath })
      )
    )
);

server.tool(
  "check_js_syntax",
  "Check syntax of a JS/TS file (node --check for .js/.mjs/.cjs, tsc --noEmit for .ts if installed).",
  {
    workspacePath: workspacePathSchema,
    relativePath: z.string().describe("File to check"),
    timeoutMs: z.number().optional().describe("Timeout ms (default 30000)"),
  },
  READ_ONLY,
  async ({ workspacePath, relativePath, timeoutMs }) =>
    jsonText(
      await withToolLogging("check_js_syntax", { workspacePath, riskLevel: "low" }, () =>
        checkJsSyntax({ workspacePath, relativePath, timeoutMs })
      )
    )
);

server.tool(
  "edit_notebook",
  "Edit a Jupyter .ipynb: replace/insert/delete a cell by index.",
  {
    workspacePath: workspacePathSchema,
    relativePath: z.string().describe(".ipynb path relative to workspace"),
    operation: z.enum(["replace", "insert", "delete"]).describe("Cell operation"),
    cellIndex: z.number().describe("0-based cell index"),
    cellType: z.enum(["code", "markdown"]).optional().describe("Cell type for insert/replace"),
    source: z.string().optional().describe("Cell source for insert/replace"),
  },
  WRITE,
  async ({ workspacePath, relativePath, operation, cellIndex, cellType, source }) =>
    jsonText(
      await withToolLogging("edit_notebook", { workspacePath, riskLevel: "medium" }, () =>
        editNotebook({ workspacePath, relativePath, operation, cellIndex, cellType, source })
      )
    )
);

server.tool(
  "todo_read",
  "Read MCP session todos from .mcp-debug/todos.json (MCP-only, not shown in Cursor UI).",
  { workspacePath: workspacePathSchema },
  READ_ONLY,
  async ({ workspacePath }) =>
    jsonText(
      await withToolLogging("todo_read", { workspacePath, riskLevel: "low" }, () =>
        todoRead({ workspacePath })
      )
    )
);

server.tool(
  "todo_write",
  "Write MCP session todos to .mcp-debug/todos.json (MCP-only, not shown in Cursor UI).",
  {
    workspacePath: workspacePathSchema,
    todos: z
      .array(
        z.object({
          id: z.string(),
          content: z.string(),
          status: z.enum(["pending", "in_progress", "completed", "cancelled"]),
        })
      )
      .describe("Todo items"),
    merge: z.boolean().optional().describe("Merge by id instead of replace"),
  },
  WRITE,
  async ({ workspacePath, todos, merge }) =>
    jsonText(
      await withToolLogging("todo_write", { workspacePath, riskLevel: "low" }, () =>
        todoWrite({ workspacePath, todos, merge })
      )
    )
);

server.tool(
  "check_url",
  "GET probe — status, timing, redirects, response headers (no body). Lightweight health check.",
  {
    url: z.string().describe("HTTP or HTTPS URL to check"),
    timeoutMs: z.number().optional().describe("Timeout in ms (default 10000)"),
    includeAllHeaders: z
      .boolean()
      .optional()
      .describe("Return all response headers (default false — safe subset only)"),
  },
  NETWORK,
  async ({ url, timeoutMs, includeAllHeaders }) =>
    jsonText(
      await withToolLogging("check_url", { riskLevel: "low" }, () =>
        checkUrl({ url, timeoutMs, includeAllHeaders })
      )
    )
);

server.tool(
  "fetch_url",
  "HTTP GET with response body (truncated by default 256KB). Returns status, headers, content-type, body.",
  {
    url: z.string().describe("HTTP or HTTPS URL to fetch"),
    timeoutMs: z.number().optional().describe("Timeout in ms (default 10000)"),
    maxBodyChars: z.number().optional().describe("Max body chars (default 262144)"),
  },
  NETWORK,
  async ({ url, timeoutMs, maxBodyChars }) =>
    jsonText(
      await withToolLogging("fetch_url", { riskLevel: "low" }, () =>
        fetchUrl({ url, timeoutMs, maxBodyChars })
      )
    )
);

server.tool(
  "search_web",
  "Search the web. Uses BRAVE_SEARCH_API_KEY or SERPER_API_KEY if set; else DuckDuckGo Lite HTML.",
  {
    query: z.string().describe("Search query"),
    maxResults: z.number().optional().describe("Max results 1-10 (default 5)"),
  },
  NETWORK,
  async ({ query, maxResults }) =>
    jsonText(
      await withToolLogging("search_web", { riskLevel: "low" }, () =>
        searchWeb({ query, maxResults })
      )
    )
);

server.tool(
  "http_request",
  "Full HTTP request: GET/POST/PUT/PATCH/DELETE/HEAD with headers + body. Returns status, headers, body (default 256KB).",
  {
    url: z.string().describe("HTTP or HTTPS URL"),
    method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"]).optional().describe("HTTP method (default GET)"),
    headers: z.record(z.string()).optional().describe("Request headers"),
    body: z.string().optional().describe("Request body (for POST/PUT/PATCH)"),
    timeoutMs: z.number().optional().describe("Timeout ms (default 10000)"),
    maxBodyChars: z.number().optional().describe("Max response body chars (default 262144)"),
  },
  NETWORK,
  async ({ url, method, headers, body, timeoutMs, maxBodyChars }) =>
    jsonText(
      maybeCache(
        undefined,
        "http_request",
        await withToolLogging("http_request", { riskLevel: "medium" }, () =>
          httpRequest({ url, method, headers, body, timeoutMs, maxBodyChars })
        )
      )
    )
);

server.tool(
  "generate_image",
  "Generate an image from a prompt via OpenAI or Replicate API. SKIPPED if no API key set.",
  {
    workspacePath: workspacePathSchema,
    prompt: z.string().describe("Image generation prompt"),
    outputPath: z.string().describe("Output path relative to workspace"),
    provider: z.enum(["openai", "replicate", "auto"]).optional().describe("Provider (default auto)"),
    size: z.string().optional().describe("Image size e.g. 1024x1024"),
    timeoutMs: z.number().optional().describe("Timeout ms (default 120000)"),
  },
  NETWORK,
  async ({ workspacePath, prompt, outputPath, provider, size, timeoutMs }) =>
    jsonText(
      await withToolLogging("generate_image", { workspacePath, riskLevel: "medium" }, () =>
        generateImage({ workspacePath, prompt, outputPath, provider, size, timeoutMs })
      )
    )
);

// ── Write / execute (still guarded) ────────────────────────────────────────

server.tool(
  "write_workspace_file",
  "Write or create a file at any path (relative or absolute).",
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
  "delete_workspace_file",
  "Delete a file or empty directory in workspace. Use recursive: true for non-empty directories.",
  {
    workspacePath: workspacePathSchema,
    relativePath: z.string().describe("Path relative to workspace root"),
    recursive: z.boolean().optional().describe("Delete directory recursively (default false)"),
  },
  WRITE,
  async ({ workspacePath, relativePath, recursive }) =>
    jsonText(
      await withToolLogging("delete_workspace_file", { workspacePath, riskLevel: "medium" }, () =>
        deleteWorkspaceFile({ workspacePath, relativePath, recursive })
      )
    )
);

server.tool(
  "delete_pattern",
  "Delete files matching a glob pattern (e.g. **/*.bak). dryRun defaults true — returns matched list before deleting.",
  {
    workspacePath: workspacePathSchema,
    pattern: z.string().describe("Glob pattern e.g. **/*.bak"),
    relativeDir: z.string().optional().describe("Base directory (default .)"),
    dryRun: z.boolean().optional().describe("Preview only (default true)"),
    maxDelete: z.number().optional().describe("Safety cap (default 500)"),
  },
  WRITE,
  async ({ workspacePath, pattern, relativeDir, dryRun, maxDelete }) =>
    jsonText(
      await withToolLogging("delete_pattern", { workspacePath, riskLevel: "high" }, () =>
        deletePattern({ workspacePath, pattern, relativeDir, dryRun, maxDelete })
      )
    )
);

server.tool(
  "copy_workspace_file",
  "Copy a file or directory within the workspace.",
  {
    workspacePath: workspacePathSchema,
    fromRelativePath: z.string().describe("Source path relative to workspace"),
    toRelativePath: z.string().describe("Destination path relative to workspace"),
    overwrite: z.boolean().optional().describe("Overwrite destination (default true)"),
  },
  WRITE,
  async ({ workspacePath, fromRelativePath, toRelativePath, overwrite }) =>
    jsonText(
      await withToolLogging("copy_workspace_file", { workspacePath, riskLevel: "medium" }, () =>
        copyWorkspaceFile({ workspacePath, fromRelativePath, toRelativePath, overwrite })
      )
    )
);

server.tool(
  "create_directory",
  "Create a directory (mkdir -p) in the workspace.",
  {
    workspacePath: workspacePathSchema,
    relativePath: z.string().describe("Directory path relative to workspace"),
  },
  WRITE,
  async ({ workspacePath, relativePath }) =>
    jsonText(
      await withToolLogging("create_directory", { workspacePath, riskLevel: "low" }, () =>
        createDirectory({ workspacePath, relativePath })
      )
    )
);

server.tool(
  "run_format",
  "Format/auto-fix code via prettier --write or eslint --fix if installed. SKIPPED if no formatter.",
  {
    workspacePath: workspacePathSchema,
    paths: z.array(z.string()).optional().describe("Paths to format (default .)"),
    formatter: z.enum(["prettier", "eslint", "auto"]).optional().describe("Formatter (default auto)"),
    timeoutMs: z.number().optional().describe("Timeout ms (default 120000)"),
  },
  EXECUTE,
  async ({ workspacePath, paths, formatter, timeoutMs }) =>
    jsonText(
      await withToolLogging("run_format", { workspacePath, riskLevel: "medium" }, () =>
        runFormat({ workspacePath, paths, formatter, timeoutMs })
      )
    )
);

server.tool(
  "move_workspace_file",
  "Move or rename a file within the workspace.",
  {
    workspacePath: workspacePathSchema,
    fromRelativePath: z.string().describe("Source path relative to workspace"),
    toRelativePath: z.string().describe("Destination path relative to workspace"),
    createDirs: z.boolean().optional().describe("Create parent dirs at destination (default true)"),
  },
  WRITE,
  async ({ workspacePath, fromRelativePath, toRelativePath, createDirs }) =>
    jsonText(
      await withToolLogging("move_workspace_file", { workspacePath, riskLevel: "medium" }, () =>
        moveWorkspaceFile({ workspacePath, fromRelativePath, toRelativePath, createDirs })
      )
    )
);

server.tool(
  "run_project_script",
  "Run a script that exists in package.json only. Output may be truncated.",
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
  "run_safe_command",
  "Run an allowlisted command (node, npm, pnpm, git, python, powershell) with args array. No free-form shell.",
  {
    workspacePath: workspacePathSchema,
    command: z.string().describe("Executable name e.g. node, git, npm"),
    args: z.array(z.string()).optional().describe("Arguments array (no shell metacharacters)"),
    timeoutMs: z.number().optional().describe("Timeout in ms (default 120000)"),
  },
  EXECUTE,
  async ({ workspacePath, command, args, timeoutMs }) =>
    jsonText(
      maybeCache(
        workspacePath,
        "run_safe_command",
        await withToolLogging("run_safe_command", { workspacePath, riskLevel: "medium" }, () =>
          runSafeCommand({ workspacePath, command, args, timeoutMs })
        )
      )
    )
);

server.tool(
  "chrome_load_extension",
  "Load unpacked Chrome/Edge extension in a temporary profile (dev sideload, not Web Store install).",
  {
    workspacePath: workspacePathSchema,
    extensionPath: z.string().describe("Path to unpacked extension folder with manifest.json"),
    chromePath: z.string().optional().describe("Optional path to chrome.exe or msedge.exe"),
    prefer: z
      .enum(["chrome", "edge", "any"])
      .optional()
      .describe("Browser preference when auto-detecting (default chrome)"),
    startUrl: z.string().optional().describe("Optional URL to open in a new tab after load"),
    reuseProfile: z
      .boolean()
      .optional()
      .describe("Reuse fixed .mcp-debug/chrome-profile instead of timestamped run dir"),
  },
  EXECUTE,
  async ({ workspacePath, extensionPath, chromePath, prefer, startUrl, reuseProfile }) =>
    jsonText(
      await withToolLogging("chrome_load_extension", { workspacePath, riskLevel: "high" }, () =>
        chromeLoadExtension({ workspacePath, extensionPath, chromePath, prefer, startUrl, reuseProfile })
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
      maybeCache(
        workspacePath,
        "collect_debug_bundle",
        await withToolLogging("collect_debug_bundle", { workspacePath, riskLevel: "medium" }, () =>
          collectDebugBundle({ workspacePath })
        )
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
      maybeCache(
        workspacePath,
        "read_lints",
        await withToolLogging("read_lints", { workspacePath, riskLevel: "low" }, () =>
          readLints({ workspacePath, projectSubdir, timeoutMs })
        )
      )
    )
);

server.tool(
  "apply_patch",
  "Apply a search-and-replace patch to a file at any path.",
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
  "Check image toolchain: sharp (core), rembg/imgly/remove.bg API, Real-ESRGAN CLI, Replicate token.",
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
  "image_ocr",
  "OCR text from an image (Tesseract.js + Sharp preprocess). Returns JSON: metadata, fullText, word blocks with bbox/confidence. Default language eng uses bundled tessdata (no API key).",
  {
    workspacePath: workspacePathSchema,
    relativePath: z.string().describe("Image path relative to workspace"),
    languages: z
      .string()
      .optional()
      .describe('Tesseract langs: "eng", "vie", or "eng+vie" (bundled offline, no API key)'),
    maxDimension: z
      .number()
      .optional()
      .describe("Max long edge in px before OCR (default 1600)"),
    includeBlocks: z
      .boolean()
      .optional()
      .describe("Include per-word blocks with bbox (default true)"),
  },
  IMAGE_READ,
  async ({ workspacePath, relativePath, languages, maxDimension, includeBlocks }) =>
    jsonText(
      await withToolLogging("image_ocr", { workspacePath, riskLevel: "low" }, () =>
        imageOcr({ workspacePath, relativePath, languages, maxDimension, includeBlocks })
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

server.tool(
  "fetch_cached_output",
  "Read the full output of a previous tool call that was stored as a cache resource (returned cacheId). Use when the inline preview was not enough.",
  {
    workspacePath: workspacePathSchema,
    cacheId: z.string().describe("cacheId returned by a tool whose output was cached"),
    maxChars: z.number().optional().describe("Max characters to return"),
  },
  READ_ONLY,
  async ({ workspacePath, cacheId, maxChars }) =>
    jsonText(
      await withToolLogging("fetch_cached_output", { workspacePath, riskLevel: "low" }, () =>
        fetchCachedOutput({ workspacePath, cacheId, maxChars })
      )
    )
);

server.tool(
  "get_session_context",
  "Return the MCP session context bank (recent searches, recent file reads, cached output refs) so you can avoid redundant work. Read-only.",
  { workspacePath: workspacePathSchema },
  READ_ONLY,
  async ({ workspacePath }) =>
    jsonText(
      await withToolLogging("get_session_context", { workspacePath, riskLevel: "low" }, () =>
        getSessionContext({ workspacePath })
      )
    )
);

server.tool(
  "clear_session_context",
  "Clear the MCP session context bank for the workspace (use when switching to an unrelated task).",
  { workspacePath: workspacePathSchema },
  WRITE,
  async ({ workspacePath }) =>
    jsonText(
      await withToolLogging("clear_session_context", { workspacePath, riskLevel: "low" }, () =>
        clearSessionContext({ workspacePath })
      )
    )
);

server.tool(
  "estimate_tool_output",
  "Estimate the token/character cost of a tool before calling it (currently read_workspace_file). Use to decide whether to use a line range. Read-only.",
  {
    workspacePath: workspacePathSchema,
    toolName: z.string().describe("Tool to estimate, e.g. read_workspace_file"),
    relativePath: z.string().optional().describe("File path (required for read_workspace_file)"),
  },
  READ_ONLY,
  async ({ workspacePath, toolName, relativePath }) =>
    jsonText(
      await withToolLogging("estimate_tool_output", { workspacePath, riskLevel: "low" }, () =>
        estimateToolOutput({ workspacePath, toolName, relativePath })
      )
    )
);

server.tool(
  "summarize_tool_history",
  "Summarize recent MCP tool calls (status, duration, cache refs) without resending full outputs. Read-only.",
  {
    workspacePath: workspacePathSchema,
    limit: z.number().optional().describe("How many recent calls to summarize (default 20)"),
  },
  READ_ONLY,
  async ({ workspacePath, limit }) =>
    jsonText(
      await withToolLogging("summarize_tool_history", { workspacePath, riskLevel: "low" }, () =>
        summarizeToolHistory({ workspacePath, limit })
      )
    )
);

server.tool(
  "capture_screenshot",
  "Capture PNG screenshot of URL or workspace HTML via headless Chrome/Edge (CDP). SKIPPED if browser not found.",
  {
    workspacePath: workspacePathSchema,
    url: z.string().optional().describe("http(s) URL — localhost/private by default"),
    relativePath: z.string().optional().describe("Workspace HTML file path"),
    viewport: z.enum(["mobile", "tablet", "desktop"]).optional(),
    width: z.number().optional(),
    height: z.number().optional(),
    outputRelativePath: z.string().optional(),
    chromePath: z.string().optional(),
    allowPublicHosts: z.boolean().optional(),
    timeoutMs: z.number().optional(),
  },
  UI_EXECUTE,
  async (args) =>
    jsonText(
      await withToolLogging("capture_screenshot", { workspacePath: args.workspacePath, riskLevel: "medium" }, () =>
        captureScreenshot(args)
      )
    )
);

server.tool(
  "preview_html",
  "Render workspace HTML or snippet to PNG screenshot. No dev server required.",
  {
    workspacePath: workspacePathSchema,
    relativePath: z.string().optional(),
    htmlSnippet: z.string().optional(),
    viewport: z.enum(["mobile", "tablet", "desktop"]).optional(),
    width: z.number().optional(),
    height: z.number().optional(),
    outputRelativePath: z.string().optional(),
    chromePath: z.string().optional(),
    timeoutMs: z.number().optional(),
  },
  UI_EXECUTE,
  async (args) =>
    jsonText(
      await withToolLogging("preview_html", { workspacePath: args.workspacePath, riskLevel: "medium" }, () =>
        previewHtml(args)
      )
    )
);

server.tool(
  "audit_accessibility",
  "Accessibility audit — lite (CDP) or full (Playwright+axe). SKIPPED if browser/deps missing.",
  {
    workspacePath: workspacePathSchema,
    url: z.string().optional(),
    relativePath: z.string().optional(),
    mode: z.enum(["lite", "full"]).optional(),
    viewport: z.enum(["mobile", "tablet", "desktop"]).optional(),
    chromePath: z.string().optional(),
    allowPublicHosts: z.boolean().optional(),
    timeoutMs: z.number().optional(),
  },
  UI_EXECUTE,
  async (args) =>
    jsonText(
      await withToolLogging("audit_accessibility", { workspacePath: args.workspacePath, riskLevel: "low" }, () =>
        auditAccessibility(args)
      )
    )
);

server.tool(
  "extract_design_tokens",
  "Extract colors, typography, spacing, radius from CSS/Tailwind/theme files.",
  {
    workspacePath: workspacePathSchema,
    sources: z.array(z.string()).optional().describe("Glob paths — defaults to **/*.css, tailwind.config.*"),
  },
  UI_READ,
  async ({ workspacePath, sources }) =>
    jsonText(
      await withToolLogging("extract_design_tokens", { workspacePath, riskLevel: "low" }, () =>
        extractDesignTokens({ workspacePath, sources })
      )
    )
);

server.tool(
  "compare_images",
  "Pixel-diff two workspace images — diffPercent and optional heatmap PNG.",
  {
    workspacePath: workspacePathSchema,
    referenceRelativePath: z.string(),
    actualRelativePath: z.string(),
    threshold: z.number().optional().describe("0-1 pixelmatch threshold (default 0.1)"),
    outputDiffRelativePath: z.string().optional(),
  },
  UI_READ,
  async (args) =>
    jsonText(
      await withToolLogging("compare_images", { workspacePath: args.workspacePath, riskLevel: "low" }, () =>
        compareImages(args)
      )
    )
);

server.tool(
  "analyze_typography",
  "Analyze font families, sizes, line-heights from CSS files and suggest scale improvements.",
  {
    workspacePath: workspacePathSchema,
    sources: z.array(z.string()).optional(),
  },
  UI_READ,
  async ({ workspacePath, sources }) =>
    jsonText(
      await withToolLogging("analyze_typography", { workspacePath, riskLevel: "low" }, () =>
        analyzeTypography({ workspacePath, sources })
      )
    )
);

server.tool(
  "generate_palette",
  "Generate light/dark palette from seed color or dominant image color — CSS variables + Tailwind extend.",
  {
    workspacePath: workspacePathSchema,
    seedColor: z.string().optional().describe("#RRGGBB"),
    extractFromImage: z.string().optional().describe("Workspace image path"),
  },
  UI_READ,
  async (args) =>
    jsonText(
      await withToolLogging("generate_palette", { workspacePath: args.workspacePath, riskLevel: "low" }, () =>
        generatePalette(args)
      )
    )
);

server.tool(
  "audit_responsive",
  "Screenshot + overflow check at multiple breakpoints. SKIPPED if browser not found.",
  {
    workspacePath: workspacePathSchema,
    url: z.string(),
    breakpoints: z.array(z.number()).optional(),
    chromePath: z.string().optional(),
    allowPublicHosts: z.boolean().optional(),
    timeoutMs: z.number().optional(),
  },
  UI_EXECUTE,
  async (args) =>
    jsonText(
      await withToolLogging("audit_responsive", { workspacePath: args.workspacePath, riskLevel: "medium" }, () =>
        auditResponsive(args)
      )
    )
);

server.tool(
  "list_ui_components",
  "Inventory PascalCase UI components in components/ dirs with story/props detection.",
  {
    workspacePath: workspacePathSchema,
    scanDirs: z.array(z.string()).optional(),
  },
  UI_READ,
  async ({ workspacePath, scanDirs }) =>
    jsonText(
      await withToolLogging("list_ui_components", { workspacePath, riskLevel: "low" }, () =>
        listUiComponents({ workspacePath, scanDirs })
      )
    )
);

server.tool(
  "page_audit",
  "Page audit lite (CDP metrics + a11y) or full (Playwright + optional Lighthouse).",
  {
    workspacePath: workspacePathSchema,
    url: z.string(),
    mode: z.enum(["lite", "full"]).optional(),
    categories: z.array(z.string()).optional(),
    chromePath: z.string().optional(),
    allowPublicHosts: z.boolean().optional(),
    timeoutMs: z.number().optional(),
  },
  UI_EXECUTE,
  async (args) =>
    jsonText(
      await withToolLogging("page_audit", { workspacePath: args.workspacePath, riskLevel: "medium" }, () =>
        pageAudit(args)
      )
    )
);

server.tool(
  "read_devgol_guide",
  "Read DEV GOL UI/UX guide (scorecard, benchmark, patterns) — workspace override or bundled.",
  {
    workspacePath: workspacePathSchema,
    topic: z.enum(["scorecard", "benchmark", "patterns", "trend"]),
    productType: z.string().optional(),
  },
  UI_READ,
  async ({ workspacePath, topic, productType }) =>
    jsonText(
      await withToolLogging("read_devgol_guide", { workspacePath, riskLevel: "low" }, () =>
        readDevgolGuide({ workspacePath, topic, productType })
      )
    )
);

server.tool(
  "score_ui_devgol",
  "Score UI against DEV GOL checklist — a11y, states, components, visual. belowThreshold if < 85.",
  {
    workspacePath: workspacePathSchema,
    screenshotRelativePath: z.string().optional(),
    url: z.string().optional(),
    relativePath: z.string().optional(),
    productType: z.string().optional(),
    checklistMode: z.enum(["quick", "full"]).optional(),
  },
  UI_READ,
  async (args) =>
    jsonText(
      await withToolLogging("score_ui_devgol", { workspacePath: args.workspacePath, riskLevel: "low" }, () =>
        scoreUiDevgol(args)
      )
    )
);

server.tool(
  "suggest_ui_pattern",
  "Suggest 3 UI directions (safe/modern/distinct) for product type — no code.",
  {
    workspacePath: workspacePathSchema,
    productType: z.string().optional(),
    tone: z.enum(["safe", "modern", "distinct"]).optional(),
  },
  UI_READ,
  async ({ workspacePath, productType, tone }) =>
    jsonText(
      await withToolLogging("suggest_ui_pattern", { workspacePath, riskLevel: "low" }, () =>
        suggestUiPattern({ workspacePath, productType, tone })
      )
    )
);

server.tool(
  "fetch_icon_svg",
  "Download SVG icon from Lucide/Heroicons/Phosphor CDN into workspace (sanitized).",
  {
    workspacePath: workspacePathSchema,
    library: z.enum(["lucide", "heroicons", "phosphor"]),
    iconName: z.string(),
    outputRelativePath: z.string().optional(),
  },
  UI_WRITE,
  async (args) =>
    jsonText(
      await withToolLogging("fetch_icon_svg", { workspacePath: args.workspacePath, riskLevel: "low" }, () =>
        fetchIconSvg(args)
      )
    )
);

server.resource(
  "cached-output",
  new ResourceTemplate(`${CACHE_URI_SCHEME}://{id}`, {
    list: () => ({
      resources: listCacheEntries().map((entry) => ({
        uri: entry.uri,
        name: `${entry.toolName} output (${entry.originalChars} chars)`,
        mimeType: entry.mimeType,
      })),
    }),
  }),
  async (uri) => {
    const id = parseCacheId(uri.href);
    const entry = id ? readCache(id) : null;
    if (!entry) {
      throw new Error(`Cache resource not found: ${uri.href}`);
    }
    return {
      contents: [
        {
          uri: uri.href,
          mimeType: entry.meta.mimeType,
          text: entry.content,
        },
      ],
    };
  }
);

function logFatalToStderr(label: string, err: unknown): void {
  const message = err instanceof Error ? err.stack ?? err.message : String(err);
  console.error(`${label}:`, message);
}

process.on("uncaughtException", (err) => {
  logFatalToStderr("Uncaught MCP server exception", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logFatalToStderr("Unhandled MCP server rejection", reason);
  process.exit(1);
});

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  logFatalToStderr("Fatal MCP server error", err);
  process.exit(1);
});
