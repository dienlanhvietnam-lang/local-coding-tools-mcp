# Phase 1.2 — Full Image Install Profile R1

**Project:** local-coding-tools-mcp v0.7.0  
**Date:** 2026-06-05  
**Tool count:** 26 → **27** (+`check_image_dependencies`)

---

## Root cause (Phase 0 audit)

Optional image tools (`image_remove_background`, `image_upscale_ai`) returned **`FAIL`** when rembg / Real-ESRGAN / API tokens were missing — same severity as real processing errors. Customers on **image-core** profile interpreted this as broken server, not missing optional dependency.

**Files audited:** `imageRemoveBackground.ts`, `imageUpscaleAi.ts`, `aiUpscale.ts`, `removeBackgroundNode.ts`, `server.ts`, image tests, `package-customer-zip.ps1`, `verify.mjs`, `release-customer-pack.ps1`.

---

## Summary of changes

| Area | Change |
|------|--------|
| Optional tools | `SKIPPED` + `reason: missing_dependency` + `installHint` when deps absent |
| New MCP tool | `check_image_dependencies` (27th tool) |
| Scripts | `check-image-deps.ps1`, `install-image-deps.ps1`, `verify-image-profile.mjs`, `generate-image-fixtures.mjs` |
| Fixtures | `tests/fixtures/images/product-sample-1024.png` (+ transparent) |
| Docs | `docs/HUONG-DAN-FULL-IMAGE.md`, README, TROUBLESHOOTING |
| Minor fix | `listWorkspaceTree` skips `.mcp-debug` (prevent test truncation) |
| Sharp probe | Static `import sharp` in `imageDependencies.ts` |

---

## Files changed

**Core / tools**
- `src/utils/imageDependencies.ts` (NEW)
- `src/tools/checkImageDependencies.ts` (NEW)
- `src/tools/imageRemoveBackground.ts`
- `src/tools/imageUpscaleAi.ts`
- `src/tools/listWorkspaceTree.ts`
- `src/server.ts`

**Scripts**
- `scripts/check-image-deps.ps1` (NEW)
- `scripts/check-image-deps.mjs` (NEW)
- `scripts/install-image-deps.ps1` (NEW)
- `scripts/verify-image-profile.mjs` (NEW)
- `scripts/generate-image-fixtures.mjs` (NEW)
- `scripts/package-customer-zip.ps1`
- `scripts/pilot-stdio.mjs`
- `scripts/verify-customer-zip-clean.mjs`
- `scripts/verify.mjs`

**Tests**
- `tests/image-install-profile.test.ts` (NEW)
- `tests/image-tools.test.ts`
- `tests/image-upscale-ai.test.ts`
- `tests/mcp-e2e.test.ts`
- `tests/fixtures/images/product-sample-1024.png` (NEW)
- `tests/fixtures/images/product-sample-transparent.png` (NEW)

**Docs / config**
- `docs/HUONG-DAN-FULL-IMAGE.md` (NEW)
- `docs/TROUBLESHOOTING.md`
- `README.md`
- `package.json`

---

## Commands run

```powershell
cd E:\MCP\local-coding-tools-mcp
node scripts/generate-image-fixtures.mjs
npm run build
npm test                    # 107/107 PASS
npm run smoke               # PASS
npm run verify              # PASS
npm run release:customer    # PASS
npm run verify:customer-zip # PASS (27 tools)
npm run verify:image-core   # PASS (optional SKIPPED)
npm run verify:image-full   # FAIL (expected — missing realesrgan/token)
powershell -File scripts\check-image-deps.ps1 -Profile image-core   # PASS exit 0
powershell -File scripts\check-image-deps.ps1 -Profile full-image   # FAIL exit 1 (expected)
```

---

## PASS / FAIL / SKIPPED table

| Check | Result | Notes |
|-------|--------|-------|
| Build | **PASS** | |
| Tests | **PASS** | 107/107 |
| Smoke | **PASS** | 6/6 |
| Verify | **PASS** | |
| release:customer | **PASS** | |
| verify:customer-zip | **PASS** | 27 tools, run_coding_session PASS |
| verify:image-core | **PASS** | optional tools **SKIPPED** |
| verify:image-full | **FAIL** ✓ | missing realesrgan + token — **đúng lý do** |
| check-image-deps image-core | **PASS** | exit 0, status PARTIAL |
| check-image-deps full-image | **FAIL** ✓ | exit 1, thiếu AI upscale dep |
| image_remove_background (no dep) | **SKIPPED** | installHint present |
| image_upscale_ai (no dep) | **SKIPPED** | installHint present |
| Core image tools | **PASS** | no regression |
| Token in output/log | **PASS** | boolean only, no secrets |

