# Copilot instructions — BẮT BUỘC dùng MCP local-coding-tools (82 tools)

Workspace này dùng MCP server **local-coding-tools** (v0.16.x, **82 tools**). Trong Copilot Chat **phải** chọn agent **DMCTN-MCP**.

## RESPONSE_STYLE — gọn, đúng câu hỏi, không icon

- Trả lời đúng ý hỏi trước; không emoji/icon; không paste JSON tool dài.
- Tóm tắt kết quả MCP (`status` + fact chính); code block chỉ khi cần copy.
- Tiếng Việt nếu user dùng tiếng Việt; không kết bài hỏi thêm việc khác.

## MCP_ONLY — bắt buộc

- **Chỉ** gọi tools từ `local-coding-tools/*` khi agent **DMCTN-MCP** đang bật.
- **Cấm** dùng terminal/shell (`execute/*`, `runInTerminal`, `sendToTerminal`) nếu MCP có tool thay thế.
- **Cấm** dùng `read/readFile`, `edit/editFiles`, `search/codebase`, `search/textSearch` cho file trong workspace — dùng `read_workspace_file`, `apply_patch`, `write_workspace_file`, `search_workspace`, `semantic_search`, `glob_workspace`.
- **Cấm** `npm install`, `npm test`, `npm run build` qua shell — dùng `run_project_script` hoặc `run_coding_session`.
- **Cấm** `Set-Location` + chuỗi lệnh shell cho build/test.

## UI_DESIGN_LOOP — task UI/UX

Khi thiết kế/sửa/review giao diện:

1. `extract_design_tokens` trước khi sửa
2. `capture_screenshot` hoặc `preview_html` sau khi sửa (hoặc `playwright_*` khi cần tương tác)
3. `audit_accessibility` mode=lite
4. `score_ui_devgol` trước báo xong (≥ 85)
5. Thiết kế mới: `suggest_ui_pattern` trước khi code

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
| UI/UX review | `capture_screenshot`, `preview_html`, `audit_accessibility`, `compare_images`, `score_ui_devgol` |
| Playwright browser | `playwright_navigate`, `playwright_snapshot`, `playwright_screenshot`, `playwright_act`, `playwright_close` |
| output lớn / cache | `fetch_cached_output`, `estimate_tool_output` |
| bộ nhớ / chống lặp lỗi | `get_session_context`, `read_project_memory`, `write_project_memory`, `summarize_tool_history` |

## MEMORY_LOOP — chống quên / chống lặp lỗi

Đầu task (≥2 bước MCP): `get_session_context` → `read_project_memory` → `summarize_tool_history` (nếu tiếp task cũ) → `todo_read`/`todo_write`.

Sau FAIL quan trọng: `write_project_memory` action=`append_failure`. Cuối task: `append_lesson`. Không `clear_session_context` khi chưa xong.

## TODO_AUTO — bắt buộc task nhiều bước

Khi agent **DMCTN-MCP** xử lý task cần ≥2 thao tác MCP:

1. `todo_read` → `todo_write` (kế hoạch bước, một `in_progress`)
2. Sau mỗi bước → `todo_write` `merge: true` (cập nhật `completed` / `in_progress`)
3. Trước báo xong → `todo_read` (mọi todo `completed` hoặc `cancelled`)

Lưu tại `.mcp-debug/todos.json` (không có UI Copilot — vẫn phải gọi tool).

## Workflow tiết kiệm token

1. Search trước (`search_workspace` / `semantic_search`), đọc sau (`read_workspace_file` + `startLine`/`lineCount`).
2. Có `cacheId` → `fetch_cached_output`, không gọi lại tool cũ.
3. Chuyển task → `clear_session_context` + todo mới.

## Bằng chứng & an toàn

- Kết luận **PASS/FAIL** chỉ từ JSON MCP.
- Không lộ secret, API key, token, `.env`.

## Khắc phục

1. **Developer: Reload Window**
2. **MCP: Show Installed Servers** — phải thấy `local-coding-tools`
3. Copilot Chat → Agent → **DMCTN-MCP** (không dùng agent mặc định)
4. Kiểm tra `.vscode/mcp.json` và `.github/agents/DMCTN-MCP.agent.md`
