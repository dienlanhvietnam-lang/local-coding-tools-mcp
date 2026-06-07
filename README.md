# Local Coding Tools MCP

**v0.14.0** — MCP stdio server: **coding + image editing + UI/UX design** cho Cursor / VS Code.

**75 tools** | npm publish ready | winget template included

## UI design tools (v0.14.0)

| Nhóm | Tools |
|------|-------|
| Screenshot / preview | `capture_screenshot`, `preview_html`, `compare_images` |
| A11y / responsive | `audit_accessibility`, `audit_responsive`, `page_audit` |
| Design tokens | `extract_design_tokens`, `generate_palette`, `analyze_typography` |
| DEV GOL | `read_devgol_guide`, `suggest_ui_pattern`, `score_ui_devgol` |
| Components / icons | `list_ui_components`, `fetch_icon_svg` |

Hybrid engine: Chrome/Edge hệ thống (CDP) mặc định; Playwright+axe optional (`npm run verify:ui-design-full`). Xem **[docs/HUONG-DAN-UI-DESIGN.md](docs/HUONG-DAN-UI-DESIGN.md)**.

## Context compression (v0.11.0)

Pipeline nén context kiểu Cursor: search trước, đọc theo dòng, cache resource khi output lớn. Xem **[docs/CONTEXT-COMPRESSION.md](docs/CONTEXT-COMPRESSION.md)**.

| Nhóm | Tools |
|------|-------|
| Chunk read | `read_workspace_file` (`startLine`/`lineCount`/`stripContext`) |
| Cache resource | `fetch_cached_output` + resource `mcp-cache://{id}` |
| Session bank | `get_session_context`, `clear_session_context` |
| Token budget | `estimate_tool_output`, `summarize_tool_history` |

Env tinh chỉnh: `MCP_MAX_OUTPUT_CHARS`, `MCP_READ_DEFAULT_LINES`, `MCP_READ_MAX_LINES`, `MCP_CACHE_MAX_BYTES`, `MCP_CACHE_TTL_MS`.

## HTTP tools (v0.11.1)

| Tool | Dùng khi | Output chính |
|------|----------|--------------|
| `check_url` | Health check nhanh, không cần body | status, timing, redirects, headers (subset) |
| `fetch_url` | GET đơn giản + body (default 256KB) | status, headers, body, `hint` khi truncate |
| `http_request` | REST đầy đủ (method/header/body) | status, headers, body tùy method |

`chrome_load_extension`: sideload unpacked extension; mặc định ưu tiên Chrome, profile `run-<timestamp>`. Ví dụ: `{ prefer: "chrome", extensionPath: "my-ext" }`.

## Tools moi v0.10.0 (37 -> 56)

| Nhom | Tools |
|------|-------|
| Quality | `check_js_syntax`, `run_format` |
| FS batch | `read_binary_file`, `copy_workspace_file`, `delete_pattern` (dryRun mac dinh), `create_directory`, `file_stats` |
| Search | `glob_workspace` (pattern `**/*.ts`), `semantic_search` (embeddings/keyword fallback) |
| Network | `http_request` (GET/POST/PUT/PATCH/DELETE/HEAD, body 256KB) |
| Git nang cao | `git_push`, `git_pull`, `git_branch`, `git_checkout`, `git_merge` |
| Meta | `edit_notebook` (.ipynb), `todo_write` / `todo_read` (MCP-only) , `generate_image` (OpenAI/Replicate) |

`run_safe_command` mo rong allowlist: them `npx`, `pip`, `go`, `curl`, `docker`, `cargo`, `dotnet`, `yarn`, `bun`, `tsc`, `eslint`, `prettier`.

### Meta Cursor KHONG ho tro (host-only)

MCP stdio khong dieu khien vong lap agent / UI cua Cursor, nen 5 tool sau **khong** the la MCP tool — chung la ha tang host:

| Tool | Ly do |
|------|-------|
| `Task` (subagent) | Spawn subagent thuoc agent loop host |
| `SwitchMode` | Doi Plan/Agent mode cua Cursor |
| `CreatePlan` | Tao plan UI cua Cursor |
| `Await` | Cho background shell/task cua host |
| `AskQuestion` | Form hoi user trong UI host |

### Env keys tuy chon

