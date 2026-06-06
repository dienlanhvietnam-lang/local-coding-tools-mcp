# Hướng dẫn VS Code + Copilot MCP

**local-coding-tools-mcp** v0.11.0 — 61 tools (coding + image + context compression).

## Yêu cầu

- Node.js 18+ (`node --version`)
- Đã build: `npm install && npm run build` trong thư mục server
- VS Code với Copilot / MCP hỗ trợ `mcp.json`

## Cài nhanh (MCP + DMCTN-MCP policy)

```powershell
cd E:\MCP\local-coding-tools-mcp
npm install
npm run build

# Trong thư mục workspace dự án của bạn:
powershell -ExecutionPolicy Bypass -File E:\MCP\local-coding-tools-mcp\scripts\install-vscode-mcp.ps1 `
  -WorkspaceRoot "E:\du-an-cua-ban" `
  -ServerRoot "E:\MCP\local-coding-tools-mcp" `
  -InstallCopilotAgent `
  -ForceMcpPolicy `
  -Yes
```

Hoặc dùng BAT: [HUONG-DAN-CAI-BANG-BAT.md](./HUONG-DAN-CAI-BANG-BAT.md)

Script tạo:

| File | Mục đích |
|------|----------|
| `.vscode/mcp.json` | Kết nối MCP server `local-coding-tools` |
| `.github/agents/DMCTN-MCP.agent.md` | Custom agent — **ép** tool list về `local-coding-tools/*` |
| `.github/copilot-instructions.md` | Policy workspace cho Copilot |

File cũ được backup `*.bak-YYYYMMDD-HHMMSS` (không ghi đè im lặng).

## Sau khi cài — bắt buộc chọn Agent DMCTN-MCP

1. **Developer: Reload Window** (Ctrl+Shift+P)
2. Mở **Copilot Chat**
3. Chọn **Agent: DMCTN-MCP** (không dùng agent mặc định)
4. Chạy prompt test: `Gọi check_system qua MCP local-coding-tools`

### Tại sao cần DMCTN-MCP?

- Agent **mặc định** của Copilot vẫn có thể gọi **terminal** → lỗi `Terminal tool call was invalid`
- Agent **DMCTN-MCP** giới hạn tools về MCP `local-coding-tools/*`
- Instructions mapping build/test → `run_project_script`, audit → `run_coding_session`

## Kiểm tra MCP server

```powershell
# Command Palette: MCP: Show Installed Servers
# Phải thấy server local-coding-tools
```

## Kiểm tra policy files

```powershell
node E:\MCP\local-coding-tools-mcp\scripts\verify-copilot-mcp-policy.mjs "E:\du-an-cua-ban"
```

```powershell
powershell -ExecutionPolicy Bypass -File scripts\test-mcp-install.ps1 `
  -ServerRoot "E:\MCP\local-coding-tools-mcp" `
  -VscodeWorkspace "E:\du-an-cua-ban"
```

## Prompt test gợi ý

| Mục đích | Prompt |
|----------|--------|
| Hệ thống | `Gọi check_system qua MCP local-coding-tools` |
| Workspace | `Gọi check_workspace với workspaceRoot là thư mục hiện tại` |
| Đọc file | `Dùng read_workspace_file đọc package.json` |
| Build/test | `Dùng run_project_script chạy script test` |
| Audit | `Dùng run_coding_session cho workspace hiện tại` |
| Git | `Gọi git_status` |

## Context budget (tiết kiệm token)

Server đặt sẵn `env` trong `.vscode/mcp.json` (`MCP_MAX_OUTPUT_CHARS=12000`, `MCP_READ_DEFAULT_LINES=60`) để output gọn cho Copilot. Workflow khuyến nghị: search trước, đọc theo dòng, dùng cache resource khi output lớn. Chi tiết: [CONTEXT-COMPRESSION.md](./CONTEXT-COMPRESSION.md).

| Mục đích | Prompt |
|----------|--------|
| Search trước | `Dùng search_workspace tìm "config", rồi read_workspace_file theo readHint (startLine + lineCount)` |
| Output lớn | `Nếu kết quả có cacheId, dùng fetch_cached_output để đọc đầy đủ` |
| Tiếp tục việc | `Gọi get_session_context để xem search/read gần đây` |
| Ước token | `Gọi estimate_tool_output trước khi đọc file lớn` |

Tinh chỉnh thêm bằng env: `MCP_READ_MAX_LINES`, `MCP_CACHE_MAX_BYTES`, `MCP_CACHE_TTL_MS`.

## Khắc phục

| Vấn đề | Cách xử lý |
|--------|------------|
| MCP không hiện | Reload VS Code; **MCP: Show Installed Servers** |
| Terminal tool invalid | Chọn agent **DMCTN-MCP**, không dùng agent mặc định |
| Tool vẫn sai | Kiểm tra `.github/agents/DMCTN-MCP.agent.md` và `tools: local-coding-tools/*` |
| Cài lại | Chạy lại installer với `-InstallCopilotAgent -ForceMcpPolicy -Yes` |

## Lưu ý Copilot Allow

Copilot có thể hỏi **Allow** mỗi lần gọi tool — đây là hành vi mặc định VS Code, không phải lỗi server.

## Không dùng script Cursor

`install-vscode-mcp.ps1` **không** sửa `.cursor/`. Dùng `install-cursor-mcp.ps1` nếu bạn dùng Cursor.

Xem thêm: [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) · [CHECKLIST-VSCODE-COPILOT.md](../pilot-kit/CHECKLIST-VSCODE-COPILOT.md)
