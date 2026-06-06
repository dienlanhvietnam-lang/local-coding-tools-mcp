# Bài test KHÓ — 27 MCP tools

## A. Test tự động (khuyên dùng)

Chạy từ thư mục MCP server (bundled hoặc dev):

```powershell
cd $env:USERPROFILE\.dmctn\servers\local-coding-tools-mcp
node scripts/hard-test-27-tools.mjs D:\duong\dan\workspace-cua-ban
```

Hoặc trong repo dev:

```powershell
cd E:\MCP\local-coding-tools-mcp
npm run test:hard-27
```

**PASS khi:** `summary.overall` = `FULL_PASS` — đủ 27 tool trong `tools/list` và mọi lần gọi trả `PASS` / `PARTIAL` / `SKIPPED` / `BLOCKED` (đúng kỳ vọng).

Sandbox tạo tại: `<workspace>/.dmctn-hard-test-27/` (có thể xóa sau khi test).

---

## B. Test qua Copilot

Prompt đầy đủ (đúng tên tham số MCP, có sandbox + tiêu chí PASS):

→ **[PROMPT-COPILOT-TEST-27-TOOLS.md](./PROMPT-COPILOT-TEST-27-TOOLS.md)**

Tóm tắt: chạy `node scripts/hard-test-27-tools.mjs E:\MCP` trước, rồi copy prompt vào Copilot Chat (chỉ dùng MCP tools, không dùng Terminal).

---

## Tiêu chí chấm

| Mức | Điều kiện |
|-----|-----------|
| **FULL_PASS** | `tools/list` = 27 tên đúng chuẩn; mọi tool callable không throw |
| **PARTIAL** | Thiếu full-image → `image_upscale_ai` SKIPPED; workspace không git → `git_status` SKIPPED |
| **FAIL** | Connection closed, toolCount ≠ 27, hoặc tool trả FAIL không mong đợi |
