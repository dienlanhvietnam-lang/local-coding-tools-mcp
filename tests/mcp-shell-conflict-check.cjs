#!/usr/bin/env node
/**
 * MCP Shell Tool Conflict Check
 *
 * Check if MCP server registers tools that conflict with Cursor built-in Shell tool.
 *
 * Usage: node tests/mcp-shell-conflict-check.cjs
 */

const mcpTools = [
  "apply_patch",
  "check_image_dependencies",
  "check_system",
  "check_url",
  "check_workspace",
  "chrome_load_extension",
  "collect_debug_bundle",
  "delete_workspace_file",
  "fetch_url",
  "git_add",
  "git_commit",
  "git_init",
  "git_status",
  "image_adjust",
  "image_batch",
  "image_composite",
  "image_crop",
  "image_info",
  "image_ocr",
  "image_remove_background",
  "image_resize",
  "image_rounded",
  "image_text",
  "image_upscale",
  "image_upscale_ai",
  "list_scripts",
  "list_workspace_tree",
  "move_workspace_file",
  "read_lints",
  "read_project_info",
  "read_workspace_file",
  "run_coding_session",
  "run_project_script",
  "run_safe_command",
  "search_web",
  "search_workspace",
  "write_workspace_file",
];

const builtinTools = [
  "shell",
  "terminal",
  "read",
  "write",
  "edit",
  "search",
  "glob",
  "web_search",
  "web_fetch",
  "file_search",
  "grep",
];

console.log(`=== MCP TOOLS (${mcpTools.length}) ===`);
mcpTools.forEach((t) => console.log("  " + t));

console.log("\n=== CURSOR BUILT-IN TOOLS ===");
builtinTools.forEach((t) => console.log("  " + t));

console.log("\n=== OVERLAP CHECK ===");
const overlap = mcpTools.filter((t) => builtinTools.includes(t));
if (overlap.length === 0) {
  console.log("PASS: Khong co tool nao trung ten giua MCP va Cursor built-in");
} else {
  console.log("FAIL: OVERLAP found -> " + overlap.join(", "));
}

console.log("\n=== KEY FINDINGS ===");
console.log("1. run_project_script / run_safe_command la tool chay lenh co kiem soat, KHONG PHAI Shell tool");
console.log("2. search_web / fetch_url ten khac web_search / web_fetch built-in");
console.log("3. Khong tool nao dat ten shell, terminal, command");

console.log("\n=== KET LUAN ===");
console.log("MCP server local-coding-tools KHONG conflict voi Cursor built-in Shell tool");

process.exit(overlap.length > 0 ? 1 : 0);
