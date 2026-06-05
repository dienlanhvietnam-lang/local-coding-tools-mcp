# Phase 0.9 — Clean Machine Pilot R1

**Project:** local-coding-tools-mcp v0.7.0  
**Date:** 2026-06-05  
**Pilot type:** Simulated clean customer machine (no prior dev checkout)

---

## Executive summary

Clean Machine Pilot R1 **PASS** after fixing **3 packaging bugs** discovered on first extract.  
Pilot validated: unzip → `npm install` → `npm run build` → smoke/verify → IDE install scripts → MCP stdio (`tools/list`, `run_coding_session`).

| Pilot ZIP | SHA256 |
|-----------|--------|
| Original (Phase 0.8) | `ADD30FFCA766465740B680CBD9E3DE3061D728C0FD2CD162B6840C4BF5D65F9B` — **FAIL** on clean machine |
| Fixed (post-0.9) | `73386C11BECB3494AF1AB766428F0AD1416105C9D385170C20DA74797C3B731F` — **PASS** |

---

## Files / dirs created (pilot runtime)

| Path | Purpose |
|------|---------|
| `E:\TEST-MCP-CUSTOMER-R1\` | Clean extract of customer ZIP + `npm install` |
| `E:\TEST-MCP-WORKSPACE-R1\` | Customer workspace for MCP IDE config |
| `E:\TEST-MCP-WORKSPACE-R1\package.json` | Mini Node project (build/test/smoke scripts) |
| `E:\TEST-MCP-WORKSPACE-R1\src\index.js` | Simple entry file |
| `E:\TEST-MCP-WORKSPACE-R1\.vscode\mcp.json` | VS Code MCP config |
| `E:\TEST-MCP-WORKSPACE-R1\.cursor\mcp.json` | Cursor MCP config |
| `E:\TEST-MCP-WORKSPACE-R1\.vscode\mcp.json.bak-*` | Backup from 2nd install run |
| `E:\TEST-MCP-WORKSPACE-R1\.cursor\mcp.json.bak-*` | Backup from 2nd install run |

**Not created (expected):** `E:\TEST-MCP-WORKSPACE-R1\.cursor\permissions.json`

---

## Commands run

```powershell
# 1. Extract fixed customer ZIP
$zip = "E:\MCP\local-coding-tools-mcp\release\local-coding-tools-mcp-v0.7.0-customer.zip"
Expand-Archive $zip -DestinationPath E:\TEST-MCP-CUSTOMER-R1 -Force

# 2. Clean server install
cd E:\TEST-MCP-CUSTOMER-R1
npm install
npm run build
npm run smoke
npm run verify

# 3. Workspace setup
# Created E:\TEST-MCP-WORKSPACE-R1 with package.json + src/index.js

# 4. IDE install (no EnableAllowlist)
powershell -File E:\TEST-MCP-CUSTOMER-R1\scripts\install-vscode-mcp.ps1 `
  -WorkspaceRoot E:\TEST-MCP-WORKSPACE-R1 -ServerRoot E:\TEST-MCP-CUSTOMER-R1
powershell -File E:\TEST-MCP-CUSTOMER-R1\scripts\install-cursor-mcp.ps1 `
  -WorkspaceRoot E:\TEST-MCP-WORKSPACE-R1 -ServerRoot E:\TEST-MCP-CUSTOMER-R1

# 5. Backup test (2nd install)
# Re-ran both install scripts → .bak-* files created

# 6. Validation
powershell -File E:\TEST-MCP-CUSTOMER-R1\scripts\test-mcp-install.ps1 `
  -ServerRoot E:\TEST-MCP-CUSTOMER-R1 `
  -VscodeWorkspace E:\TEST-MCP-WORKSPACE-R1 `
  -CursorWorkspace E:\TEST-MCP-WORKSPACE-R1

# 7. MCP stdio pilot
node E:\TEST-MCP-CUSTOMER-R1\scripts\pilot-stdio.mjs E:\TEST-MCP-WORKSPACE-R1
```

---

## PASS / FAIL table

| # | Check | Result | Notes |
|---|-------|--------|-------|
| 1 | ZIP extract | **PASS** | `E:\TEST-MCP-CUSTOMER-R1` |
| 2 | `npm install` | **PASS** | 218 packages |
| 3 | `npm run build` | **PASS** | `tsc` (after packaging fix) |
| 4 | `npm run smoke` | **PASS** | 6/6 checks |
| 5 | `npm run verify` | **PASS** | customer pack profile |
| 6 | VS Code `.vscode/mcp.json` | **PASS** | `servers.local-coding-tools.type=stdio` |
| 7 | Cursor `.cursor/mcp.json` | **PASS** | `mcpServers.local-coding-tools` |
| 8 | No `permissions.json` default | **PASS** | without `-EnableAllowlist` |
| 9 | Install backup (2nd run) | **PASS** | `.bak-20260605-181650` created |
| 10 | ZIP excludes forbidden | **PASS** | no node_modules/logs/.env/.mcp-debug |
| 11 | `test-mcp-install.ps1` | **PASS** | 8/8 checks |
| 12 | MCP `initialize` | **PASS** | stdio connect |
| 13 | MCP `tools/list` | **PASS** | **26 tools** |
| 14 | `tools/call check_system` | **PASS** | node/npm/git ok |
| 15 | `tools/call run_coding_session` | **PASS** | workspace `E:\TEST-MCP-WORKSPACE-R1` |

