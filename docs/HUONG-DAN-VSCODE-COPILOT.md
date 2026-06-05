# Hướng dẫn VS Code + Copilot MCP

**local-coding-tools-mcp** v0.7.0 — 26 tools (coding + image).

## Yêu cầu

- Node.js 18+ (`node --version`)
- Đã build: `npm install && npm run build` trong thư mục server
- VS Code với Copilot / MCP hỗ trợ `mcp.json`

## Cài nhanh

```powershell
cd E:\MCP\local-coding-tools-mcp
npm install
npm run build

# Trong thư mục workspace dự án của bạn:
powershell -ExecutionPolicy Bypass -File E:\MCP\local-coding-tools-mcp\scripts\install-vscode-mcp.ps1 `
  -WorkspaceRoot "E:\du-an-cua-ban" `
  -ServerRoot "E:\MCP\local-coding-tools-mcp"
```

Script tạo `.vscode/mcp.json`. File cũ được backup `mcp.json.bak-YYYYMMDD-HHMMSS`.

## Reload

1. **Developer: Reload Window** (Ctrl+Shift+P)
2. Mở Copilot Chat → kiểm tra MCP tools / server `local-coding-tools`

## Kiểm tra tools

```powershell
powershell -ExecutionPolicy Bypass -File scripts\test-mcp-install.ps1 `
  -ServerRoot "E:\MCP\local-coding-tools-mcp" `
  -VscodeWorkspace "E:\du-an-cua-ban"
```

Hoặc trong Copilot, hỏi:

> Liệt kê MCP tools từ server local-coding-tools và gọi check_system.

## Prompt test gợi ý

| Mục đích | Prompt |
|----------|--------|
| Hệ thống | `Gọi check_system qua MCP local-coding-tools` |
| Workspace | `Gọi check_workspace với workspaceRoot là thư mục hiện tại` |
| Đọc file | `Dùng read_workspace_file đọc package.json` |
| Git | `Gọi git_status` |

## Lưu ý Copilot Allow

Copilot có thể hỏi **Allow** mỗi lần gọi tool — đây là hành vi mặc định VS Code, không phải lỗi server.

## Không dùng script Cursor

`install-vscode-mcp.ps1` **không** sửa `.cursor/`. Dùng `install-cursor-mcp.ps1` nếu bạn dùng Cursor.

Xem thêm: [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
