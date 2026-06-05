# Phase 0.8 — Customer Install Pack R1

**Project:** local-coding-tools-mcp  
**Version:** 0.7.0 (phase label 0.8)  
**Date:** 2026-06-05  
**Scope:** Customer install scripts, Vietnamese docs, ZIP pack — no new MCP tools, no core logic changes, no billing/cloud/publish.

---

## Summary

Customer Install Pack R1 delivers four PowerShell scripts, three Vietnamese guides, updated verify pipeline, and a distributable ZIP for end users installing MCP in VS Code/Copilot or Cursor.

---

## Files changed

| File | Action |
|------|--------|
| `scripts/install-vscode-mcp.ps1` | **NEW** — VS Code `.vscode/mcp.json` installer |
| `scripts/install-cursor-mcp.ps1` | **NEW** — Cursor `.cursor/mcp.json` + optional allowlist |
| `scripts/test-mcp-install.ps1` | **NEW** — PASS/FAIL validation table |
| `scripts/package-customer-zip.ps1` | **NEW** — Customer ZIP builder |
| `scripts/verify.mjs` | **UPDATED** — Scripts, docs, ZIP safety checks |
| `docs/HUONG-DAN-VSCODE-COPILOT.md` | **NEW** |
| `docs/HUONG-DAN-CURSOR.md` | **NEW** |
| `docs/TROUBLESHOOTING.md` | **NEW** |
| `tests/customer-install.test.ts` | **NEW** — 5 tests for pack R1 |
| `release/local-coding-tools-mcp-v0.7.0-customer.zip` | **GENERATED** |

---

## Commands run

```powershell
cd E:\MCP\local-coding-tools-mcp
npm run build
npm test
npm run smoke
npm run verify
powershell -ExecutionPolicy Bypass -File scripts\package-customer-zip.ps1
powershell -ExecutionPolicy Bypass -File scripts\test-mcp-install.ps1 `
  -ServerRoot "E:\MCP\local-coding-tools-mcp" `
  -VscodeWorkspace "E:\MCP" `
  -CursorWorkspace "E:\MCP"
# Install script smoke on fixture workspace
powershell -ExecutionPolicy Bypass -File scripts\install-vscode-mcp.ps1 `
  -WorkspaceRoot "tests\fixtures\customer-install-ws" `
  -ServerRoot "E:\MCP\local-coding-tools-mcp"
powershell -ExecutionPolicy Bypass -File scripts\install-cursor-mcp.ps1 `
  -WorkspaceRoot "tests\fixtures\customer-install-ws" `
  -ServerRoot "E:\MCP\local-coding-tools-mcp"
npm run verify   # after ZIP created
```

---

## PASS / FAIL table

| Check | Result | Detail |
|-------|--------|--------|
| `npm run build` | **PASS** | `tsc` exit 0 |
| `npm test` | **PASS** | 101/101 (96 + 5 customer-install) |
| `npm run smoke` | **PASS** | 6/6 checks |
| `npm run verify` | **PASS** | v0.7.0 + customer pack R1 |
| `package-customer-zip.ps1` | **PASS** | ZIP created |
| ZIP excludes forbidden | **PASS** | no node_modules/logs/.env/credentials |
| ZIP includes dist + scripts + docs | **PASS** | binary scan |
| `test-mcp-install.ps1` | **PASS** | 8/8 checks |
| VS Code install script | **PASS** | `servers` schema, backup, no `.cursor` |
| Cursor install script | **PASS** | `mcpServers` schema, no permissions by default |
| No auto Run Everything | **PASS** | `-EnableAllowlist` opt-in only |
| Examples schemas | **PASS** | cursor + vscode JSON valid |

---

## Customer ZIP

| Field | Value |
|-------|-------|
| **Path** | `E:\MCP\local-coding-tools-mcp\release\local-coding-tools-mcp-v0.7.0-customer.zip` |
| **Size** | ~0.13 MB |
| **SHA256** | `ADD30FFCA766465740B680CBD9E3DE3061D728C0FD2CD162B6840C4BF5D65F9B` |

**Includes:** `dist/`, `package.json`, `README.md`, `LICENSE`, `CHANGELOG.md`, `scripts/` (install + smoke + verify), `examples/`, `docs/`

**Excludes:** `node_modules/`, `logs/`, `.mcp-debug/`, `.git/`, `*.env`, credential/token/secret files (not `secretRedactor` source)

---

## Install command examples

### VS Code / Copilot

```powershell
# After unzip + npm install + npm run build
powershell -ExecutionPolicy Bypass -File scripts\install-vscode-mcp.ps1 `
  -WorkspaceRoot "E:\du-an" `
  -ServerRoot "E:\MCP\local-coding-tools-mcp"
```

### Cursor (safe default — no auto-approve)

```powershell
powershell -ExecutionPolicy Bypass -File scripts\install-cursor-mcp.ps1 `
  -WorkspaceRoot "E:\MCP" `
  -ServerRoot "E:\MCP\local-coding-tools-mcp"
```

### Cursor (optional allowlist)

```powershell
powershell -ExecutionPolicy Bypass -File scripts\install-cursor-mcp.ps1 `
  -WorkspaceRoot "E:\MCP" `
  -ServerRoot "E:\MCP\local-coding-tools-mcp" `
  -EnableAllowlist
# Then: Settings → Agent → Run Mode → Allowlist
```

### Validate install

```powershell
powershell -ExecutionPolicy Bypass -File scripts\test-mcp-install.ps1 `
  -ServerRoot "E:\MCP\local-coding-tools-mcp" `
  -VscodeWorkspace "E:\du-an" `
  -CursorWorkspace "E:\MCP"
```

---

## Known risks

1. **Default `ServerRoot`** hardcoded `E:\MCP\local-coding-tools-mcp` — customers must pass `-ServerRoot` on other machines.
2. **Customer ZIP has no `node_modules`** — user must run `npm install` after unzip (image tools need native deps).
3. **`image_remove_background`** may download models on first run (network + disk).
4. **Copilot Allow prompts** — VS Code may still ask per tool; not fixable by this pack.
5. **ZIP forbidden scan** uses path heuristics — `secretRedactor.js` intentionally allowed; real `.env` files blocked.
6. **Windows-first scripts** — PowerShell 5.1+; Linux/Mac customers need manual `mcp.json` from `examples/`.

---

## Next phase (suggested)

| Phase | Focus |
|-------|--------|
| **0.9** | Cross-platform install (bash), `ServerRoot` auto-detect from script location |
| **1.0** | Customer ZIP CI job, signed release, optional `npm pack` / dry-run publish |
| **1.1** | Winget manifest finalize + submit dry-run checklist |
| **1.2** | One-click portable bundle (embedded Node) for non-dev users |

---

## Criteria checklist (user spec)

- [x] Build PASS
- [x] Tests PASS (101/101)
- [x] Verify PASS
- [x] Smoke PASS
- [x] Customer ZIP created
- [x] ZIP excludes node_modules/logs/.env
- [x] VS Code install writes `.vscode/mcp.json` correctly
- [x] Cursor install writes `.cursor/mcp.json` correctly
- [x] No auto Run Everything by default
- [x] No new MCP tools
- [x] No core logic changes
- [x] No billing / cloud / real npm publish / real winget submit

**Phase 0.8 Customer Install Pack R1: PASS**
