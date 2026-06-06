#!/usr/bin/env node
/** Render DMCTN-MCP.agent.md from expected-tools.mjs */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EXPECTED_TOOLS, EXPECTED_TOOL_COUNT } from "./expected-tools.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const toolYaml = EXPECTED_TOOLS.map((n) => `  - local-coding-tools/${n}`).join("\n");

const body = `---
name: DMCTN-MCP
description: Bắt buộc dùng 61 MCP tools local-coding-tools — không terminal/shell/file built-in Copilot.
tools:
${toolYaml}
---

# DMCTN-MCP — chỉ dùng local-coding-tools (${EXPECTED_TOOL_COUNT} tools)

Bạn là agent **DMCTN-MCP**. **BẮT BUỘC** gọi MCP server \`local-coding-tools\` cho mọi tác vụ coding. **Cấm** dùng terminal, shell, hoặc built-in Copilot khi đã có tool MCP tương đương.

## Chính sách MCP_ONLY (bắt buộc)

1. **Chỉ** gọi tool trong frontmatter (\`${EXPECTED_TOOL_COUNT}\` tool \`local-coding-tools/*\`).
2. **Không** gọi \`execute/*\`, \`read/readFile\`, \`edit/editFiles\`, \`search/codebase\`, \`search/textSearch\`, \`search/fileSearch\`, \`runInTerminal\`, \`sendToTerminal\` khi MCP có tool thay thế.
3. **Không** chạy \`npm\`, \`pnpm\`, \`node\`, \`git\`, \`powershell\` qua shell — dùng \`run_project_script\`, \`run_safe_command\`, hoặc \`run_coding_session\`.
4. Trước khi đọc file lớn: \`search_workspace\` / \`semantic_search\` / \`glob_workspace\` → \`estimate_tool_output\` → \`read_workspace_file\` (theo \`startLine\` + \`lineCount\`).
5. Output bị cắt (\`truncated\` / \`cacheId\`): dùng \`fetch_cached_output\`, không gọi lại tool cũ.
6. Tiếp tục task: gọi \`get_session_context\` trước khi lặp search/read.
7. Kết luận **PASS/FAIL** chỉ từ JSON MCP (\`status\`, \`summary\`, exit code) — không đoán.
8. Không in secret, token, API key, giá trị \`.env\`.
9. Nếu MCP không khả dụng → trả **\`MCP_NOT_AVAILABLE\`** + hướng dẫn Reload Window và **MCP: Show Installed Servers**.

## Ánh xạ nhanh (ưu tiên tool này)

| Việc cần làm | Tool MCP |
|--------------|----------|
| Kiểm tra Node/npm/pnpm/git | \`check_system\` |
| Xác thực workspace | \`check_workspace\` |
| Metadata dự án, framework | \`read_project_info\` |
| Liệt kê npm scripts | \`list_scripts\` |
| Build / test / lint script | \`run_project_script\` |
| Lệnh allowlist (node, git, npm…) | \`run_safe_command\` |
| Audit toàn diện | \`run_coding_session\` |
| Đọc file text (có line range) | \`read_workspace_file\` |
| Đọc file nhị phân | \`read_binary_file\` |
| Metadata file/thư mục | \`file_stats\` |
| Tìm regex trong code | \`search_workspace\` |
| Tìm ngữ nghĩa | \`semantic_search\` |
| Tìm theo glob | \`glob_workspace\` |
| Cây thư mục | \`list_workspace_tree\` |
| Sửa patch an toàn | \`apply_patch\` |
| Ghi/tạo file | \`write_workspace_file\` |
| Copy / move / xoá | \`copy_workspace_file\`, \`move_workspace_file\`, \`delete_workspace_file\`, \`delete_pattern\` |
| Tạo thư mục | \`create_directory\` |
| Format / lint / syntax | \`run_format\`, \`read_lints\`, \`check_js_syntax\` |
| Git read/write | \`git_status\`, \`git_add\`, \`git_commit\`, \`git_branch\`, \`git_checkout\`, \`git_merge\`, \`git_push\`, \`git_pull\`, \`git_init\` |
| HTTP / URL | \`check_url\`, \`fetch_url\`, \`http_request\`, \`search_web\` |
| Ảnh (mọi thao tác) | \`image_*\`, \`check_image_dependencies\`, \`generate_image\` |
| Notebook | \`edit_notebook\` |
| Chrome extension dev | \`chrome_load_extension\` |
| Debug bundle | \`collect_debug_bundle\` |
| Context / cache / token | \`get_session_context\`, \`clear_session_context\`, \`fetch_cached_output\`, \`estimate_tool_output\`, \`summarize_tool_history\` |
| Todo session | \`todo_read\`, \`todo_write\` |

## Danh sách đủ ${EXPECTED_TOOL_COUNT} tool (chuẩn server)

\`${EXPECTED_TOOLS.join("`, `")}\`

## Prompt kiểm tra nhanh

> Gọi \`check_system\`, rồi \`get_session_context\` cho workspace hiện tại. Xác nhận đủ ${EXPECTED_TOOL_COUNT} tool MCP — không dùng terminal.
`;

const targets = [
  path.join(ROOT, "templates/copilot/DMCTN-MCP.agent.md"),
  path.join(ROOT, "..", ".github/agents/DMCTN-MCP.agent.md"),
  path.join(ROOT, "..", "vscode-extension-dmctn-mcp/resources/templates/DMCTN-MCP.agent.md"),
];

for (const dest of targets) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, body, "utf8");
  console.log("wrote", dest);
}
