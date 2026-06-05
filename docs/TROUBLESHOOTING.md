# Xử lý sự cố MCP

## Không thấy server / tools

| Triệu chứng | Cách xử lý |
|-------------|------------|
| MCP trống | Reload window; kiểm tra `.vscode/mcp.json` hoặc `.cursor/mcp.json` |
| Server đỏ / disconnected | Chạy `npm run build`; kiểm tra đường dẫn `dist/server.js` |
| Sai workspace | Chạy lại install script với `-WorkspaceRoot` đúng |

```powershell
powershell -File scripts\test-mcp-install.ps1 -ServerRoot "E:\MCP\local-coding-tools-mcp"
```

## node not found

```
'node' is not recognized...
```

- Cài [Node.js LTS](https://nodejs.org/)
- Mở terminal mới, chạy `node --version`
- Trên Windows: thêm Node vào PATH hệ thống

## dist/server.js missing

```powershell
cd E:\MCP\local-coding-tools-mcp
npm install
npm run build
```

Install script sẽ **FAIL** nếu thiếu `dist/server.js`.

## Copilot / Cursor vẫn hỏi Allow

- **VS Code Copilot**: Allow từng lần là bình thường.
- **Cursor**: dùng `-EnableAllowlist` + Run Mode **Allowlist**, không dùng Run Everything.

## Image tool dependency

### image-core (mặc định) — SKIPPED là bình thường

`image_remove_background` / `image_upscale_ai` trả **SKIPPED** (không phải FAIL) khi thiếu rembg, Real-ESRGAN, hoặc API token.

```powershell
powershell -File scripts\check-image-deps.ps1 -Profile image-core
```

### full-image — bắt buộc đủ dependency

```powershell
npm run verify:image-full
powershell -File scripts\check-image-deps.ps1 -Profile full-image
```

### Cài thêm

```powershell
powershell -File scripts\install-image-deps.ps1 -InstallRembg
setx REPLICATE_API_TOKEN "your-token"
```

Xem [HUONG-DAN-FULL-IMAGE.md](./HUONG-DAN-FULL-IMAGE.md).

### rembg pip FAIL

Cài Python 3.10+ từ python.org, mở terminal mới, chạy lại `-InstallRembg`.

### Token configured nhưng vẫn FAIL

Token sai hoặc hết quota — kiểm tra Replicate/remove.bg dashboard. Log/output **không** in giá trị token.

## write_workspace_file / apply_patch bị BLOCKED

Server chỉ cho ghi trong allowlist: `src/`, `tests/`, `assets/`, `public/`, `scripts/`, v.v.

- Không ghi `.env`, `node_modules/`, thư mục ngoài workspace
- Đọc thông báo lỗi tool — thường ghi rõ path bị chặn

## git_status SKIPPED

Không phải lỗi — workspace không phải git repo hoặc git không có trong PATH.

## Kiểm tra log

```
logs/mcp-tool-calls.jsonl
```

(secret đã được redact)

## Liên hệ / báo lỗi

Chạy bundle debug:

> Gọi MCP tool `collect_debug_bundle` (không gửi file `.env`).

Kèm output `test-mcp-install.ps1` và phiên bản `check_system`.
