# Hướng dẫn Cursor MCP

**local-coding-tools-mcp** v0.7.0 — 26 tools.

## Yêu cầu

- Node.js 18+
- `npm install && npm run build` trong thư mục server

## Cài nhanh

```powershell
cd E:\MCP\local-coding-tools-mcp
npm install
npm run build

powershell -ExecutionPolicy Bypass -File scripts\install-cursor-mcp.ps1 `
  -WorkspaceRoot "E:\MCP" `
  -ServerRoot "E:\MCP\local-coding-tools-mcp"
```

### Tùy chọn: auto-approve (allowlist)

```powershell
powershell -ExecutionPolicy Bypass -File scripts\install-cursor-mcp.ps1 `
  -WorkspaceRoot "E:\MCP" `
  -ServerRoot "E:\MCP\local-coding-tools-mcp" `
  -EnableAllowlist
```

Sau đó: **Settings → Agent → Run Mode → Allowlist**.

**Không bật `-EnableAllowlist`** = không tự approve — an toàn hơn, bạn confirm từng tool.

## Cảnh báo bảo mật

- **Không** dùng **Run Everything** trừ khi bạn hoàn toàn tin server này.
- Khuyến nghị: **Allowlist** + chỉ `local-coding-tools:*`.

## Reload

**Developer: Reload Window** hoặc restart Cursor.

## Kiểm tra

```powershell
powershell -ExecutionPolicy Bypass -File scripts\test-mcp-install.ps1 `
  -ServerRoot "E:\MCP\local-coding-tools-mcp" `
  -CursorWorkspace "E:\MCP"
```

Trong Agent chat:

> Gọi check_system và list_scripts qua MCP local-coding-tools.

## Prompt test

```
Dùng MCP local-coding-tools: check_workspace, read_project_info, search_workspace với query "config".
```

## Schema tạo ra

`.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "local-coding-tools": {
      "command": "node",
      "args": ["<ServerRoot>\\dist\\server.js"],
      "cwd": "<ServerRoot>"
    }
  }
}
```

Xem lỗi thường gặp: [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
