# Release Notes — local-coding-tools-mcp v0.7.0

**Status:** Public pilot ready — not production-wide deployment yet.

## Highlights

- **26 MCP tools** (14 coding + 12 image)
- **VS Code / GitHub Copilot** — `.vscode/mcp.json` (`servers` schema)
- **Cursor** — `.cursor/mcp.json` (`mcpServers` schema)
- Customer ZIP with install scripts + Vietnamese docs
- Clean-machine verified (`verify-customer-zip-clean.mjs`)

## Customer ZIP

| Field | Value |
|-------|-------|
| File | `release/local-coding-tools-mcp-v0.7.0-customer.zip` |
| SHA256 | See `release/SHA256SUMS.txt` (run `npm run release:customer`) |

> **Do not use old ZIPs:**
> - `ADD30FF...` (Phase 0.8) — missing `tsconfig.json`, `src/`, smoke fixture  
> - `73386C11...` (Phase 0.9) — pre-release-automation verify profile  
>
> **Use latest SHA256 from `SHA256SUMS.txt`:**  
> `3168DDDA6593B2691DB427868FC00CFF86D30A630870EAC41EA5A5AA4C64DDD2`

## Install (customer)

```powershell
# 1. Unzip customer ZIP
Expand-Archive release\local-coding-tools-mcp-v0.7.0-customer.zip -DestinationPath E:\MCP\local-coding-tools-mcp

# 2. Build server
cd E:\MCP\local-coding-tools-mcp
npm install
npm run build

# 3. Configure IDE (pick one or both)
powershell -File scripts\install-vscode-mcp.ps1 -WorkspaceRoot E:\your-workspace -ServerRoot E:\MCP\local-coding-tools-mcp
powershell -File scripts\install-cursor-mcp.ps1 -WorkspaceRoot E:\your-workspace -ServerRoot E:\MCP\local-coding-tools-mcp

# 4. Validate
powershell -File scripts\test-mcp-install.ps1 -ServerRoot E:\MCP\local-coding-tools-mcp -CursorWorkspace E:\your-workspace
```

## Release automation (maintainers)

```powershell
npm run release:customer
npm run verify:customer-zip
```

## Known limitations

- Windows-first PowerShell install scripts (bash/macOS manual via `examples/`)
- `npm install` required after unzip (~25s, native deps for image tools)
- `image_remove_background` may download models on first use
- Copilot may prompt Allow per tool; Cursor needs Allowlist (`-EnableAllowlist`) for auto-approve
- Not published to npm/winget in this pilot — local ZIP only
- Default `ServerRoot` in scripts is `E:\MCP\local-coding-tools-mcp` — override on other machines

## Docs

- [HUONG-DAN-VSCODE-COPILOT.md](../docs/HUONG-DAN-VSCODE-COPILOT.md)
- [HUONG-DAN-CURSOR.md](../docs/HUONG-DAN-CURSOR.md)
- [TROUBLESHOOTING.md](../docs/TROUBLESHOOTING.md)
