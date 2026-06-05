# IDE Setup — Cursor, VS Code & Desktop Forks

`local-coding-tools-mcp` v0.3.0 chạy qua **stdio MCP**. Các IDE dưới đây đều tương thích nếu hỗ trợ MCP.

## Đường dẫn server (Windows)

```
E:\MCP\local-coding-tools-mcp\dist\server.js
```

Build trước khi dùng:

```powershell
cd E:\MCP\local-coding-tools-mcp
npm install
npm run build
```

---

## Cursor

**File:** `.cursor/mcp.json` (project) hoặc `%USERPROFILE%\.cursor\mcp.json` (global)

Copy từ `examples/cursor-mcp.json`.

**Auto-approve:** `.cursor/permissions.json`

```json
{
  "mcpAllowlist": ["local-coding-tools:*"]
}
```

Copy từ `examples/cursor-permissions.json`.

**Settings → Agent → Run Mode:** `Allowlist` hoặc `Run Everything`, rồi Reload Window.

---

## VS Code (bản chính thức)

**File:** `.vscode/mcp.json` trong workspace

Copy từ `examples/vscode-mcp.json`.

Format VS Code dùng key `servers` (không phải `mcpServers`).

Docs: [VS Code MCP](https://code.visualstudio.com/docs/copilot/customization/mcp)

---

## VSCodium / Positron / Windsurf / other VS Code forks

Hầu hết fork VS Code dùng **cùng format** `.vscode/mcp.json`:

| IDE | Config path | Ghi chú |
|-----|-------------|---------|
| **VSCodium** | `.vscode/mcp.json` | Giống VS Code nếu bật MCP extension |
| **Windsurf** | `.windsurf/mcp.json` hoặc `.cursor/mcp.json` | Kiểm tra docs IDE |
| **Positron** | `.vscode/mcp.json` | VS Code-compatible |
| **GitHub Copilot in VS Code** | `.vscode/mcp.json` | Dùng `servers` schema |

Điều chỉnh `command` / `args` nếu `node` không có trong PATH — dùng đường dẫn đầy đủ tới `node.exe`.

---

## Kiểm tra sau cài

Prompt test:

```
Dùng MCP local-coding-tools: run_coding_session cho workspace hiện tại, rồi read_lints.
```

Hoặc chạy E2E local:

```powershell
npm run test:e2e
```

Kỳ vọng: **15 tools** trong `tools/list`.
