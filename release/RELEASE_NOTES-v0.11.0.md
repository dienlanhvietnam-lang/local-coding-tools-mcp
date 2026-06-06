# local-coding-tools-mcp v0.11.0

## Highlights

- **Context Compression pipeline** — giảm token mỗi tool call (56 → **61 tools**)
- Tối ưu cho **VS Code Copilot** và Cursor: env `MCP_MAX_OUTPUT_CHARS=12000`, `MCP_READ_DEFAULT_LINES=60`

## New tools

| Tool | Mô tả |
|------|-------|
| `fetch_cached_output` | Lấy output đầy đủ từ cache resource `mcp-cache://{id}` |
| `get_session_context` | Đọc context bank (searches, reads, cache refs) |
| `clear_session_context` | Xóa session context bank |
| `estimate_tool_output` | Ước lượng token trước khi gọi tool |
| `summarize_tool_history` | Tóm tắt lịch sử tool calls trong session |

## Core changes

- `truncateStructured` (head / head_tail) cho command, HTTP, file read
- Chunk read: `read_workspace_file` + `startLine`/`lineCount`/`stripContext`
- Output cache + MCP Resources; session context bank
- Config qua env: `MCP_MAX_OUTPUT_CHARS`, `MCP_READ_DEFAULT_LINES`, `MCP_CACHE_*`

## Docs

- [docs/CONTEXT-COMPRESSION.md](../docs/CONTEXT-COMPRESSION.md)
- Cập nhật `HUONG-DAN-VSCODE-COPILOT.md`, install scripts

## Verify

```bash
npm test && npm run smoke && npm run verify
```
