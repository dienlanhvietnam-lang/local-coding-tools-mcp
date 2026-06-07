# VSIX Publisher Tools (v0.17.0)

Four tools for controlled VS Code extension packaging and Marketplace publish.

| Tool | Profile | Risk |
|------|---------|------|
| `vsix_check_marketplace` | dev, admin | medium |
| `vsix_package` | dev, admin | medium |
| `vsix_verify_publish` | dev, admin | low |
| `vsix_publish_marketplace` | **admin only** | high |

**Safe profile** excludes all VSIX tools.

## Workflow

1. `vsix_check_marketplace` — preflight metadata
2. `vsix_package` — create `.vsix` (or `dryRun: true`)
3. `vsix_publish_marketplace` — admin only, requires `confirmPublish=true` + `VSCE_PAT`
4. `vsix_verify_publish` — public marketplace check (no PAT)

## VSCE_PAT

Set in environment only — **never** in chat, repo, or logs:

```powershell
setx VSCE_PAT "your-marketplace-pat"
```

Restart terminal/IDE after `setx`.

## Publish rules

- `confirmPublish=true` required or status `BLOCKED` (`confirm_required`)
- `VSCE_PAT` must exist or `BLOCKED` (`missing_vsce_pat`)
- `dryRun=true` — no real publish
- Check must not be `FAIL` before package/publish
- Version is **not** auto-bumped
- PAT never appears in stdout/stderr/logs (redacted)

## Example prompts

**Check:**
> `vsix_check_marketplace` workspace=E:\MCP\vscode-extension-dmctn-mcp

**Package (dry run):**
> `vsix_package` workspace=... dryRun=true

**Publish dry run (admin):**
> `vsix_publish_marketplace` workspace=... confirmPublish=true dryRun=true

**Verify listing:**
> `vsix_verify_publish` publisher=devgol name=dmctn-mcp expectedVersion=0.5.5

## Common errors

| Issue | Cause |
|-------|--------|
| `confirm_required` | Missing `confirmPublish=true` |
| `missing_vsce_pat` | VSCE_PAT not in environment |
| `version_duplicate` | Version already on Marketplace |
| `auth_failed` | Invalid/expired PAT |
| PARTIAL check | Missing CHANGELOG/LICENSE/.vscodeignore |
| FAIL check | Missing publisher/version/engines.vscode/README |
