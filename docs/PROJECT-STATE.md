# Project State — local-coding-tools-mcp

**Last updated:** 2026-06-05  
**Status:** `PRIVATE_PILOT_READY`  
**Public release:** **No** (private pilot only)

## Version

| Field | Value |
|-------|-------|
| Package | `local-coding-tools-mcp` |
| Version | `0.7.0` |
| MCP tools | **27** |
| npm publish | **Not released** |
| winget | **Not released** |

## Phases completed (PASS)

| Phase | Name |
|-------|------|
| 0.8 | Customer install pack R1 |
| 0.9 | Clean machine pilot R1 |
| 1.0 | Release automation R1 |
| 1.2 | Full Image Install Profile R1 |
| 1.2 | Safety hardening |
| 1.3 | Full Image Dependency Installer R1 |
| 1.4 | CI + Release Gate R1 |
| **1.4** | **Repo Structure + Private Git Baseline R1** (this doc) |

## Customer pack (latest on disk)

| Field | Value |
|-------|-------|
| ZIP | `release/local-coding-tools-mcp-v0.7.0-customer.zip` |
| SHA256 (Phase 1.3 reference) | `B3E644A78CFA1D914977A09AA6FDF5F8E8146F4BCCB88062776DB1E9ED3E43D5` |
| SHA256 (current `SHA256SUMS.txt`) | See `release/SHA256SUMS.txt` |
| Checksums file | `release/SHA256SUMS.txt` |
| Release notes | `release/RELEASE_NOTES-v0.7.0.md` |

> **Note:** Customer ZIP is **not** committed to Git (repo stays light). Download/build from source or use ZIP from `release/` locally.

## Image profiles

| Profile | CI / release gate | Full-image deps |
|---------|-------------------|-----------------|
| **image-core** | Required PASS | Optional tools may SKIPPED |
| **full-image** | Not required in CI | rembg / Real-ESRGAN / Replicate — manual |

## Verification commands (baseline)

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

## Repository policy

- **Private GitHub** — see [PRIVATE-GITHUB-SETUP.md](./PRIVATE-GITHUB-SETUP.md)
- **No secrets** in Git — see [GIT-WORKFLOW.md](./GIT-WORKFLOW.md)
- **Reports** kept under `.dmctn/reports/`