| Variable | Tool |
|----------|------|
| `BRAVE_SEARCH_API_KEY` / `SERPER_API_KEY` | `search_web` |
| `OPENAI_API_KEY` / `REPLICATE_API_TOKEN` | `generate_image` |
| `OPENAI_API_KEY` / `VOYAGE_API_KEY` | `semantic_search` (embeddings) |
| `REPLICATE_API_TOKEN` | `image_upscale_ai` |

## Image profiles

| Profile | Command | Notes |
|---------|---------|-------|
| **image-core** (default) | `npm run verify:image-core` | Core sharp tools; optional tools return **SKIPPED** if deps missing |
| **full-image** | `npm run verify:image-full` | Requires rembg/Real-ESRGAN/Replicate — **FAIL** if missing |

### Full Image Dependency Installer (Phase 1.3)

| Action | Command |
|--------|---------|
| Check deps (table) | `powershell -ExecutionPolicy Bypass -File scripts\check-image-deps.ps1 -Profile full-image` |
| Check JSON (CI) | `powershell -ExecutionPolicy Bypass -File scripts\check-image-deps.ps1 -Profile full-image -Json` |
| Install rembg | `powershell -ExecutionPolicy Bypass -File scripts\install-image-deps.ps1 -InstallRembg` |
| Check only | `powershell -ExecutionPolicy Bypass -File scripts\install-image-deps.ps1 -CheckOnly` |
| Verify local | `powershell -ExecutionPolicy Bypass -File scripts\verify-full-image-local.ps1 -RequireFullImage` |

```powershell
powershell -ExecutionPolicy Bypass -File scripts\check-image-deps.ps1 -Profile image-core
powershell -ExecutionPolicy Bypass -File scripts\install-image-deps.ps1 -InstallRembg
npm run verify:image-core
npm run verify:full-image-local
```

See **[docs/HUONG-DAN-FULL-IMAGE.md](docs/HUONG-DAN-FULL-IMAGE.md)**.

### Standard vs Full Image

- **Standard (image-core):** `npm install && npm run build` — ready immediately for resize/crop/text/batch/upscale.
- **Full image:** add rembg (`-InstallRembg`), Real-ESRGAN (manual PATH), or `REPLICATE_API_TOKEN`.

**Troubleshooting:** `image_remove_background` / `image_upscale_ai` showing **SKIPPED** in image-core is expected without optional deps. In full-image profile, missing deps cause verify **FAIL**.

## Image tools (13 + check)

| Tool | Mô tả |
|------|--------|
| `image_info` / `image_crop` / `image_resize` | Cơ bản |
| `image_ocr` | OCR text (Tesseract.js eng/vie, offline tessdata) |
| `image_remove_background` | imgly-node / rembg / remove.bg |
| `image_adjust` / `image_composite` / `image_batch` | Chỉnh sửa nâng cao |
| `image_text` / `image_rounded` | Caption, bo góc, avatar tròn |
| `image_upscale` | Lanczos3 (sharp) |
| **`image_upscale_ai`** | **Real-ESRGAN AI** — SKIPPED if no CLI/token (image-core OK) |
| **`check_image_dependencies`** | Probe sharp/rembg/Real-ESRGAN/Replicate (no secrets printed) |

### AI generative upscale