**Overall Phase 0.9: PASS** (after packaging fixes)

---

## Paths

| Item | Path |
|------|------|
| ZIP extract (server) | `E:\TEST-MCP-CUSTOMER-R1` |
| VS Code config | `E:\TEST-MCP-WORKSPACE-R1\.vscode\mcp.json` |
| Cursor config | `E:\TEST-MCP-WORKSPACE-R1\.cursor\mcp.json` |
| Customer ZIP (fixed) | `E:\MCP\local-coding-tools-mcp\release\local-coding-tools-mcp-v0.7.0-customer.zip` |

---

## MCP `tools/list` result

**26 tools** (stdio pilot):

```
run_coding_session, check_system, check_workspace, read_project_info, list_scripts,
git_status, read_workspace_file, search_workspace, list_workspace_tree, check_url,
write_workspace_file, run_project_script, collect_debug_bundle, read_lints, apply_patch,
image_info, image_crop, image_resize, image_remove_background, image_adjust,
image_composite, image_batch, image_text, image_rounded, image_upscale, image_upscale_ai
```

---

## `run_coding_session` result

```json
{
  "status": "PASS",
  "workspacePath": "E:\\TEST-MCP-WORKSPACE-R1",
  "runProjectScript": "PASS",
  "summary": [
    "check_system: PASS",
    "check_workspace: PASS",
    "read_project_info: PASS",
    "list_scripts: PASS",
    "run_project_script (build): PASS",
    "git_status: SKIPPED"
  ]
}
```

`git_status: SKIPPED` — expected (workspace không phải git repo).

---

## Bugs found (first extract — original ZIP)

| ID | Bug | Impact | Severity |
|----|-----|--------|----------|
| B1 | ZIP thiếu `tsconfig.json` + `src/` | `npm run build` → `tsc` help, exit 1 | **HIGH** |
| B2 | ZIP thiếu `tests/fixtures/sample-project/` | `npm run smoke` → 5/6 FAIL | **HIGH** |
| B3 | `verify.mjs` yêu cầu `.github/` + `installer/winget/` | Customer verify FAIL trên máy sạch | **MEDIUM** |

---

## Fixes applied

| File | Change |
|------|--------|
| `scripts/package-customer-zip.ps1` | Thêm `tsconfig.json`, `src/`, `tests/fixtures/sample-project/package.json`, `pilot-stdio.mjs` |
| `scripts/verify.mjs` | Auto-detect customer pack — bỏ dev-only paths khi không có `.github`/installer |
| `scripts/pilot-stdio.mjs` | **NEW** — stdio pilot cho clean machine QA |
| `tests/customer-install.test.ts` | Cập nhật test staging paths (+1 test → 102 total) |

**Regenerated ZIP:** SHA256 `73386C11BECB3494AF1AB766428F0AD1416105C9D385170C20DA74797C3B731F` (~0.18 MB)

**Source repo after fixes:** 102/102 tests PASS, verify PASS.

---

## VS Code / Cursor config samples (pilot)

**VS Code** (`servers` schema):

```json
{
  "servers": {
    "local-coding-tools": {
      "type": "stdio",
      "command": "node",
      "args": ["E:\\TEST-MCP-CUSTOMER-R1\\dist\\server.js"],
      "cwd": "E:\\TEST-MCP-CUSTOMER-R1"
    }
  }
}
```

**Cursor** (`mcpServers` schema):

```json
{
  "mcpServers": {
    "local-coding-tools": {
      "command": "node",
      "args": ["E:\\TEST-MCP-CUSTOMER-R1\\dist\\server.js"],
      "cwd": "E:\\TEST-MCP-CUSTOMER-R1"
    }
  }
}
```

---

## Known risks (remaining)

1. **ZIP SHA changed** — customers với bản cũ (`ADD30FF...`) cần tải lại bản mới.
2. **`npm install` ~25s + native deps** — image tools cần sharp/imgly; lần đầu có thể chậm.
3. **Default `ServerRoot` trong scripts** vẫn `E:\MCP\...` — máy khác phải truyền `-ServerRoot`.
4. **Pilot dùng Node từ Cursor helper path** — install script PASS với bất kỳ `node` trong PATH.

---

## Next phase (suggested)

| Phase | Focus |
|-------|--------|
| **1.0** | Customer ZIP version bump + CHANGELOG; CI job build+validate ZIP on every release |
| **1.1** | `ServerRoot` auto-detect từ vị trí script; bash install cho macOS/Linux |
| **1.2** | End-to-end pilot trên VM sạch (no dev tools); document `npm audit` advisories |
| **1.3** | Signed ZIP + checksum file `SHA256SUMS.txt` cho customer download |

---

## Criteria checklist

- [x] Clean install PASS
- [x] Build/smoke/verify PASS
- [x] VS Code config PASS
- [x] Cursor config PASS
- [x] No auto allowlist by default PASS
- [x] MCP tools/list PASS (26)
- [x] run_coding_session PASS

**Phase 0.9 Clean Machine Pilot R1: PASS**
