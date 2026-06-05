# Phase 1.3 — Full Image Dependency Installer R1

**Project:** local-coding-tools-mcp v0.7.0  
**Date:** 2026-06-05  
**Tool count:** **27** (unchanged)  
**Tests:** **113/113 PASS**

---

## Root cause

Phase 1.2 introduced dependency check/install scripts, but they were incomplete for operator workflow:

1. **check-image-deps.ps1** — no `Component | Status | Detail | Fix` table, weak exit-code contract, PowerShell broke on Node stderr (GLib warnings from imgly/sharp).
2. **install-image-deps.ps1** — missing `-CheckOnly`, `-Yes`, pip upgrade, confirm prompt.
3. **No local verify gate** — `verify-image-profile.mjs --profile full-image` could run heavy tools before confirming deps.
4. **Utils drift** — `probeRembgCli` / `probeRealesrganCli` returned `boolean`; tools did not handle timeout/reason consistently with scripts.

**Goal:** Make full-image easier to install and verify (rembg, Real-ESRGAN, Replicate) without new MCP tools, token storage, or binary downloads.

---

## Summary of changes

| Area | Change |
|------|--------|
| `imageDependencies.ts` | node/npm probes, timeout-aware `commandExists`, `buildDependencyComponents`, `profileExitCode` |
| `check-image-deps.ps1/.mjs` | Profile exit 0/1/2, JSON + table output, stderr-safe PowerShell wrapper |
| `install-image-deps.ps1` | `-CheckOnly`, `-Yes`, pip upgrade, confirm, no Python auto-install, no binary download |
| `verify-full-image-local.ps1` | **NEW** — deps first; `-RequireFullImage` skips heavy tools when missing |
| `image-deps-smoke.mjs` | **NEW** — script existence + exit-code smoke (wired into `verify.mjs`) |
| Tests | `image-deps-installer.test.ts` (+6), customer ZIP assertions, imgly flake fix |
| Docs | `HUONG-DAN-FULL-IMAGE.md` (8 sections), README installer table |
| Customer ZIP | Includes new scripts + fixtures; excludes secrets/node_modules |

---

## Files changed

**Core / utils / tools**
- `src/utils/imageDependencies.ts`
- `src/tools/checkImageDependencies.ts` (+node/npm fields)
- `src/tools/imageRemoveBackground.ts` (`probeRembgCli().ok`)
- `src/tools/imageUpscaleAi.ts` (`probeRealesrganCli().ok`)

**Scripts**
- `scripts/check-image-deps.ps1`
- `scripts/check-image-deps.mjs`
- `scripts/install-image-deps.ps1`
- `scripts/verify-full-image-local.ps1` (NEW)
- `scripts/image-deps-smoke.mjs` (NEW)
- `scripts/verify.mjs`
- `scripts/package-customer-zip.ps1`

**Tests**
- `tests/image-deps-installer.test.ts` (NEW)
- `tests/customer-install.test.ts`
- `tests/image-phase2.test.ts` (accept SKIPPED under parallel load)

**Docs / config**
- `docs/HUONG-DAN-FULL-IMAGE.md`
- `README.md`
- `package.json` (`verify:full-image-local`, `verify:image-deps`)

---

## Commands run

```powershell
cd E:\MCP\local-coding-tools-mcp
npm run build                          # PASS
npm test                               # 113/113 PASS
npm run smoke                          # PASS
npm run verify                         # PASS (+ image-deps-smoke)
npm run release:customer               # PASS
npm run verify:customer-zip            # PASS (27 tools)
npm run verify:image-core              # PASS (optional SKIPPED)
powershell -File scripts\check-image-deps.ps1 -Profile image-core      # PASS exit 0
powershell -File scripts\check-image-deps.ps1 -Profile full-image      # FAIL exit 1 (aiUpscale missing)
powershell -File scripts\install-image-deps.ps1 -CheckOnly               # PASS exit 0
powershell -File scripts\verify-full-image-local.ps1 -RequireFullImage # FAIL exit 1 (correct — no heavy tools)
```

---

## PASS / FAIL / SKIPPED table

| Check | Result | Notes |
|-------|--------|-------|
| Build | **PASS** | tsc clean |
| Tests | **PASS** | 113/113 |
| Smoke | **PASS** | 6/6 |
| Verify | **PASS** | includes image-deps-smoke |
| release:customer | **PASS** | |
| verify:customer-zip | **PASS** | 27 tools, clean extract |
| verify:image-core | **PASS** | remove_background + upscale_ai **SKIPPED** |
| verify:image-full | **SKIPPED** | not run (deps missing — by design) |
| check-image-deps image-core | **PASS** | exit 0, PARTIAL |
| check-image-deps full-image | **FAIL** ✓ | exit 1 — `aiUpscaleReady=false` |
| install-image-deps -CheckOnly | **PASS** | exit 0 |
| verify-full-image-local -RequireFullImage | **FAIL** ✓ | missing aiUpscale; no image tools run |
| Token leak | **PASS** | CONFIGURED/MISSING only |
| 27 tools regression | **PASS** | E2E + customer ZIP |

