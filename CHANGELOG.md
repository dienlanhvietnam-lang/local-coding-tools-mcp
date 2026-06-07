# Changelog

## v0.14.0 — UI/UX design tools (61 → 75 tools)

14 tools for visual UI/UX design loop + DEV GOL integration.

- **Visual:** `capture_screenshot`, `preview_html`, `compare_images`
- **Quality:** `audit_accessibility` (lite CDP / full Playwright+axe), `audit_responsive`, `page_audit`
- **Design system:** `extract_design_tokens`, `generate_palette`, `analyze_typography`, `list_ui_components`
- **DEV GOL:** `read_devgol_guide`, `suggest_ui_pattern`, `score_ui_devgol`
- **Assets:** `fetch_icon_svg`
- **Infra:** `browserResolve`, `browserCdp` (hybrid Chrome/Edge CDP), `urlGuard`, profile `ui-design-core` / `ui-design-full`
- **Agent:** UI_DESIGN_LOOP policy (extension dmctn-mcp v0.5.2, POLICY_VERSION 4)
- Docs: [UI-DESIGN-TOOLS.md](docs/UI-DESIGN-TOOLS.md), [HUONG-DAN-UI-DESIGN.md](docs/HUONG-DAN-UI-DESIGN.md)

## v0.11.2 — Customer ZIP fix

- **Customer ZIP:** thêm `scripts/expected-tools.mjs` và `hard-test-all-tools.mjs` (fix `pilot-stdio.mjs` ERR_MODULE_NOT_FOUND khi Kiểm tra MCP).
- **verify.mjs:** bắt buộc có `expected-tools.mjs` trong customer pack.

## v0.11.1 — HTTP / Chrome tools patch

Nâng cấp 3 tool có sẵn (61 tools, không thêm tool mới).

- **HTTP layer dùng chung:** `probeHttpGet()`, `httpUserAgent()` từ `SERVER_VERSION`, `DEFAULT_FETCH_MAX_BODY` (256KB).
- **`check_url`:** delegate `probeHttpGet`; thêm `finalUrl`, `contentType`, `headers`, `privateHost`; option `includeAllHeaders`.
- **`fetch_url`:** default body 256KB; thêm `headers`, `hint`, `privateHost`.
- **`chrome_load_extension`:** `resolveBrowserExecutable` (prefer chrome, Win/mac/Linux paths), `--disable-extensions-except`, profile `run-<timestamp>`, options `prefer`/`startUrl`/`reuseProfile`.
- Tests: `check-url.test.ts`, mở rộng `fetch-url` / `chrome-load` / `http-request`.

## v0.11.0 — Context Compression

Pipeline nén context kiểu Cursor để giảm token mỗi tool call (56 -> 61 tools).

- **Truncate dùng chung:** `truncateStructured` (head / head_tail) cho command, HTTP body, file read, kèm `hint` hướng dẫn lấy phần còn lại.
- **Chunk read:** `read_workspace_file` thêm `startLine`/`lineCount`/`stripContext`; `search_workspace` và `semantic_search` trả `readHint` + `contextLines`/line range.
- **Cache resource (blob indirection):** output lớn được lưu vào `.mcp-debug/cache/` và trả `cacheId` + resource `mcp-cache://{id}`; tool mới `fetch_cached_output`.
- **Session context bank:** lưu searches/reads/cache refs vào `.mcp-debug/session.json`; tool mới `get_session_context`, `clear_session_context`.
- **Token budget:** tool mới `estimate_tool_output`, `summarize_tool_history`.
- **Config qua env:** `MCP_MAX_OUTPUT_CHARS`, `MCP_READ_DEFAULT_LINES`, `MCP_READ_MAX_LINES`, `MCP_CACHE_MAX_BYTES`, `MCP_CACHE_TTL_MS`.
- **Server instructions** + install script đặt `MCP_MAX_OUTPUT_CHARS=12000`, `MCP_READ_DEFAULT_LINES=60` cho model Fast.
- Tài liệu: [docs/CONTEXT-COMPRESSION.md](docs/CONTEXT-COMPRESSION.md).
