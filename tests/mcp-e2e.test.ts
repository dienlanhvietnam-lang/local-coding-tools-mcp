import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SERVER = path.join(ROOT, "dist", "server.js");
const FIXTURE = path.join(ROOT, "tests", "fixtures", "sample-project");

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

function parseResult(result: { content?: Array<{ type: string; text?: string }> }) {
  const text = result.content?.find((c) => c.type === "text")?.text ?? "{}";
  return JSON.parse(text) as Record<string, unknown>;
}

describe("MCP E2E (stdio client — simulates Cursor/VS Code)", () => {
  let client: Client;
  const patchFile = path.join(FIXTURE, "src", "e2e-patch-target.txt");

  beforeAll(async () => {
    expect(fs.existsSync(SERVER)).toBe(true);
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [SERVER],
      cwd: ROOT,
    });
    client = new Client({ name: "mcp-e2e", version: "1.0.0" }, { capabilities: {} });
    await client.connect(transport);
  }, 30_000);

  afterAll(async () => {
    if (fs.existsSync(patchFile)) fs.unlinkSync(patchFile);
    await client?.close();
  });

  it("lists 28 tools after initialize", async () => {
    const tools = await client.listTools();
    const names = tools.tools.map((t) => t.name).sort();
    expect(names).toEqual([...EXPECTED_TOOLS].sort());
  });

  it("check_system returns PASS", async () => {
    const raw = await client.callTool({ name: "check_system", arguments: {} });
    const data = parseResult(raw);
    expect(data.status).toBe("PASS");
  });

  it("read_lints runs on main project", async () => {
    const raw = await client.callTool({
      name: "read_lints",
      arguments: { workspacePath: ROOT, timeoutMs: 90_000 },
    });
    const data = parseResult(raw);
    expect(["PASS", "FAIL", "PARTIAL"]).toContain(data.status);
  });

  it("apply_patch search-replace in allowed path", async () => {
    fs.mkdirSync(path.dirname(patchFile), { recursive: true });
    fs.writeFileSync(patchFile, "hello world\n", "utf8");

    const raw = await client.callTool({
      name: "apply_patch",
      arguments: {
        workspacePath: FIXTURE,
        relativePath: "src/e2e-patch-target.txt",
        oldText: "hello",
        newText: "hi",
      },
    });
    const data = parseResult(raw);
    expect(data.status).toBe("PASS");
    expect(fs.readFileSync(patchFile, "utf8")).toBe("hi world\n");
  });

  it("apply_patch on .env is not blocked by path policy", async () => {
    const raw = await client.callTool({
      name: "apply_patch",
      arguments: {
        workspacePath: FIXTURE,
        relativePath: ".env",
        oldText: "x",
        newText: "y",
      },
    });
    const data = parseResult(raw);
    expect(["PASS", "FAIL"]).toContain(data.status);
    expect(data.status).not.toBe("BLOCKED");
  });

  it("write_workspace_file allows package.json in fixture", async () => {
    const pkgPath = path.join(FIXTURE, "package.json");
    const original = fs.readFileSync(pkgPath, "utf8");
    const raw = await client.callTool({
      name: "write_workspace_file",
      arguments: {
        workspacePath: FIXTURE,
        relativePath: "package.json",
        content: original,
      },
    });
    const data = parseResult(raw);
    expect(data.status).toBe("PASS");
  });

  it("image_info reads fixture when present", async () => {
    const fixtureImg = path.join(FIXTURE, "assets", "e2e-source.png");
    fs.mkdirSync(path.dirname(fixtureImg), { recursive: true });
    if (!fs.existsSync(fixtureImg)) {
      const { default: sharpMod } = await import("sharp");
      await sharpMod({
        create: { width: 32, height: 32, channels: 3, background: { r: 255, g: 0, b: 0 } },
      })
        .png()
        .toFile(fixtureImg);
    }
    const raw = await client.callTool({
      name: "image_info",
      arguments: { workspacePath: FIXTURE, relativePath: "assets/e2e-source.png" },
    });
    const data = parseResult(raw);
    expect(data.status).toBe("PASS");
    expect(data.width).toBe(32);
  });

  it("git_status returns SKIPPED or PASS", async () => {
    const raw = await client.callTool({
      name: "git_status",
      arguments: { workspacePath: ROOT },
    });
    const data = parseResult(raw);
    expect(["PASS", "SKIPPED", "FAIL"]).toContain(data.status);
  });
});