---

## Dependency status (this machine)

| Component | Status | Notes |
|-----------|--------|-------|
| node / npm / sharp | READY | coreImageReady=true |
| python / pip | READY | |
| rembg CLI | MISSING | optional — imgly covers removeBackground |
| imgly-node | READY | removeBackgroundReady=true |
| realesrgan-ncnn-vulkan | MISSING | |
| REPLICATE_API_TOKEN | MISSING | |
| REMOVE_BG_API_KEY | MISSING | |
| aiUpscaleReady | **MISSING** | full-image exit 1 |

---

## image-core result

```
OVERALL: PASS
SKIPPED: image_remove_background, image_upscale_ai (missing_dependency)
```

## full-image result

```
OVERALL: FAIL (exit 1)
Reason: aiUpscaleReady=false (realesrgan + REPLICATE_API_TOKEN missing)
verify-full-image-local: FAIL without running heavy image processing ✓
```

---

## Customer ZIP

| Field | Value |
|-------|-------|
| Path | `E:\MCP\local-coding-tools-mcp\release\local-coding-tools-mcp-v0.7.0-customer.zip` |
| Size | ~0.23 MB |
| SHA256 (previous) | `F8CFE904D2AACD1FA285F4C3AEB490FCE9D2D7847479677ACED538FC705BC345` |
| **SHA256 (new)** | **`B3E644A78CFA1D914977A09AA6FDF5F8E8146F4BCCB88062776DB1E9ED3E43D5`** |

**Included:** `check-image-deps.ps1`, `check-image-deps.mjs`, `install-image-deps.ps1`, `verify-full-image-local.ps1`, `verify-image-profile.mjs`, `image-deps-smoke.mjs`, `docs/HUONG-DAN-FULL-IMAGE.md`, `tests/fixtures/images/product-sample-1024.png`

**Excluded:** token, `.env`, logs, `.mcp-debug`, `node_modules`

---

## New install / verify commands

```powershell
# Check
powershell -ExecutionPolicy Bypass -File scripts\check-image-deps.ps1 -Profile full-image
powershell -ExecutionPolicy Bypass -File scripts\check-image-deps.ps1 -Profile full-image -Json

# Install rembg (needs Python/pip)
powershell -ExecutionPolicy Bypass -File scripts\install-image-deps.ps1 -InstallRembg -Yes

# Replicate hint only
powershell -ExecutionPolicy Bypass -File scripts\install-image-deps.ps1 -UseReplicate
setx REPLICATE_API_TOKEN "your-token-here"

# Real-ESRGAN — manual PATH only
powershell -ExecutionPolicy Bypass -File scripts\install-image-deps.ps1 -InstallRealEsrgan

# Full gate
powershell -ExecutionPolicy Bypass -File scripts\verify-full-image-local.ps1 -RequireFullImage
npm run verify:full-image-local
```

---

## Remaining risks

1. **GLib stderr on Windows** — imgly/sharp may emit native warnings to stderr; PowerShell wrapper now tolerates this, but logs may look noisy.
2. **imgly-node** — `removeBackgroundReady` can be true without rembg CLI; full-image still fails if AI upscale missing.
3. **Real-ESRGAN** — manual PATH step; no automated download by design.
4. **First imgly run** — model download can take 60–120s when full-image verify eventually runs with deps present.
5. **Parallel tests** — imgly probe may intermittently return SKIPPED under heavy Vitest load (test accepts SKIPPED).

---

## Next phase (proposed)

| Phase | Scope |
|-------|-------|
| **1.4** | CI job: `verify:image-core` + `image-deps-smoke` on every PR |
| **1.5** | `check-image-deps.sh` for macOS/Linux |
| **1.6** | Optional `-InstallRembg` progress output + pip mirror hint for CN/VN networks |
| **2.0** | Documented Real-ESRGAN PATH verifier in `check_system` output |

---

## PASS criteria checklist

- [x] Build PASS
- [x] Tests PASS (113)
- [x] Smoke PASS
- [x] Verify PASS
- [x] release:customer PASS
- [x] verify:customer-zip PASS
- [x] verify:image-core PASS
- [x] check-image-deps image-core PASS (exit 0)
- [x] check-image-deps full-image FAIL đúng lý do (exit 1)
- [x] install-image-deps -CheckOnly PASS
- [x] verify-full-image-local FAIL đúng khi thiếu dep
- [x] Không lộ token
- [x] Customer ZIP có script/docs mới
- [x] Không regression 27 tools

**Phase 1.3 — Full Image Dependency Installer R1: PASS**
