# Hướng dẫn Full Image Install Profile

**local-coding-tools-mcp** v0.7.0 — 27 MCP tools (gồm `check_image_dependencies`).

## 1. Full Image là gì?

**Full Image** (`full-image` profile) là bộ cài đặt đầy đủ cho xử lý ảnh nâng cao:

- **Remove background** — `image_remove_background` (rembg, @imgly/background-removal-node, hoặc `REMOVE_BG_API_KEY`)
- **AI upscale** — `image_upscale_ai` (Real-ESRGAN CLI hoặc Replicate API)

Khi đủ dependency, verify full-image **PASS**. Khi thiếu dependency bắt buộc, verify **FAIL** với lý do rõ ràng — không chạy tool ảnh nặng nếu dependency chưa sẵn sàng.

## 2. image-core khác full-image thế nào

| Profile | Mô tả | Thiếu optional dep |
|---------|--------|---------------------|
| **image-core** (mặc định) | Sharp + 9 core tools — dùng ngay sau `npm install && npm run build` | `image_remove_background` / `image_upscale_ai` → **SKIPPED** (không lỗi server) |
| **full-image** | Core + remove background + AI upscale bắt buộc PASS | Verify **FAIL** nếu thiếu rembg/imgly/API hoặc Real-ESRGAN/Replicate |

**Image core — PASS ngay:**

`image_info`, `image_resize`, `image_crop`, `image_adjust`, `image_text`, `image_rounded`, `image_composite`, `image_batch`, `image_upscale`

## 3. Cài rembg

Yêu cầu **Python 3.10+** và **pip** đã cài sẵn — script **không** tự cài Python.

```powershell
powershell -ExecutionPolicy Bypass -File scripts\install-image-deps.ps1 -InstallRembg
```

Bỏ qua confirm (CI / automation):

```powershell
powershell -ExecutionPolicy Bypass -File scripts\install-image-deps.ps1 -InstallRembg -Yes
```

Script chạy:

```text
python -m pip install --upgrade pip
python -m pip install rembg
```

## 4. Kiểm tra dependency

Bảng **Component | Status | Detail | Fix**:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\check-image-deps.ps1 -Profile image-core
powershell -ExecutionPolicy Bypass -File scripts\check-image-deps.ps1 -Profile full-image
```

JSON cho CI:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\check-image-deps.ps1 -Profile full-image -Json
```

Chỉ kiểm tra, không cài:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\install-image-deps.ps1 -CheckOnly
```

Verify local (dependency trước, rồi mới chạy image tools):

```powershell
powershell -ExecutionPolicy Bypass -File scripts\verify-full-image-local.ps1 -RequireFullImage
```

Hoặc MCP tool: `check_image_dependencies` (không in giá trị token).

```powershell
npm run verify:image-core
npm run verify:image-full
npm run verify:full-image-local
```

## 5. Replicate (cloud — tùy chọn)

Người dùng **tự** set token — script không nhập/lưu token, không paste token vào chat/log:

```powershell
setx REPLICATE_API_TOKEN "your-token-here"
```

Mở terminal mới sau `setx`. Chỉ hướng dẫn:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\install-image-deps.ps1 -UseReplicate
```

## 6. Real-ESRGAN (cài thủ công)

Script **không** tải binary. Chỉ kiểm tra PATH và in hướng dẫn:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\install-image-deps.ps1 -InstallRealEsrgan
```

1. Tải từ [Real-ESRGAN-ncnn-vulkan releases](https://github.com/xinntao/Real-ESRGAN-ncnn-vulkan/releases)
2. Giải nén vào thư mục cố định (ví dụ `C:\Tools\realesrgan-ncnn-vulkan`)
3. Thêm thư mục chứa `realesrgan-ncnn-vulkan.exe` vào **PATH**
4. Mở terminal mới, chạy lại `check-image-deps.ps1 -Profile full-image`

## 7. Lỗi thường gặp

| Triệu chứng | Nguyên nhân | Cách xử lý |
|-------------|-------------|------------|
| **Python not found** | Chưa cài Python | Cài Python 3.10+ từ python.org, tick "Add to PATH", mở terminal mới |
| **pip not found** | pip chưa có | `python -m ensurepip --upgrade` hoặc cài lại Python |
| **rembg install fail** | pip/network/phiên bản Python | Chạy lại `-InstallRembg -Yes`; kiểm tra `python --version` |
| **AI upscale SKIPPED** (image-core) | Bình thường khi thiếu Real-ESRGAN/token | Cài Real-ESRGAN hoặc `setx REPLICATE_API_TOKEN` |
| **full-image FAIL** | Thiếu removeBackground hoặc aiUpscale | Xem bảng check-image-deps, làm theo cột Fix |
| **Token configured nhưng API lỗi** | Token sai/hết quota | Kiểm tra Replicate dashboard; output không in token |

## 8. Quay lại image-core

Nếu không cần full-image:

- Dùng `npm run verify:image-core` thay vì `verify:image-full`
- Không cần gỡ rembg — optional tools chỉ **SKIPPED** khi thiếu dep
- Xóa token (tùy chọn): `setx REPLICATE_API_TOKEN ""` và mở terminal mới
- IDE/MCP: không cần đổi cấu hình — profile là lệnh verify/check, không phải server mode

## Full image một lệnh (sau khi có Python)

```powershell
powershell -ExecutionPolicy Bypass -File scripts\install-image-deps.ps1 -InstallRembg -UseReplicate -InstallRealEsrgan -FullImage -Yes
```

Xem thêm: [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
