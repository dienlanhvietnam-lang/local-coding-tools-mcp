# Prompt Copilot — Bài test KHÓ 27 MCP tools

Copy **toàn bộ khối dưới** vào **Copilot Chat** (agent đã bật MCP server `local-coding-tools`).

**Chuẩn bị (1 lần, trước khi paste prompt):**

```powershell
cd E:\MCP\local-coding-tools-mcp
node scripts/hard-test-27-tools.mjs E:\MCP
```

Lệnh trên tạo sandbox `E:\MCP\.dmctn-hard-test-27\` (có `package.json`, `needle.txt`, `assets/source.png`). Nếu `FULL_PASS` → môi trường sẵn sàng.

**Biến dùng trong prompt:**

- `ROOT` = `E:\MCP`
- `BOX` = `E:\MCP\.dmctn-hard-test-27`
- `MCP` = `E:\MCP\local-coding-tools-mcp`

---

## PROMPT (copy từ dòng dưới)

```
BÀI TEST KHÓ — 27 MCP tools (local-coding-tools-mcp v0.7.0)

Bạn là tester MCP. Gọi LẦN LƯỢT đúng 27 tool bên dưới qua MCP (KHÔNG dùng Terminal / Shell / built-in file tools).
Sau mỗi tool: ghi 1 dòng bảng | # | tool | status | ghi chú ngắn |.

Đường dẫn cố định:
- ROOT = E:\MCP
- BOX  = E:\MCP\.dmctn-hard-test-27
- MCP  = E:\MCP\local-coding-tools-mcp
- IMG  = assets/source.png  (trong BOX)

Quy tắc chấm:
- PASS / PARTIAL / SKIPPED / BLOCKED = hợp lệ nếu đúng ngữ cảnh
- FAIL / throw / connection closed = không hợp lệ
- apply_patch / write vào .env → được phép (không còn path policy)
- git_status ngoài git repo → SKIPPED hoặc PARTIAL chấp nhận được
- image_remove_background / image_upscale_ai thiếu model → SKIPPED hoặc PARTIAL chấp nhận được

Bước 0 — Xác nhận server:
- Liệt kê tools/list (hoặc tools MCP hiện có). Phải đủ 27 tên đúng chuẩn (xem danh sách cuối prompt).
- Nếu thiếu tool → dừng, báo FAIL ngay.

=== GỌI LẦN LƯỢT 27 TOOL ===

01. check_system
    {}

02. check_workspace
    { "workspacePath": "BOX" }

03. read_project_info
    { "workspacePath": "BOX" }

04. list_scripts
    { "workspacePath": "BOX" }

05. git_status
    { "workspacePath": "BOX" }

06. read_workspace_file
    { "workspacePath": "BOX", "relativePath": "needle.txt", "maxChars": 4096 }

07. search_workspace
    { "workspacePath": "BOX", "pattern": "DMCTN_HARD_TEST", "maxResults": 5 }

08. list_workspace_tree
    { "workspacePath": "BOX", "maxDepth": 3, "maxEntries": 50 }

09. check_url
    { "url": "https://example.com", "timeoutMs": 15000 }

10. write_workspace_file
    { "workspacePath": "BOX", "relativePath": "copilot-write.txt", "content": "copilot hard-test\n" }

11. run_project_script
    { "workspacePath": "BOX", "script": "test", "timeoutMs": 60000 }

12. collect_debug_bundle
    { "workspacePath": "BOX" }

13. read_lints
    { "workspacePath": "MCP", "timeoutMs": 120000 }

14. apply_patch
    { "workspacePath": "BOX", "relativePath": "src/patch-target.txt", "oldText": "hello", "newText": "xin-chao" }

15. check_image_dependencies
    {}

16. image_info
    { "workspacePath": "BOX", "relativePath": "IMG" }

17. image_crop
    { "workspacePath": "BOX", "inputPath": "IMG", "outputPath": "out/crop.png", "left": 8, "top": 6, "width": 48, "height": 40 }

18. image_resize
    { "workspacePath": "BOX", "inputPath": "IMG", "outputPath": "out/resize.webp", "width": 64, "height": 48, "format": "webp" }

19. image_remove_background
    { "workspacePath": "BOX", "inputPath": "IMG", "outputPath": "out/nobg.png", "timeoutMs": 180000 }

20. image_adjust
    { "workspacePath": "BOX", "inputPath": "IMG", "outputPath": "out/adjust.jpg", "brightness": 1.05, "saturation": 1.1 }

21. image_composite
    { "workspacePath": "BOX", "basePath": "IMG", "overlayPath": "out/crop.png", "outputPath": "out/composite.png", "left": 4, "top": 4 }

22. image_batch
    { "workspacePath": "BOX", "operation": "resize", "inputPaths": ["IMG"], "outputDir": "out/batch", "width": 32, "height": 24, "format": "jpeg" }

23. image_text
    { "workspacePath": "BOX", "inputPath": "IMG", "outputPath": "out/text.png", "text": "DMCTN 27", "fontSize": 14, "gravity": "south" }

24. image_rounded
    { "workspacePath": "BOX", "inputPath": "IMG", "outputPath": "out/rounded.png", "radius": 16 }

25. image_upscale
    { "workspacePath": "BOX", "inputPath": "IMG", "outputPath": "out/upscale.png", "scale": 2 }

26. image_upscale_ai
    { "workspacePath": "BOX", "inputPath": "IMG", "outputPath": "out/ai-upscale.png", "scale": 2, "timeoutMs": 180000 }
    (SKIPPED/PARTIAL chấp nhận nếu thiếu Real-ESRGAN hoặc Replicate token)

27. run_coding_session
    { "workspacePath": "BOX", "runScript": true, "collectBundle": true }

=== BÁO CÁO KẾT LUẬN ===

1. Bảng đủ 27 dòng (01–27).
2. Đếm: PASS __ / PARTIAL __ / SKIPPED __ / BLOCKED __ / FAIL __
3. Tool FAIL (nếu có): tên + lỗi 1 dòng.
4. Verdict:
   - FULL_PASS: đủ 27 tool trong list + mọi lần gọi không FAIL bất ngờ
   - PARTIAL: chỉ image AI / remove-bg / git SKIPPED hoặc PARTIAL
   - FAIL: thiếu tool, connection lỗi, hoặc FAIL không mong đợi

Danh sách 27 tên chuẩn (đối chiếu tools/list):
run_coding_session, check_system, check_workspace, read_project_info, list_scripts, git_status, read_workspace_file, search_workspace, list_workspace_tree, check_url, write_workspace_file, run_project_script, collect_debug_bundle, read_lints, apply_patch, check_image_dependencies, image_info, image_crop, image_resize, image_remove_background, image_adjust, image_composite, image_batch, image_text, image_rounded, image_upscale, image_upscale_ai
```

---

## Tiêu chí PASS

| Verdict | Điều kiện |
|---------|-----------|
| **FULL_PASS** | `tools/list` = 27 tên; 27 lần gọi không FAIL bất ngờ |
| **PARTIAL** | `image_upscale_ai` / `image_remove_background` SKIPPED do thiếu CLI/API; `git_status` SKIPPED ngoài repo |
| **FAIL** | Thiếu tool, MCP disconnect, hoặc tool trả FAIL khi kỳ vọng PASS |

## So sánh test tự động

```powershell
cd E:\MCP\local-coding-tools-mcp
npm run test:hard-27
```

Script `hard-test-27-tools.mjs` chạy cùng kịch bản qua stdio — dùng để đối chiếu kết quả Copilot.
