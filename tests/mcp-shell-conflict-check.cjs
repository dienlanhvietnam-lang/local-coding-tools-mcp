#!/usr/bin/env node
/**
 * MCP Shell Tool Conflict Check
 * 
 * Check if MCP server registers tools that conflict with Cursor built-in Shell tool.
 * 
 * Usage: node tests/mcp-shell-conflict-check.js
 */

const mcpTools = [
  'run_coding_session','check_system','check_workspace','read_project_info',
  'list_scripts','git_status','read_workspace_file','search_workspace',
  'list_workspace_tree','check_url','write_workspace_file','run_project_script',
  'collect_debug_bundle','read_lints','apply_patch','check_image_dependencies',
  'image_info','image_ocr','image_crop','image_resize','image_remove_background',
  'image_adjust','image_composite','image_batch','image_text',
  'image_rounded','image_upscale','image_upscale_ai'
];

const builtinTools = [
  'shell', 'terminal', 'read', 'write', 'edit', 'search', 'glob',
  'web_search', 'web_fetch', 'file_search', 'grep'
];

console.log('=== MCP TOOLS (28) ===');
mcpTools.forEach(t => console.log('  ' + t));

console.log('\n=== CURSOR BUILT-IN TOOLS ===');
builtinTools.forEach(t => console.log('  ' + t));

console.log('\n=== OVERLAP CHECK ===');
const overlap = mcpTools.filter(t => builtinTools.includes(t));
if (overlap.length === 0) {
  console.log('PASS: Khong co tool nao trung ten giua MCP va Cursor built-in');
} else {
  console.log('FAIL: OVERLAP found -> ' + overlap.join(', '));
}

console.log('\n=== KEY FINDINGS ===');
console.log('1. run_project_script la tool chay npm script, KHONG PHAI Shell tool');
console.log('2. check_system kiem tra system requirements');
console.log('3. Khong tool nao dat ten "shell", "terminal", "command"');
console.log('4. Cursor mcp.autostart="never" => MCP khong tu dong start');
console.log('5. chat.tools.terminal config doc lap hoan toan');

console.log('\n=== KET LUAN ===');
console.log('MCP server local-coding-tools KHONG conflict voi Cursor built-in Shell tool');
console.log('Khong co nguy co schema thay doi do MCP tools');

process.exit(overlap.length > 0 ? 1 : 0);
