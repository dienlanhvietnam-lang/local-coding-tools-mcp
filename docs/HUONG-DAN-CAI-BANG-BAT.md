# Hướng dẫn cài bằng BAT (customer)

Cách nhanh nhất cho khách hàng Windows: double-click hoặc chạy `CAI-MCP.bat` từ thư mục đã giải nén.

## Yêu cầu

1. Giải nén ZIP customer vào ví dụ `E:\MCP\local-coding-tools-mcp`
2. Mở terminal trong thư mục đó:
   ```bat
   npm install
   npm run build
   ```
3. Mở workspace dự án của bạn trong VS Code (thư mục code cần làm việc)

## Cài bằng BAT

```bat
cd E:\MCP\local-coding-tools-mcp
CAI-MCP.bat
```

Script hỏi:

1. **IDE target** — chọn `vscode` (VS Code + Copilot) hoặc `cursor`
2. Nếu chọn **vscode**: *"Cài DMCTN-MCP Custom Agent để ép Copilot dùng MCP? [Y/n]"* — mặc định **Yes**

Khi chọn Yes, bootstrap gọi:

```powershell
install-vscode-mcp.ps1 -InstallCopilotAgent -ForceMcpPolicy -BackupExistingAgent -Yes
```

## Cài thủ công (PowerShell)

```powershell
powershell -ExecutionPolicy Bypass -File scripts\install-vscode-mcp.ps1 `
  -WorkspaceRoot "E:\du-an-cua-ban" `
  -ServerRoot "E:\MCP\local-coding-tools-mcp" `
  -InstallCopilotAgent -ForceMcpPolicy -Yes
```

## Sau khi cài — bắt buộc

1. **Reload VS Code**
2. Mở **Copilot Chat**
3. Chọn **Agent: DMCTN-MCP**
4. Prompt test: `Gọi check_system qua MCP local-coding-tools`

## Tại sao phải chọn DMCTN-MCP?

- Agent mặc định của Copilot vẫn có thể dùng **terminal** → lỗi `Terminal tool call was invalid`
- Agent **DMCTN-MCP** giới hạn tool list về `local-coding-tools/*` MCP
- File `.github/copilot-instructions.md` bổ sung policy cho toàn workspace

## Kiểm tra

```powershell
node scripts\verify-copilot-mcp-policy.mjs "E:\du-an-cua-ban"
```

## Khắc phục

| Triệu chứng | Cách xử lý |
|-------------|------------|
| MCP không hiện | Reload VS Code; chạy **MCP: Show Installed Servers** |
| Vẫn dùng terminal | Kiểm tra agent đang chọn có phải **DMCTN-MCP** |
| Tool call invalid | Cài lại với `-InstallCopilotAgent -ForceMcpPolicy` |

Xem thêm: [HUONG-DAN-VSCODE-COPILOT.md](./HUONG-DAN-VSCODE-COPILOT.md)
