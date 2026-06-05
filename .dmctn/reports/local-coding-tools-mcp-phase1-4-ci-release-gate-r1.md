# Phase 1.4 — CI + Release Gate R1

**Project:** local-coding-tools-mcp v0.7.0  
**Date:** 2026-06-05  
**Tool count:** **27** (unchanged)  
**Tests:** **121/121 PASS**

---

## Summary

Phase 1.4 adds a **Windows + Node 24 GitHub Actions CI pipeline** and a **local release gate** (`release:gate`) that validates customer ZIP hygiene, tool count, and SHA256 before distribution. Full-image dependencies are **not required** in CI — only a non-blocking dependency report step.

---

## Root cause (Phase 0 audit)

Existing pipeline had:

- `release-customer-pack.ps1` — build/test/smoke/verify/ZIP/SHA256 (no final gate)
- `verify-customer-zip-clean.mjs` — clean extract + 27 tools
- `ci.yml` — matrix ubuntu/windows + Node 20/22, no release steps
- No documented release checklist
- No automated ZIP content + SHA256 + tool-count gate after packaging

---

## Files changed

| File | Change |
|------|--------|
| `.github/workflows/ci.yml` | **Rewritten** — windows-latest, Node 24, full release pipeline + artifacts |
| `scripts/release-gate.mjs` | **NEW** — CLI wrapper |
| `scripts/release-gate-lib.mjs` | **NEW** — scan/probe library |
| `scripts/validate-ci-yaml.mjs` | **NEW** — local CI YAML validation |
| `scripts/verify.mjs` | Dev-only CI checks; customer pack skips `ci.yml` / `validate-ci-yaml` |
| `scripts/package-customer-zip.ps1` | Include release-gate scripts |
| `package.json` | `release:gate`, `validate:ci` |
| `docs/RELEASE-CHECKLIST.md` | **NEW** |
| `README.md` | CI / Release Gate section |
| `tests/release-gate.test.ts` | **NEW** (8 tests) |
| `tests/customer-install.test.ts` | RELEASE-CHECKLIST + release:gate scripts |

---

## Commands run

```powershell
cd E:\MCP\local-coding-tools-mcp
npm run build                          # PASS
npm test                               # 121/121 PASS
npm run smoke                          # PASS
npm run verify                         # PASS
npm run verify:image-core              # PASS (optional SKIPPED)
npm run release:customer               # PASS
npm run verify:customer-zip            # PASS (27 tools)
npm run release:gate                   # PASS
npm run validate:ci                    # PASS (local YAML check)
```

---

## PASS / FAIL / SKIPPED table

| Check | Result | Notes |
|-------|--------|-------|
| Build | **PASS** | |
| Tests | **PASS** | 121/121 (+8 release-gate) |
| Smoke | **PASS** | 6/6 |
| Verify | **PASS** | dev repo + validate-ci-yaml |
| verify:image-core | **PASS** | optional tools SKIPPED |
| release:customer | **PASS** | pipeline unchanged + new ZIP |
| verify:customer-zip | **PASS** | extract verify PASS (customer pack mode) |
| release:gate | **PASS** | 8/8 checks |
| validate:ci | **PASS** | YAML snippets OK |
| verify:image-full | **SKIPPED** | not in CI (by design) |
| full-image deps in CI | **SKIPPED** | report only, `continue-on-error: true` |
| 27 tools | **PASS** | release-gate + customer ZIP |

---

## CI workflow summary

**File:** `.github/workflows/ci.yml`  
**Runner:** `windows-latest`  
**Node:** `24.x`

| Step | Required |
|------|----------|
| checkout | yes |
| setup-node 24 + npm ci | yes |
| npm run build | yes |
| npm test | yes |
| npm run smoke | yes |
| npm run verify | yes |
| npm run verify:image-core | yes |
| `check-image-deps.mjs --profile full-image` | no (`continue-on-error: true`) |
| npm run release:customer | yes |
| npm run verify:customer-zip | yes |
| npm run release:gate | yes |
| upload-artifact (ZIP, SHA256SUMS, release-gate-result.json) | on success |

**Not in CI:** `verify:image-full`, Real-ESRGAN, Replicate token.

---

## Release gate result

```
package.json version        PASS  0.7.0
dist/server.js exists       PASS
tools/list count = 27       PASS  27
customer ZIP exists         PASS
SHA256SUMS.txt exists       PASS
ZIP forbidden paths         PASS  clean
ZIP required paths          PASS  all present
SHA256 matches ZIP          PASS
OVERALL: PASS
```

JSON: `release/release-gate-result.json`

---

## Customer ZIP

| Field | Value |
|-------|-------|
| Path | `E:\MCP\local-coding-tools-mcp\release\local-coding-tools-mcp-v0.7.0-customer.zip` |
| Size | ~0.24 MB |
| SHA256 (Phase 1.3) | `B3E644A78CFA1D914977A09AA6FDF5F8E8146F4BCCB88062776DB1E9ED3E43D5` |
| **SHA256 (Phase 1.4)** | **`49618037028885B56A38540616AC871B55704DA405136D33A36D4B626F371FA3`** |

---

## New commands

```powershell
npm run release:gate      # Final ZIP + SHA256 + 27-tool gate
npm run validate:ci       # Validate ci.yml locally (dev repo)
```

Full checklist: `docs/RELEASE-CHECKLIST.md`

---

## Remaining risks

1. **CI duration** — full `release:customer` inside CI runs tests twice (~45 min timeout set).
2. **Windows-only CI** — no linux/mac matrix in Phase 1.4 (by spec).
3. **Node 24** — local dev may use Node 22; CI uses 24 explicitly.
4. **Artifact retention** — 14 days; not a GitHub Release asset until Phase 2.x.
5. **ZIP hash changes** when any packaged file changes — always run `release:gate` after repack.

---

## Next phase (proposed)

| Phase | Scope |
|-------|-------|
| **1.5** | `check-image-deps.sh` for macOS/Linux CI smoke |
| **2.0** | GitHub Release + attach ZIP from CI artifact |
| **2.1** | Optional linux job (build + test only, no release pack) |
| **2.2** | Branch protection requiring CI PASS |

---

## PASS criteria checklist

- [x] Build PASS
- [x] Tests PASS (121)
- [x] Smoke PASS
- [x] Verify PASS
- [x] verify:image-core PASS
- [x] release:customer PASS
- [x] verify:customer-zip PASS
- [x] release:gate PASS
- [x] CI workflow file created
- [x] Release ZIP artifact path configured
- [x] ZIP clean (no forbidden paths)
- [x] Full-image not required in CI
- [x] 27 tools unchanged

**Phase 1.4 — CI + Release Gate R1: PASS**
