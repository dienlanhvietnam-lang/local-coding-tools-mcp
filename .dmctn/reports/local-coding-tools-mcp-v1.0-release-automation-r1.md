# Phase 1.0 — Release Automation R1

**Project:** local-coding-tools-mcp v0.7.0  
**Date:** 2026-06-05  
**Scope:** Customer release pipeline, clean ZIP verification, SHA256SUMS — no new MCP tools, no npm/winget publish.

---

## Summary

Phase 1.0 adds one-command customer release (`npm run release:customer`) and automated clean-machine ZIP verification (`npm run verify:customer-zip`). All mandatory checks **PASS**.

---

## Files changed

| File | Action |
|------|--------|
| `scripts/release-customer-pack.ps1` | **NEW** — full release pipeline |
| `scripts/verify-customer-zip-clean.mjs` | **NEW** — extract + clean verify + pilot stdio |
| `scripts/package-customer-zip.ps1` | **UPDATED** — .NET SHA256 fallback (no `Get-FileHash`) |
| `scripts/verify.mjs` | **UPDATED** — release scripts dev-only; customer verify profile |
| `package.json` | **UPDATED** — `release:customer`, `verify:customer-zip` |
| `README.md` | **UPDATED** — release section + public pilot checklist |
| `release/RELEASE_NOTES-v0.7.0.md` | **NEW** |
| `release/SHA256SUMS.txt` | **GENERATED** |
| `tests/customer-install.test.ts` | **UPDATED** — +2 tests (103 total) |

---

## Commands run

```powershell
cd E:\MCP\local-coding-tools-mcp
npm run build
npm test
npm run smoke
npm run verify
npm run release:customer
npm run verify:customer-zip
```

---

## PASS / FAIL table

| Check | Result | Detail |
|-------|--------|--------|
| `npm run build` | **PASS** | tsc exit 0 |
| `npm test` | **PASS** | 103/103 |
| `npm run smoke` | **PASS** | 6/6 |
| `npm run verify` | **PASS** | dev + customer profiles |
| `npm run release:customer` | **PASS** | 10/10 steps |
| Customer ZIP created | **PASS** | see path below |
| `SHA256SUMS.txt` created | **PASS** | `release/SHA256SUMS.txt` |
| ZIP forbidden scan | **PASS** | clean |
| `npm run verify:customer-zip` | **PASS** | all steps |
| Clean extract `npm install` | **PASS** | |
| Clean extract `npm run build` | **PASS** | |
| Clean extract smoke/verify | **PASS** | |
| `tools/list` | **PASS** | **26 tools** |
| `run_coding_session` | **PASS** | sample-project fixture |
| Report created | **PASS** | this file |

**Overall Phase 1.0: PASS**

---

## Release artifacts

| Artifact | Path |
|----------|------|
| Customer ZIP | `E:\MCP\local-coding-tools-mcp\release\local-coding-tools-mcp-v0.7.0-customer.zip` |
| SHA256SUMS | `E:\MCP\local-coding-tools-mcp\release\SHA256SUMS.txt` |
| Release notes | `E:\MCP\local-coding-tools-mcp\release\RELEASE_NOTES-v0.7.0.md` |

**SHA256 (v1.0 release):**  
`3168DDDA6593B2691DB427868FC00CFF86D30A630870EAC41EA5A5AA4C64DDD2`

```
3168DDDA6593B2691DB427868FC00CFF86D30A630870EAC41EA5A5AA4C64DDD2  local-coding-tools-mcp-v0.7.0-customer.zip
```

---

## Clean ZIP verification result

```
zipExists          PASS
zipForbiddenScan   PASS
extract            PASS
npm install        PASS
npm run build      PASS
npm run smoke      PASS
npm run verify     PASS
pilotStdio         PASS (26 tools, run_coding_session PASS)
cleanup            PASS
OVERALL            PASS
```

---

## Bugs found / fixed during Phase 1.0

| ID | Bug | Fix |
|----|-----|-----|
| B1 | `Get-FileHash` unavailable in some PowerShell envs | .NET `SHA256` fallback in `package-customer-zip.ps1` + `release-customer-pack.ps1` |
| B2 | Customer `verify.mjs` required maintainer-only release scripts | Moved `release-customer-pack.ps1` + `verify-customer-zip-clean.mjs` to dev-only profile |

---

## Remaining risks

1. **SHA256 changes** when customer ZIP contents change — always ship `SHA256SUMS.txt` with release.
2. **Release scripts not in customer ZIP** — intentional; maintainers use dev checkout.
3. **Clean verify ~90s** — `npm install` in temp dir each run.
4. **Windows-first** — `Expand-Archive` in verify script; Linux needs `unzip`.
5. **Public pilot** — not npm/winget published; local ZIP distribution only.

---

## Maintainer quick reference

```powershell
# One-command release
npm run release:customer

# Validate ZIP before handing to customers
npm run verify:customer-zip

# Keep temp extract for debugging
node scripts/verify-customer-zip-clean.mjs --keep
```

---

## Next phase (suggested)

| Phase | Focus |
|-------|--------|
| **1.1** | GitHub Actions workflow calling `release:customer` on tag |
| **1.2** | Attach ZIP + SHA256SUMS to GitHub Release draft |
| **1.3** | `ServerRoot` auto-detect; bash install scripts |
| **1.4** | Optional signed ZIP (Authenticode / minisign) |

---

## Criteria checklist

- [x] Build PASS
- [x] Tests PASS (103/103)
- [x] Smoke PASS
- [x] Verify PASS
- [x] Customer ZIP created
- [x] SHA256SUMS.txt created
- [x] Clean ZIP verification PASS
- [x] tools/list = 26
- [x] run_coding_session PASS in clean verify
- [x] ZIP excludes forbidden files
- [x] Report created
- [x] No new MCP tools
- [x] No npm publish / winget submit

**Phase 1.0 Release Automation R1: PASS**
