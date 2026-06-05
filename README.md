# Local Coding Tools MCP

**v0.7.0** — MCP stdio server: **coding + image editing** cho Cursor / VS Code.

**27 tools** | npm publish ready | winget template included

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

## Image tools (12 + check)

| Tool | Mô tả |
|------|--------|
| `image_info` / `image_crop` / `image_resize` | Cơ bản |
| `image_remove_background` | imgly-node / rembg / remove.bg |
| `image_adjust` / `image_composite` / `image_batch` | Chỉnh sửa nâng cao |
| `image_text` / `image_rounded` | Caption, bo góc, avatar tròn |
| `image_upscale` | Lanczos3 (sharp) |
| **`image_upscale_ai`** | **Real-ESRGAN AI** — SKIPPED if no CLI/token (image-core OK) |
| **`check_image_dependencies`** | Probe sharp/rembg/Real-ESRGAN/Replicate (no secrets printed) |
| `image_remove_background` | SKIPPED in image-core if no rembg/API/imgly |

### AI generative upscale

| Mode | Engine |
|------|--------|
| `cli` / `auto` | [realesrgan-ncnn-vulkan](https://github.com/xinntao/Real-ESRGAN-ncnn-vulkan) on PATH |
| `api` / `auto` | Replicate Real-ESRGAN — env `REPLICATE_API_TOKEN` |

## Coding tools (14)

`run_coding_session`, `check_system`, `check_workspace`, `read_project_info`, `list_scripts`, `read_workspace_file`, `search_workspace`, `list_workspace_tree`, `read_lints`, `apply_patch`, `write_workspace_file`, `run_project_script`, `git_status`, `check_url`, `collect_debug_bundle`

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

- `release/local-coding-tools-mcp-v0.7.0-customer.zip`
- `release/SHA256SUMS.txt`
- `release/release-gate-result.json`
- `release/RELEASE_NOTES-v0.7.0.md`

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
- [ ] Reload IDE; confirm **27 tools** in MCP panel
- [ ] Test prompt: `Gọi check_system qua MCP local-coding-tools`
- [ ] Cursor: avoid Run Everything; use Allowlist if needed (`-EnableAllowlist`)

See [docs/HUONG-DAN-VSCODE-COPILOT.md](docs/HUONG-DAN-VSCODE-COPILOT.md) and [docs/HUONG-DAN-CURSOR.md](docs/HUONG-DAN-CURSOR.md).

## Scripts

| Script | Description |
|--------|-------------|
| `npm test` | Unit + image profile tests |
| `npm run test:e2e` | 27 MCP tools |
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
