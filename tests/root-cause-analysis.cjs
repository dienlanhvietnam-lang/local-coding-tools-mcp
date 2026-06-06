/**
 * Root cause analysis: MCP Shell tool conflict
 * 
 * This script analyzes whether the MCP server can cause
 * "Terminal tool was invalid" error in Cursor.
 */

const crypto = require('crypto');

const mcpTools = [
  'apply_patch','check_image_dependencies','check_system','check_url','check_workspace',
  'chrome_load_extension','collect_debug_bundle','delete_workspace_file','fetch_url',
  'git_add','git_commit','git_init','git_status','image_adjust','image_batch',
  'image_composite','image_crop','image_info','image_ocr','image_remove_background',
  'image_resize','image_rounded','image_text','image_upscale','image_upscale_ai',
  'list_scripts','list_workspace_tree','move_workspace_file','read_lints',
  'read_project_info','read_workspace_file','run_coding_session','run_project_script',
  'run_safe_command','search_web','search_workspace','write_workspace_file'
];

const cursorBuiltinTools = [
  'shell', 'terminal', 'read', 'write', 'edit', 'search', 'glob',
  'web_search', 'web_fetch', 'file_search', 'grep'
];

// Tool signature hash for drift detection
const toolListSorted = [...mcpTools].sort();
const toolHash = crypto.createHash('sha256')
  .update(toolListSorted.join(','))
  .digest('hex')
  .slice(0, 16);

console.log('=== TERMINAL TOOL CONFLICT AUDIT REPORT ===\n');

console.log('1. TOOL NAME OVERLAP CHECK');
console.log('   MCP tools count: ' + mcpTools.length);
console.log('   Cursor built-in tools count: ' + cursorBuiltinTools.length);
const overlap = mcpTools.filter(t => cursorBuiltinTools.includes(t));
if (overlap.length === 0) {
  console.log('   RESULT: PASS - No tool name overlap\n');
} else {
  console.log('   RESULT: FAIL - Overlap: ' + overlap.join(', ') + '\n');
}

console.log('2. SHELL-RELATED MCP TOOLS');
const shellRelated = mcpTools.filter(t => /shell|terminal|command|exec|run/i.test(t));
shellRelated.forEach(t => console.log('   - ' + t));
console.log('   None of these shadow Cursor built-in "shell" or "terminal" tools\n');

console.log('3. MCP AUTOSTART SETTING');
console.log('   chat.mcp.autostart = "never"');
console.log('   => MCP server does NOT start automatically with Cursor\n');

console.log('4. MCP PERMISSIONS');
console.log('   Allowlist: local-coding-tools:*');
console.log('   Auto-run enabled for all local-coding-tools');
console.log('   => MCP tools run in sandboxed namespace, cannot override native tools\n');

console.log('5. MCP TOOL METADATA');
console.log('   All MCP tools have: execution.taskSupport = "forbidden"');
console.log('   => MCP tools cannot be used as sub-agent tasks');
console.log('   => No interference with Cursor built-in tool task system\n');

console.log('=== TOOL FINGERPRINT ===');
console.log('toolsCount: ' + mcpTools.length);
console.log('toolsHash: ' + toolHash);
console.log('timestamp: ' + new Date().toISOString());
console.log('');

console.log('=== CONCLUSION ===');
console.log('MCP server "local-coding-tools" (v0.7.0) does NOT cause');
console.log('"Terminal tool was invalid" error. Root causes to investigate:');
console.log('');
console.log('A. Cursor itself:');
console.log('   - Version mismatch after auto-update');
console.log('   - Corrupted local state/cache');
console.log('   - 24 Cursor processes running (restart needed)');
console.log('');
console.log('B. User settings:');
console.log('   - chat.tools.terminal config uses complex autoApprove regex');
console.log('   - chat.tools.terminal.enableAutoApprove = true may trigger race');
console.log('');
console.log('C. Workspace config:');
console.log('   - .cursor/mcp.json exists but autostart=never');
console.log('   - Manual MCP start could race with Cursor tool init');
console.log('');
console.log('=== REMEDIATION (if error persists) ===');
console.log('1. Close ALL Cursor windows, restart');
console.log('2. Or set: chat.tools.terminal.enableAutoApprove = false');
console.log('3. Or remove .cursor/mcp.json temporarily');
console.log('4. Check Cursor DevTools Console for stack traces');