### verify:image-core detail

```
PASS   image_info, resize, crop, adjust, text, rounded, batch, upscale
SKIPPED image_remove_background, image_upscale_ai
OVERALL: PASS
```

---

## Image dependency status (pilot machine)

| Dependency | image-core | full-image |
|------------|------------|------------|
| sharp | PASS | PASS |
| imgly-node | PASS | PASS |
| rembg CLI | SKIPPED | FAIL (required) |
| realesrgan-ncnn-vulkan | SKIPPED | FAIL (required) |
| REPLICATE_API_TOKEN | not configured | FAIL (required for AI) |
| removeBackgroundReady | true (imgly) | true |
| aiUpscaleReady | false | false |

---

## Tool count

| | Count |
|---|-------|
| Before | 26 |
| After | **27** (+`check_image_dependencies`) |

---

## Customer ZIP

| Field | Value |
|-------|-------|
| Path | `E:\MCP\local-coding-tools-mcp\release\local-coding-tools-mcp-v0.7.0-customer.zip` |
| SHA256 | `F8CFE904D2AACD1FA285F4C3AEB490FCE9D2D7847479677ACED538FC705BC345` |
| SUMS | `release/SHA256SUMS.txt` |
| Size | ~0.22 MB |

**New in ZIP:** image deps scripts, `HUONG-DAN-FULL-IMAGE.md`, `tests/fixtures/images/`

---

## New install commands

```powershell
# Image-core check (PASS = core ready)
powershell -File scripts\check-image-deps.ps1 -Profile image-core

# Full-image check (FAIL until deps installed)
powershell -File scripts\check-image-deps.ps1 -Profile full-image

# Install rembg (needs Python)
powershell -File scripts\install-image-deps.ps1 -InstallRembg

# Replicate hint only (no token prompt)
powershell -File scripts\install-image-deps.ps1 -UseReplicate

# Profile verify
npm run verify:image-core
npm run verify:image-full

# MCP tool
# check_image_dependencies → PASS/PARTIAL/FAIL
```

---

## Bugs found / fixed

| ID | Issue | Fix |
|----|-------|-----|
| B1 | Optional deps returned FAIL | SKIPPED + installHint |
| B2 | No dependency probe tool | `check_image_dependencies` |
| B3 | sharp probe failed via dynamic import in dist | Static `import sharp` |
| B4 | listWorkspaceTree truncated on `.mcp-debug` | Skip `.mcp-debug` dir |

---

## Remaining risks

1. **imgly-node** bundled — remove_background may **PASS** on full-image via imgly even without rembg CLI.
2. **AI upscale** still needs Real-ESRGAN or Replicate for full-image PASS.
3. **full-image verify** may take 60–120s when imgly downloads model first run.
4. **PowerShell scripts** Windows-first; macOS/Linux use npm scripts + MCP tool.
5. **SHA256 changes** each release — always ship `SHA256SUMS.txt`.

---

## Next phase (suggested)

| Phase | Focus |
|-------|--------|
| **1.3** | CI job: `verify:image-core` on every PR |
| **1.4** | Optional bundled Real-ESRGAN path (official release only) |
| **1.5** | bash `check-image-deps.sh` for macOS/Linux |
| **1.6** | Copilot/VS Code doc: explain SKIPPED vs FAIL in UI |

---

## Criteria checklist

- [x] Build PASS
- [x] Tests PASS (107)
- [x] Smoke / Verify PASS
- [x] release:customer PASS
- [x] verify:customer-zip PASS (27 tools)
- [x] image-core profile PASS
- [x] Optional missing → SKIPPED (image-core)
- [x] full-image FAIL đúng lý do khi thiếu dep
- [x] Core image tools no regression
- [x] Customer ZIP updated
- [x] No token/secret in output

**Phase 1.2 Full Image Install Profile R1: PASS**
