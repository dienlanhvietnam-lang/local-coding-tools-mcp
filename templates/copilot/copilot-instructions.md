# Copilot instructions — BẮT BUỘC dùng MCP local-coding-tools (61 tools)

Workspace này dùng MCP server **local-coding-tools** (v0.11.x, **61 tools**). Trong Copilot Chat **phải** chọn agent **DMCTN-MCP**.

## MCP_ONLY — bắt buộc

- **Chỉ** gọi tools từ `local-coding-tools/*` khi agent **DMCTN-MCP** đang bật.
- **Cấm** dùng terminal/shell (`execute/*`, `runInTerminal`, `sendToTerminal`) nếu MCP có tool thay thế.
- **Cấm** dùng `read/readFile`, `edit/editFiles`, `search/codebase`, `search/textSearch` cho file trong workspace — dùng `read_workspace_file`, `apply_patch`, `write_workspace_file`, `search_workspace`, `semantic_search`, `glob_workspace`.
- **Cấm** `npm install`, `npm test`, `npm run build` qua shell — dùng `run_project_script` hoặc `run_coding_session`.
- **Cấm** `Set-Location` + chuỗi lệnh shell cho build/test.

## Ánh xạ tác vụ → MCP tool

| Ý định người dùng | Tool MCP |
|-------------------|----------|
| build, test, verify, smoke, lint, typecheck | `run_project_script` |
| lệnh node/git/npm allowlist | `run_safe_command` |
| audit / health check / debug prep | `run_coding_session` |
| đọc file (có line range) | `read_workspace_file` |
| tìm code | `search_workspace`, `semantic_search`, `glob_workspace` |
| sửa file an toàn | `apply_patch`, `write_workspace_file` |
| git | `git_*` tools |
| HTTP / web | `check_url`, `fetch_url`, `http_request`, `search_web` |
| ảnh | `image_*`, `check_image_dependencies`, `generate_image` |
| output lớn / cache | `fetch_cached_output`, `estimate_tool_output` |
| tiếp tục phiên | `get_session_context`, `summarize_tool_history` |

## Workflow tiết kiệm token

1. Search trước (`search_workspace` / `semantic_search`), đọc sau (`read_workspace_file` + `startLine`/`lineCount`).
2. Có `cacheId` → `fetch_cached_output`, không gọi lại tool cũ.
3. Chuyển task → `clear_session_context`.

## Bằng chứng & an toàn

- Kết luận **PASS/FAIL** chỉ từ JSON MCP.
- Không lộ secret, API key, token, `.env`.

## Khắc phục

1. **Developer: Reload Window**
2. **MCP: Show Installed Servers** — phải thấy `local-coding-tools`
3. Copilot Chat → Agent → **DMCTN-MCP** (không dùng agent mặc định)
4. Kiểm tra `.vscode/mcp.json` và `.github/agents/DMCTN-MCP.agent.md`
