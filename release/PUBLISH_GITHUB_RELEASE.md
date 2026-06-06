# Publish GitHub Release — local-coding-tools-mcp

## Chuẩn bị

```powershell
cd E:\MCP\local-coding-tools-mcp
npm run build
powershell -ExecutionPolicy Bypass -File scripts/package-customer-zip.ps1 -Version 0.7.0
```

Ghi SHA256 từ output script vào `release/SHA256SUMS.txt`.

## Publish (cần `gh auth login` hoặc `GH_TOKEN`)

```powershell
gh auth login
# hoặc: $env:GH_TOKEN = "<token có quyền repo>"

cd E:\MCP\vscode-extension-dmctn-mcp
powershell -ExecutionPolicy Bypass -File scripts/publish-github-release.ps1 -Version 0.7.0
node scripts/sync-server-manifest.mjs 0.7.0
npm run package
```

URL sau publish:

`https://github.com/devgol/local-coding-tools-mcp/releases/download/v0.7.0/local-coding-tools-mcp-v0.7.0-customer.zip`

## Xác nhận

```powershell
curl -I "https://github.com/devgol/local-coding-tools-mcp/releases/download/v0.7.0/local-coding-tools-mcp-v0.7.0-customer.zip"
```

HTTP 200 hoặc 302 → extension có thể tải được.
