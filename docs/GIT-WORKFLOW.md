# Git Workflow — local-coding-tools-mcp

Private pilot repository. **Not** public npm/winget release.

## Branches

| Branch | Purpose |
|--------|---------|
| `main` | Stable baseline — release gate PASS |
| `dev` | Integration before merge to `main` |
| `feature/*` | Short-lived feature branches |

Flow:

```
feature/xyz → dev → main
```

Hotfix: `hotfix/description` → `main` (+ cherry-pick to `dev` if needed).

## Commit message format

```
<type>: <short summary>

[optional body]
```

Types: `feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `ci`

Examples:

```
chore: baseline local coding tools mcp private pilot
feat: add check_image_dependencies tool
fix: skip optional image tools when deps missing
docs: update RELEASE-CHECKLIST for phase 1.4
```

## Tags

Baseline tags use phase names:

```powershell
git tag -a phase-1.3-full-image-installer-pass -m "Phase 1.3 full image dependency installer pass"
```

List tags: `git tag -l 'phase-*'`

## Never commit

- `node_modules/`
- `logs/`, `.mcp-debug/`, `support-bundles/`
- `.env`, `*.pem`, `*.key`
- `credentials*`, `token*`, `secret*`
- `release/*.zip` (keep repo light)
- `release/verify-clean-*/` (extract test dirs)

## Safe to commit

- `src/`, `scripts/`, `tests/`, `docs/`
- `.dmctn/reports/`
- `release/SHA256SUMS.txt`, `release/RELEASE_NOTES-*.md`
- `examples/`, `installer/` templates (no secrets)
- `.github/workflows/` (CI — no tokens in YAML)

## dist/ policy

`dist/` is **gitignored**. CI and customers run `npm run build` after `npm install`.

## Before every commit

```powershell
git status --short
git diff --cached --name-only
```

Confirm no forbidden paths appear. If unsure:

```powershell
git check-ignore -v path/to/file
```

## Release ZIP policy

Build locally with `npm run release:customer`. Distribute ZIP out-of-band (artifact, shared drive). Only commit **SHA256** metadata to Git.