| Mode | Engine |
|------|--------|
| `cli` / `auto` | [realesrgan-ncnn-vulkan](https://github.com/xinntao/Real-ESRGAN-ncnn-vulkan) on PATH |
| `api` / `auto` | Replicate Real-ESRGAN — env `REPLICATE_API_TOKEN` |

## Coding tools (28)

**Audit / read:** `run_coding_session`, `check_system`, `check_workspace`, `read_project_info`, `list_scripts`, `read_workspace_file`, `search_workspace`, `list_workspace_tree`, `read_lints`, `git_status`, `check_url`, `fetch_url`, `search_web`, `collect_debug_bundle`

**Context budget:** `fetch_cached_output`, `get_session_context`, `clear_session_context`, `estimate_tool_output`, `summarize_tool_history`

**Write / FS:** `apply_patch`, `write_workspace_file`, `delete_workspace_file`, `move_workspace_file`

**Execute:** `run_project_script`, `run_safe_command` (allowlist: node, npm, pnpm, git, python, powershell)

**Git write:** `git_init`, `git_add`, `git_commit` (no push)

**Browser dev:** `chrome_load_extension` (unpacked sideload, temp profile)

### Optional env for `search_web`

| Variable | Provider |
|----------|----------|
| `BRAVE_SEARCH_API_KEY` | Brave Search API (preferred) |
| `SERPER_API_KEY` | Serper Google API |
| *(none)* | DuckDuckGo Lite HTML (may SKIPPED if blocked) |

## Install

```powershell
cd E:\MCP\local-coding-tools-mcp
npm install && npm run build
```

### Global local install

```powershell
.\installer\scripts\install-winget-local.ps1
```

### After npm publish

```powershell
npm install -g local-coding-tools-mcp
```

```json
{
  "mcpServers": {
    "local-coding-tools": {
      "command": "local-coding-tools-mcp",
      "args": []
    }
  }
}
```

## Publish npm + winget

See **[docs/PUBLISH.md](docs/PUBLISH.md)**

```powershell
npm run publish:check
npm publish --access public
.\installer\scripts\build-portable-win.ps1
```

## CI / Release Gate (Phase 1.4)

GitHub Actions (`.github/workflows/ci.yml`) runs on **windows-latest + Node 24**:

`build` → `test` → `smoke` → `verify` → `verify:image-core` → `release:customer` → `verify:customer-zip` → `release:gate`

- **Full-image is not required in CI** — optional dependency report only (`check-image-deps.mjs --profile full-image`, non-blocking).
- On success, artifacts upload: customer ZIP, `SHA256SUMS.txt`, `release-gate-result.json`.

### Local release commands

```powershell
npm run build
npm test
npm run smoke
npm run verify
npm run verify:image-core
npm run release:customer
npm run verify:customer-zip
npm run release:gate
```

See **[docs/RELEASE-CHECKLIST.md](docs/RELEASE-CHECKLIST.md)**.

## Release customer pack

Automated pipeline (build → test → smoke → verify → ZIP → SHA256):

```powershell
npm run release:customer
```

Output:

- `release/local-coding-tools-mcp-v0.9.0-customer.zip`
- `release/SHA256SUMS.txt`
- `release/release-gate-result.json`
- `release/RELEASE_NOTES-v0.9.0.md`

Verify ZIP on a simulated clean machine:

```powershell
npm run verify:customer-zip
npm run release:gate
# or: node scripts/verify-customer-zip-clean.mjs path\to\zip.zip --keep
```

### Public pilot checklist

- [ ] Download **latest** customer ZIP — check `release/SHA256SUMS.txt`
- [ ] **Do not** use old ZIP `ADD30FF...` (Phase 0.8 — missing src/tsconfig/smoke fixture)
- [ ] Use current ZIP SHA256 from `SHA256SUMS.txt` (latest: `49618037...` or newer)
- [ ] `npm install && npm run build` in extracted folder
- [ ] Run `install-vscode-mcp.ps1` and/or `install-cursor-mcp.ps1`
- [ ] Reload IDE; confirm **37 tools** in MCP panel
- [ ] Test prompt: `Gọi check_system qua MCP local-coding-tools`
- [ ] Cursor: avoid Run Everything; use Allowlist if needed (`-EnableAllowlist`)

See [docs/HUONG-DAN-VSCODE-COPILOT.md](docs/HUONG-DAN-VSCODE-COPILOT.md) and [docs/HUONG-DAN-CURSOR.md](docs/HUONG-DAN-CURSOR.md).

## Scripts

| Script | Description |
|--------|-------------|
| `npm test` | Unit + image profile tests |
| `npm run test:e2e` | 37 MCP tools (E2E) |
| `npm run test:hard-all` | Hard test — call all 37 tools |
| `npm run verify:image-deps` | Image dependency scripts smoke |
| `npm run verify:image-core` | Image core profile verify |
| `npm run verify:image-full` | Full image profile verify |
| `npm run verify:full-image-local` | Deps check + image-core + full-image verify |
| `npm run release:customer` | Full customer release pipeline |
| `npm run release:gate` | Final ZIP + tool-count + SHA256 gate |
| `npm run verify:customer-zip` | Clean-machine ZIP verification |
| `npm run validate:ci` | Validate GitHub Actions workflow YAML |
| `npm run publish:check` | Pre-publish validation |

## License

MIT
