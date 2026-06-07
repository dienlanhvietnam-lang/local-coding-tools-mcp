# Phase VSIX R1 — VSIX Publisher Tools (dev/admin profiles)

**Date:** 2026-06-07  
**Project:** `local-coding-tools-mcp` v0.17.0  
**Scope:** 4 VSIX publisher MCP tools + tool profiles (safe/dev/admin) + security hardening

---

## Summary

Added controlled VS Code extension packaging and Marketplace publish workflow to MCP **local-coding-tools**:

| Tool | Purpose |
|------|---------|
| `vsix_check_marketplace` | Preflight extension metadata + optional Marketplace HTTP check |
| `vsix_package` | Build `.vsix` via `@vscode/vsce` (local or npx), SHA256 output |
| `vsix_publish_marketplace` | Publish to Marketplace — **blocked** without `confirmPublish=true` and `VSCE_PAT` |
| `vsix_verify_publish` | Public Marketplace listing verification (no PAT) |

**Tool count:** 82 → **86**  
**Profiles:** safe (0 VSIX), dev (+3 VSIX), admin (+4 VSIX including publish)

No real publish in tests. PAT read from env only; redacted in all outputs.

---

## Tool count before/after

| Metric | Before | After |
|--------|--------|-------|
| Registered tools | 82 | **86** |
| safe profile | 82 | **82** (excludes all VSIX) |
| dev profile | — | **85** (+ check/package/verify) |
| admin profile | — | **86** (+ publish) |

---

## Files changed

### New — VSIX tools

| File | Role |
|------|------|
| `src/tools/vsix/vsixUtils.ts` | Preflight, vsce detection, SHA256, marketplace URL, PAT helpers |
| `src/tools/vsix/vsixCheckMarketplace.ts` | `vsix_check_marketplace` |
| `src/tools/vsix/vsixPackage.ts` | `vsix_package` |
| `src/tools/vsix/vsixPublishMarketplace.ts` | `vsix_publish_marketplace` |
| `src/tools/vsix/vsixVerifyPublish.ts` | `vsix_verify_publish` |
| `src/toolProfiles.ts` | Profile maps: safe/dev/admin/image/uiux/browser |

### New — tests & fixtures

| File | Role |
|------|------|
| `tests/fixtures/vsix-extension/` | Valid extension fixture |
| `tests/fixtures/vsix-extension-bad/` | Missing publisher → FAIL |
| `tests/fixtures/vsix-extension-partial/` | Missing CHANGELOG/LICENSE → PARTIAL |
| `tests/vsix-tools.test.ts` | 9 VSIX tool tests |
| `tests/tool-profiles.test.ts` | Profile placement tests |
| `tests/secret-redactor.test.ts` | PAT redaction tests |

### New — docs & agents

| File | Role |
|------|------|
| `docs/VSIX-PUBLISHER-TOOLS.md` | User guide |
| `docs/COPILOT-MCP-PROFILES.md` | Profile matrix |
| `docs/TOOL-INVENTORY.md` | 86-tool inventory |
| `templates/copilot/DMCTN-MCP-Safe.agent.md` | 82 tools, no VSIX |
| `templates/copilot/DMCTN-MCP-Dev.agent.md` | 85 tools, no publish |
| `templates/copilot/DMCTN-MCP-Admin.agent.md` | 86 tools + publish warnings |
| `scripts/render-profile-agents.mjs` | Render profile agent tool lists |

### Updated

| File | Change |
|------|--------|
| `src/toolRegistry.ts` | +4 VSIX tools |
| `src/server.ts` | Register VSIX handlers |
| `src/safety/secretRedactor.ts` | Redact VSCE_PAT, Bearer, pat_, vso..., token= |
| `src/config.ts` | v0.17.0 |
| `package.json` | v0.17.0 |
| `scripts/expected-tools.mjs` | +4 tools (86) |
| `scripts/hard-test-all-tools.mjs` | VSIX dryRun/blocked cases |
| `scripts/verify.mjs` | v0.17.0, VSIX docs + dist paths |
| `templates/copilot/DMCTN-MCP-agent-body.md` | §9.14 VSIX section |
| `templates/copilot/copilot-instructions.md` | 86 tools + profile agents |
| `CHANGELOG.md`, `README.md` | v0.17.0 VSIX release notes |

---

## Commands run

```powershell
cd E:\MCP\local-coding-tools-mcp
npm run build
npm test                    # 207 passed
npm run smoke               # PASS
npm run verify              # PASS (v0.17.0)
npm run verify:image-core   # PASS
node scripts/render-dmctn-agent.mjs
node scripts/render-profile-agents.mjs
npm run release:customer    # PASS
npm run verify:customer-zip # PASS — 86 tools
```

