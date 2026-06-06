# Changelog

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
