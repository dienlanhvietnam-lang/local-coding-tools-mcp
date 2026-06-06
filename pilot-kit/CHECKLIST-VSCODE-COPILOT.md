# Checklist — VS Code Copilot + DMCTN-MCP

## Trước khi cài

- [ ] Node.js 18+ (`node --version`)
- [ ] `npm install && npm run build` trong thư mục server MCP
- [ ] Biết đường dẫn workspace dự án khách hàng

## Cài MCP + policy

- [ ] Chạy `install-vscode-mcp.ps1` với `-InstallCopilotAgent -ForceMcpPolicy -Yes`
- [ ] Hoặc chạy `CAI-MCP.bat` → chọn VS Code → Yes cho DMCTN-MCP agent
- [ ] `.vscode/mcp.json` được tạo
- [ ] `.github/agents/DMCTN-MCP.agent.md` được tạo
- [ ] `.github/copilot-instructions.md` được tạo
- [ ] `node scripts/verify-copilot-mcp-policy.mjs <workspace>` → PASS

## Sau khi cài (bắt buộc)

- [ ] **Reload VS Code** (Developer: Reload Window)
- [ ] Mở **Copilot Chat**
- [ ] Chọn **Agent: DMCTN-MCP** (không dùng agent mặc định)
- [ ] Chạy prompt test: `Gọi check_system qua MCP local-coding-tools`

## Xác nhận MCP

- [ ] **MCP: Show Installed Servers** → có `local-coding-tools`
- [ ] Copilot gọi MCP tool, không báo `Terminal tool call was invalid`
- [ ] Build/test qua `run_project_script`, không qua terminal tự do

## Nếu lỗi

- [ ] Kiểm tra agent đang chọn có phải **DMCTN-MCP** không
- [ ] Kiểm tra `dist/server.js` tồn tại trong ServerRoot
- [ ] Xem [HUONG-DAN-VSCODE-COPILOT.md](../docs/HUONG-DAN-VSCODE-COPILOT.md) và [TROUBLESHOOTING.md](../docs/TROUBLESHOOTING.md)