---

## PASS/FAIL table

| Check | Result |
|-------|--------|
| `npm run build` | **PASS** |
| `npm test` (207 tests) | **PASS** |
| `npm run smoke` | **PASS** |
| `npm run verify` | **PASS** |
| `npm run verify:image-core` | **PASS** |
| `npm run release:customer` | **PASS** |
| `npm run verify:customer-zip` | **PASS** (86 tools) |
| Tool count = 86 | **PASS** |
| safe excludes VSIX | **PASS** |
| dev has check/package/verify only | **PASS** |
| admin has publish | **PASS** |
| publish blocked without confirm | **PASS** |
| publish blocked without VSCE_PAT | **PASS** |
| dryRun does not publish/package | **PASS** |
| PAT not in stdout/stderr/logs | **PASS** |
| Customer ZIP includes VSIX-PUBLISHER-TOOLS.md | **PASS** |
| Customer ZIP no .env/token/.vsix test artifacts | **PASS** |

---

## Profile placement

| Profile | VSIX tools | Count |
|---------|------------|-------|
| **safe** | *(none)* | 82 |
| **dev** | `vsix_check_marketplace`, `vsix_package`, `vsix_verify_publish` | 85 |
| **admin** | all 4 VSIX tools incl. `vsix_publish_marketplace` | 86 |

### Risk metadata

| Tool | Risk | requiresConfirm |
|------|------|-----------------|
| `vsix_check_marketplace` | medium | — |
| `vsix_package` | medium | — |
| `vsix_verify_publish` | low | — |
| `vsix_publish_marketplace` | **high** | **true** |

---

## Security behavior

1. **`VSCE_PAT`** — read only from `process.env.VSCE_PAT`; never stored in repo/files/logs.
2. **`confirmPublish`** — must be `true` for real publish; otherwise `BLOCKED` (`confirm_required`).
3. **`dryRun=true`** — no real package/publish; returns `DRY_RUN` with redacted command summary.
4. **Preflight gate** — package/publish blocked if `vsix_check_marketplace` returns `FAIL`.
5. **Secret redaction** — `secretRedactor` masks VSCE_PAT, Bearer, `pat_*`, `vso...`, `token=...`, authorization headers.
6. **exec safety** — `runCommand` with `shell: false`; vsce via `node path/to/vsce` or `npx --yes @vscode/vsce`.
7. **No auto version bump**, no auto publisher creation, no auto login.

---

## Example prompts

**Check extension readiness:**
```
vsix_check_marketplace workspacePath=E:\my-extension checkMarketplace=true
```

**Package (dry run first):**
```
vsix_package workspacePath=E:\my-extension dryRun=true
vsix_package workspacePath=E:\my-extension outputDir=release
```

**Dry-run publish (admin):**
```
vsix_publish_marketplace workspacePath=E:\my-extension confirmPublish=true dryRun=true
```

**Verify listing:**
```
vsix_verify_publish workspacePath=E:\my-extension expectedVersion=1.2.3
```

**Real publish (admin only — user must set VSCE_PAT in env first):**
```
setx VSCE_PAT "<token-from-marketplace>"
vsix_publish_marketplace workspacePath=E:\my-extension confirmPublish=true dryRun=false
```

---

## Customer ZIP + SHA256

| Item | Value |
|------|-------|
| Path | `E:\MCP\local-coding-tools-mcp\release\local-coding-tools-mcp-v0.17.0-customer.zip` |
| Size | 14.65 MB |
| SHA256 | `8A36F8CAABF8E032352D1E2D3FA44BCF54B490A10E5BED163B92360D8A9BFE83` |
| SUMS | `release/SHA256SUMS.txt` |

---

## Remaining risks

1. **Real publish not exercised in CI** — by design; manual admin workflow only.
2. **npx vsce requires network** on machines without local `@vscode/vsce`.
3. **Marketplace verify PARTIAL** when version cannot be parsed from public HTML.
4. **Profile agents** require user to select Safe/Dev/Admin manually in Copilot — not auto-switched by MCP server.
5. **Extension repo** (`vscode-extension-dmctn-mcp`) not bumped in this phase — optional follow-up.

---

## Next phase

- **VSIX R2:** Integrate profile selection into VS Code extension installer; bump extension manifest to MCP 0.17.0.
- **VSIX R3:** Optional `vsix_publish_marketplace` pre-check that marketplace listing version ≠ package version (duplicate guard).
- Wire `render-profile-agents.mjs` into release pipeline alongside `render-dmctn-agent.mjs`.
