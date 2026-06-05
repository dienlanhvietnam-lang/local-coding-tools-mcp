# Release Checklist — local-coding-tools-mcp

Dùng checklist này **mỗi lần** phát hành customer pack mới.

## 1. Automated gate (bắt buộc)

Chạy tuần tự trong thư mục dự án:

```powershell
cd E:\MCP\local-coding-tools-mcp
npm run build
npm test
npm run smoke
npm run verify
npm run verify:image-core
npm run release:customer
npm run verify:customer-zip
npm run release:gate
```

Hoặc một lệnh (release:customer đã chạy build/test/smoke/verify bên trong):

```powershell
npm run release:customer
npm run verify:customer-zip
npm run verify:image-core
npm run release:gate
```

**Tất cả phải PASS** trước khi phân phối ZIP.

## 2. Checksum

- [ ] Mở `release/SHA256SUMS.txt`
- [ ] Ghi **SHA256 mới** — không dùng checksum cũ
- [ ] SHA256 trong `SHA256SUMS.txt` khớp file ZIP thực tế (`npm run release:gate` kiểm tra tự động)

Ví dụ checksum (đọc từ `release/SHA256SUMS.txt` — không dùng checksum cũ):

```
# Phase 1.3 reference: B3E644A78CFA1D914977A09AA6FDF5F8E8146F4BCCB88062776DB1E9ED3E43D5
# Current: see release/SHA256SUMS.txt
```

## 3. ZIP hygiene

- [ ] Không có `node_modules/`, `logs/`, `.mcp-debug/`, `.git/`, `.env`
- [ ] Không có `credentials/`, `token.*`, `secret.*`
- [ ] Có `dist/`, `src/`, `tsconfig.json`, scripts cài IDE, `docs/HUONG-DAN-FULL-IMAGE.md`
- [ ] Có fixture `tests/fixtures/images/product-sample-1024.png`

## 4. MCP smoke (IDE)

Sau khi giải nén ZIP trên máy sạch:

```powershell
npm install && npm run build
powershell -File scripts\install-cursor-mcp.ps1 -EnableAllowlist
powershell -File scripts\test-mcp-install.ps1
```

- [ ] MCP panel hiển thị **27 tools**
- [ ] Không có token / `.env` trong ZIP

### Quick prompts

**VS Code Copilot:**

```
Gọi check_system qua MCP local-coding-tools
```

**Cursor:**

```
Gọi check_system qua MCP local-coding-tools
```

- [ ] `check_system` trả PASS
- [ ] `run_coding_session` trả PASS hoặc PARTIAL hợp lệ

## 5. Image profile (không bắt buộc full-image)

- [ ] `npm run verify:image-core` — **PASS** (optional tools có thể SKIPPED)
- [ ] **Không** yêu cầu Real-ESRGAN / Replicate trong release gate
- [ ] Full-image chỉ kiểm tra dependency report khi cần:

```powershell
powershell -File scripts\check-image-deps.ps1 -Profile full-image
```

## 6. CI / GitHub Actions

Push lên `main` / `develop` → workflow `.github/workflows/ci.yml` chạy trên **windows-latest + Node 24**.

Artifact sau khi PASS:

- `release/local-coding-tools-mcp-v*-customer.zip`
- `release/SHA256SUMS.txt`
- `release/release-gate-result.json`

## 7. Không làm khi release

- Không `npm publish` trừ khi có quy trình publish riêng
- Không đóng gói winget / installer exe trong customer ZIP
- Không paste token vào chat, log, hoặc commit
- Không phân phối ZIP khi `release:gate` FAIL
