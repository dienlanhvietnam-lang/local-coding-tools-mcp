# Phase 1.4 — Repo Structure + Private Git Baseline R1

**Project:** local-coding-tools-mcp v0.7.0  
**Date:** 2026-06-05  
**Status:** `PRIVATE_PILOT_READY`  
**Tool count:** 27  
**Tests:** 121/121 PASS

---

## Summary

Chuẩn hóa cấu trúc repo private pilot: `.gitignore` bảo vệ secrets/output, docs baseline (PROJECT-STATE, GIT-WORKFLOW, PRIVATE-GITHUB-SETUP), `package.json` `private: true`, verification PASS, Git baseline commit + local tag. **Không push** — chưa có remote.

---

## Phase 0 audit

### Cây thư mục (cấp 1)

```
.dmctn/          reports
.github/         CI workflow
dist/            build output (ignored)
docs/            documentation
examples/        IDE MCP examples
installer/       winget template (not published)
logs/            runtime (ignored)
node_modules/    deps (ignored)
release/         ZIP + metadata
scripts/         automation
src/             TypeScript source
tests/           vitest
```

### Commit vs ignore

| Commit | Ignore |
|--------|--------|
| `src/`, `scripts/`, `tests/`, `docs/` | `node_modules/`, `dist/` |
| `.dmctn/reports/` | `logs/`, `.mcp-debug/` |
| `release/SHA256SUMS.txt`, `RELEASE_NOTES` | `release/*.zip`, `verify-clean-*/` |
| `.github/workflows/ci.yml` | `.env`, `*.pem`, `*.key` |

### Git state (before)

- `.git` existed, **no commits**, branch `master`
- **No remote** configured

### Sensitive files scan

| Path | Action |
|------|--------|
| `tests/fixtures/sample-project/.env` | **Ignored** via `.env` rule |
| No root `.env`, token, credentials files | OK |
| `examples/cursor-permissions.json` | Template only — no real secrets |

---

## Files changed

| File | Change |
|------|--------|
| `.gitignore` | Rewritten — Node, build, runtime, secrets, release ZIP |
| `docs/PROJECT-STATE.md` | **NEW** |
| `docs/GIT-WORKFLOW.md` | **NEW** |
| `docs/PRIVATE-GITHUB-SETUP.md` | **NEW** |
| `docs/RELEASE-CHECKLIST.md` | Updated checksum note |
| `package.json` | Added `"private": true` |
| `.dmctn/reports/...phase1-4-repo-structure...md` | **NEW** (this file) |

---

## .gitignore policy

- **Ignore:** `node_modules/`, `dist/`, `logs/`, `.mcp-debug/`, `release/*.zip`, `release/verify-clean-*/`, secrets patterns
- **Keep:** `src/`, `scripts/`, `tests/`, `docs/`, `.dmctn/reports/`, `release/SHA256SUMS.txt`
- **ZIP:** not committed (repo nhẹ)

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

git branch -M main
git add .
git diff --cached --name-only          # 135 files, no forbidden
git commit -m "chore: baseline local coding tools mcp private pilot"
git tag -a phase-1.3-full-image-installer-pass -m "Phase 1.3 full image dependency installer pass"
```

---

## PASS / FAIL table

| Check | Result | Notes |
|-------|--------|-------|
| Build | **PASS** | |
| Tests | **PASS** | 121/121 |
| Smoke | **PASS** | 6/6 |
| Verify | **PASS** | |
| verify:image-core | **PASS** | optional SKIPPED |
| release:customer | **PASS** | |
| verify:customer-zip | **PASS** | 27 tools |
| verify:image-full | **N/A** | not required |
| .gitignore secrets guard | **PASS** | |
| No secrets staged | **PASS** | |
| No release ZIP staged | **PASS** | |
| Baseline commit | **PASS** | `80da1ee` |
| Local tag | **PASS** | `phase-1.3-full-image-installer-pass` |
| Remote push | **SKIPPED** | no remote |
| npm publish | **SKIPPED** | `private: true` |
| winget | **SKIPPED** | |

---

## Verification evidence

- **image-core:** 8 PASS, 2 SKIPPED (`image_remove_background`, `image_upscale_ai`)
- **full-image:** not run (deps optional)
- **customer ZIP:** `verify:customer-zip` OVERALL PASS, toolCount 27
- **SHA256 (post-release):** `94C20A27F53D8EB544E6E33A773479762B92300C4406B88D795345A86040F765`
- **SHA256 (Phase 1.3 ref):** `B3E644A78CFA1D914977A09AA6FDF5F8E8146F4BCCB88062776DB1E9ED3E43D5`

---

## Git status

| Field | Value |
|-------|-------|
| Branch | `main` |
| Commit | `80da1ee9bb160c68f609553975df119212ae19f5` |
| Message | `chore: baseline local coding tools mcp private pilot` |
| Files | 135 |
| Tag | `phase-1.3-full-image-installer-pass` |
| Remote | **None** |

### Staged safety check (pre-commit)

Forbidden patterns scanned — **0 matches** in `git diff --cached --name-only`.

Not staged (ignored): `node_modules/`, `dist/`, `logs/`, `.mcp-debug/`, `release/*.zip`, `.env`

---

## Push commands (user runs manually)

1. Create GitHub **private** repo: `local-coding-tools-mcp`
2. Add remote:

```powershell
git remote add origin https://github.com/<owner>/local-coding-tools-mcp.git
```

3. Push (do **not** paste token into chat/log):

```powershell
git push -u origin main
git push origin --tags
```

See `docs/PRIVATE-GITHUB-SETUP.md`.

---

## Remaining risks

1. **SHA256 drift** — mỗi lần `release:customer` tạo ZIP mới → cập nhật `SHA256SUMS.txt` và commit metadata.
2. **Fixture `.env`** — ignored nhưng tồn tại local cho tests; không distribute ZIP chứa `.env`.
3. **No remote yet** — backup chỉ local cho đến khi push private GitHub.
4. **`private: true`** — chặn `npm publish` vô tình; gỡ khi sẵn sàng public npm.
5. **Test fixture assets** — một số PNG/webp trong `tests/fixtures` đã commit (nhỏ, cần cho verify).

---

## Next phase (proposed)

| Phase | Scope |
|-------|-------|
| **1.5** | Push private GitHub + branch protection |
| **1.6** | `dev` branch workflow + PR template |
| **2.0** | GitHub Release asset (ZIP out-of-band) |
| **2.1** | Optional npm publish (remove `private` when ready) |

---

## PASS criteria checklist

- [x] Build PASS
- [x] Tests PASS
- [x] Smoke PASS
- [x] Verify PASS
- [x] verify:image-core PASS
- [x] release:customer PASS
- [x] verify:customer-zip PASS
- [x] .gitignore protects secrets/logs/output
- [x] Git initialized + baseline commit
- [x] Local tag created
- [x] No secrets staged
- [x] No release ZIP staged
- [x] No npm publish / winget
- [x] Report created

**Phase 1.4 — Repo Structure + Private Git Baseline R1: PASS**
